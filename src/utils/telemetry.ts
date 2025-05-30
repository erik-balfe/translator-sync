#!/usr/bin/env bun
import { type Span, metrics, trace } from "@opentelemetry/api";
import type { TranslatorConfig } from "../config/configLoader.ts";
import { logger } from "./logger.ts";

/**
 * Privacy-first telemetry system for TranslatorSync.
 *
 * PRIVACY PRINCIPLES:
 * - Zero user identification (no IPs, UUIDs, or fingerprinting)
 * - Content-blind (never collects actual translation text)
 * - Opt-out by default with transparent disclosure
 * - Minimal data collection for product improvement only
 *
 * COLLECTED DATA (ALL ANONYMOUS):
 * - Usage patterns: commands used, session timing
 * - Performance: token counts, response times, error types
 * - Resource usage: costs, cache rates, provider usage
 * - Optional feedback: satisfaction scores, sanitized comments
 */

interface TelemetryConfig {
  enabled: boolean;
  endpoint?: string;
  headers?: Record<string, string>;
}

interface SessionMetrics {
  sessionId: string; // Random UUID per session, not tied to user
  startTime: Date;
  commands: string[];
  translations: {
    totalFiles: number;
    totalKeys: number;
    inputTokens: number;
    outputTokens: number;
    provider: string;
    cacheHits: number;
    cacheMisses: number;
  };
  errors: {
    type: string;
    count: number;
  }[];
}

class TelemetryCollector {
  private tracer = trace.getTracer("translator-sync");
  private meter = metrics.getMeter("translator-sync");
  private config: TelemetryConfig;
  private session: SessionMetrics;
  private isEnabled = false;

  // Metrics
  private sessionCounter = this.meter.createCounter("sessions_total", {
    description: "Total number of sessions started",
  });

  private translationCounter = this.meter.createCounter("translations_total", {
    description: "Total number of translations performed",
  });

  private tokenHistogram = this.meter.createHistogram("tokens_processed", {
    description: "Number of tokens processed per operation",
    unit: "tokens",
  });

  private responseTimeHistogram = this.meter.createHistogram("api_response_time", {
    description: "API response time in milliseconds",
    unit: "ms",
  });

  private errorCounter = this.meter.createCounter("errors_total", {
    description: "Total number of errors by type",
  });

  constructor(config: TelemetryConfig) {
    this.config = config;
    this.isEnabled = config.enabled;

    // Create new session with random ID (not user-identifiable)
    this.session = {
      sessionId: this.generateSessionId(),
      startTime: new Date(),
      commands: [],
      translations: {
        totalFiles: 0,
        totalKeys: 0,
        inputTokens: 0,
        outputTokens: 0,
        provider: "",
        cacheHits: 0,
        cacheMisses: 0,
      },
      errors: [],
    };

    if (this.isEnabled) {
      logger.debug("Telemetry enabled with privacy-first collection");
      this.recordSessionStart();
    } else {
      logger.debug("Telemetry disabled");
    }
  }

  /**
   * Generate a random session ID (not user-identifiable).
   */
  private generateSessionId(): string {
    return `sess_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Record the start of a new session.
   */
  private recordSessionStart(): void {
    if (!this.isEnabled) return;

    this.sessionCounter.add(1, {
      version: process.env.npm_package_version || "unknown",
      platform: process.platform,
      node_version: process.version,
    });

    logger.debug(`Session started: ${this.session.sessionId}`);
  }

  /**
   * Record a command execution.
   */
  recordCommand(command: string): Span {
    const span = this.tracer.startSpan("command.execute", {
      attributes: {
        "command.name": command,
        "session.id": this.session.sessionId,
      },
    });

    if (this.isEnabled) {
      this.session.commands.push(command);
      logger.debug(`Command recorded: ${command}`);
    }

    return span;
  }

  /**
   * Record translation operation (no actual content).
   */
  recordTranslation(metrics: {
    provider: string;
    inputTokens: number;
    outputTokens: number;
    fileCount: number;
    keyCount: number;
    responseTimeMs: number;
    cacheHit?: boolean;
  }): void {
    if (!this.isEnabled) return;

    // Update session metrics
    this.session.translations.totalFiles += metrics.fileCount;
    this.session.translations.totalKeys += metrics.keyCount;
    this.session.translations.inputTokens += metrics.inputTokens;
    this.session.translations.outputTokens += metrics.outputTokens;
    this.session.translations.provider = metrics.provider;

    if (metrics.cacheHit !== undefined) {
      if (metrics.cacheHit) {
        this.session.translations.cacheHits++;
      } else {
        this.session.translations.cacheMisses++;
      }
    }

    // Record OpenTelemetry metrics
    this.translationCounter.add(1, {
      provider: metrics.provider,
    });

    this.tokenHistogram.record(metrics.inputTokens + metrics.outputTokens, {
      token_type: "total",
      provider: metrics.provider,
    });

    this.responseTimeHistogram.record(metrics.responseTimeMs, {
      provider: metrics.provider,
    });

    logger.debug(
      `Translation recorded: ${metrics.keyCount} keys, ${metrics.inputTokens + metrics.outputTokens} tokens`,
    );
  }

  /**
   * Record an error (type only, no user data).
   */
  recordError(errorType: string, details?: string): void {
    if (!this.isEnabled) return;

    // Sanitize error details to remove any user data
    const sanitizedDetails = this.sanitizeErrorDetails(details);

    const existing = this.session.errors.find((e) => e.type === errorType);
    if (existing) {
      existing.count++;
    } else {
      this.session.errors.push({ type: errorType, count: 1 });
    }

    this.errorCounter.add(1, {
      error_type: errorType,
      details: sanitizedDetails,
    });

    logger.debug(`Error recorded: ${errorType}`);
  }

  /**
   * Sanitize error details to ensure no user data is included.
   */
  private sanitizeErrorDetails(details?: string): string {
    if (!details) return "none";

    // Remove potential user data patterns
    return details
      .replace(/\/[^\/\s]+\/[^\/\s]+/g, "/***/***/") // file paths
      .replace(/sk-[a-zA-Z0-9]{48}/g, "sk-***") // API keys
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "***@***.***") // emails
      .replace(/"[^"]*"/g, '"***"') // quoted strings that might contain user data
      .substring(0, 200); // limit length
  }

  /**
   * Record user satisfaction feedback.
   */
  recordFeedback(score: number, comment?: string): void {
    if (!this.isEnabled) return;

    const sanitizedComment = comment ? this.sanitizeFeedback(comment) : undefined;

    const span = this.tracer.startSpan("feedback.submit", {
      attributes: {
        "feedback.score": score,
        "feedback.has_comment": Boolean(sanitizedComment),
        "session.id": this.session.sessionId,
      },
    });

    // Store aggregated feedback without user identification
    this.meter.createHistogram("user_satisfaction").record(score);

    if (sanitizedComment) {
      logger.debug(`Feedback recorded: score=${score}, comment length=${sanitizedComment.length}`);
    } else {
      logger.debug(`Feedback recorded: score=${score}`);
    }

    span.end();
  }

  /**
   * Sanitize feedback to ensure no personal information.
   */
  private sanitizeFeedback(comment: string): string {
    // Remove potential personal information
    return comment
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]") // emails
      .replace(
        /\b(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9][-a-zA-Z0-9]{0,62}(?:\.[a-zA-Z]{2,})+(?:\/[^\s]*)?\b/g,
        "[url]",
      ) // URLs
      .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[ip]") // IP addresses
      .replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, "[name]") // likely names
      .substring(0, 500); // limit length
  }

  /**
   * End the session and send final metrics.
   */
  async endSession(): Promise<void> {
    if (!this.isEnabled) return;

    const sessionDuration = Date.now() - this.session.startTime.getTime();

    const span = this.tracer.startSpan("session.end", {
      attributes: {
        "session.id": this.session.sessionId,
        "session.duration_ms": sessionDuration,
        "session.commands_count": this.session.commands.length,
        "session.translations_count": this.session.translations.totalKeys,
        "session.total_tokens":
          this.session.translations.inputTokens + this.session.translations.outputTokens,
        "session.cache_hit_rate":
          this.session.translations.cacheHits /
            (this.session.translations.cacheHits + this.session.translations.cacheMisses) || 0,
      },
    });

    logger.debug(`Session ended: ${this.session.sessionId}, duration: ${sessionDuration}ms`);
    span.end();

    // Give OpenTelemetry time to flush
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  /**
   * Disable telemetry (user opt-out).
   */
  disable(): void {
    this.isEnabled = false;
    this.config.enabled = false;
    logger.info("Telemetry disabled by user");
  }

  /**
   * Check if telemetry is enabled.
   */
  isCollectionEnabled(): boolean {
    return this.isEnabled;
  }
}

// Global telemetry instance
let telemetryInstance: TelemetryCollector | null = null;

/**
 * Initialize telemetry system.
 */
export function initializeTelemetry(config: TranslatorConfig): TelemetryCollector {
  const telemetryConfig: TelemetryConfig = {
    enabled: config.options?.enableTelemetry !== false, // opt-out by default
    endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    headers: process.env.GRAFANA_TOKEN
      ? {
          Authorization: `Bearer ${process.env.GRAFANA_TOKEN}`,
        }
      : undefined,
  };

  telemetryInstance = new TelemetryCollector(telemetryConfig);
  return telemetryInstance;
}

/**
 * Get current telemetry instance.
 */
export function getTelemetry(): TelemetryCollector | null {
  return telemetryInstance;
}

/**
 * Helper functions for easy usage throughout the app.
 */
export const telemetry = {
  recordCommand: (command: string) => telemetryInstance?.recordCommand(command),
  recordTranslation: (metrics: Parameters<TelemetryCollector["recordTranslation"]>[0]) =>
    telemetryInstance?.recordTranslation(metrics),
  recordError: (errorType: string, details?: string) =>
    telemetryInstance?.recordError(errorType, details),
  recordFeedback: (score: number, comment?: string) =>
    telemetryInstance?.recordFeedback(score, comment),
  endSession: () => telemetryInstance?.endSession(),
  disable: () => telemetryInstance?.disable(),
  isEnabled: () => telemetryInstance?.isCollectionEnabled() ?? false,
};
