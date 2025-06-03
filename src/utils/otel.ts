#!/usr/bin/env bun
import { OTLPTraceExporter } from "@opentelemetry/exporter-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

// Define deployment environment attribute manually since import is problematic
const ATTR_DEPLOYMENT_ENVIRONMENT = "deployment.environment";
import { logger } from "./logger.ts";

/**
 * Initialize OpenTelemetry for privacy-first telemetry.
 *
 * This setup ensures:
 * - No automatic instrumentation that could leak user data
 * - Custom resource attributes that don't identify users
 * - Proper authentication with Grafana
 * - Graceful fallback if telemetry fails
 */

interface OTelConfig {
  endpoint?: string;
  token?: string;
  serviceName?: string;
  environment?: string;
  enabled?: boolean;
}

let sdk: NodeSDK | null = null;

export function initializeOpenTelemetry(config: OTelConfig = {}): NodeSDK | null {
  try {
    // Don't initialize if disabled or no endpoint
    if (config.enabled === false || !config.endpoint) {
      logger.debug("OpenTelemetry disabled or no endpoint configured");
      return null;
    }

    const serviceName = config.serviceName || "translator-sync";
    const serviceVersion = process.env.npm_package_version || "0.0.0";
    const environment = config.environment || process.env.NODE_ENV || "development";

    // Create resource with non-identifying attributes
    const resource = resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: serviceVersion,
      [ATTR_DEPLOYMENT_ENVIRONMENT]: environment,
      "service.namespace": "translator-sync",
      // Privacy-safe attributes only
      "telemetry.privacy": "anonymous",
      "telemetry.version": "1.0.0",
    });

    // Parse Grafana OTEL headers (format: "Authorization=Basic <token>")
    const headers: Record<string, string> = {};
    if (process.env.OTEL_EXPORTER_OTLP_HEADERS) {
      const headerPairs = process.env.OTEL_EXPORTER_OTLP_HEADERS.split(",");
      for (const pair of headerPairs) {
        const [key, value] = pair.split("=", 2);
        if (key && value) {
          headers[key.trim()] = value.trim();
        }
      }
    }

    // Configure trace exporter
    const traceExporter = new OTLPTraceExporter({
      url: `${config.endpoint}/v1/traces`,
      headers,
    });

    // Configure metrics exporter
    const metricExporter = new OTLPMetricExporter({
      url: `${config.endpoint}/v1/metrics`,
      headers,
    });

    // Create metric reader with reasonable export interval
    const metricReader = new PeriodicExportingMetricReader({
      // biome-ignore lint/suspicious/noExplicitAny: OpenTelemetry version compatibility issue
      exporter: metricExporter as any,
      exportIntervalMillis: 30000, // Export every 30 seconds
      exportTimeoutMillis: 10000, // 10 second timeout
    });

    // Initialize SDK with minimal instrumentation
    sdk = new NodeSDK({
      resource,
      // biome-ignore lint/suspicious/noExplicitAny: OpenTelemetry version compatibility issue
      traceExporter: traceExporter as any,
      metricReader,
      // Explicitly disable automatic instrumentation to prevent data leaks
      instrumentations: [],
    });

    sdk.start();

    logger.debug(`OpenTelemetry initialized for ${serviceName}@${serviceVersion}`);
    logger.debug(`Exporting to: ${config.endpoint}`);

    return sdk;
  } catch (error) {
    // Telemetry should never break the app
    logger.warn(`Failed to initialize OpenTelemetry: ${error}`);
    return null;
  }
}

/**
 * Gracefully shutdown OpenTelemetry.
 */
export async function shutdownOpenTelemetry(): Promise<void> {
  if (sdk) {
    try {
      await sdk.shutdown();
      logger.debug("OpenTelemetry shutdown complete");
    } catch (error) {
      logger.warn(`Error during OpenTelemetry shutdown: ${error}`);
    }
  }
}

/**
 * Configure OpenTelemetry from environment and config.
 */
export function configureOTelFromEnv(): OTelConfig {
  return {
    endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    token: process.env.GRAFANA_TOKEN,
    serviceName: "translator-sync",
    environment: process.env.NODE_ENV || "production",
    enabled: process.env.OTEL_TRACES_EXPORTER !== "none",
  };
}
