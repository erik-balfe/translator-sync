#!/usr/bin/env bun

/**
 * Environment types.
 */
export type Environment = "development" | "test" | "staging" | "production";

/**
 * Get current environment.
 */
export function getEnvironment(): Environment {
  const env = process.env.NODE_ENV || process.env.BUN_ENV || "development";

  switch (env.toLowerCase()) {
    case "production":
    case "prod":
      return "production";
    case "staging":
    case "stage":
      return "staging";
    case "test":
    case "testing":
      return "test";
    default:
      return "development";
  }
}

/**
 * Check if running in production.
 */
export function isProduction(): boolean {
  return getEnvironment() === "production";
}

/**
 * Check if running in development.
 */
export function isDevelopment(): boolean {
  return getEnvironment() === "development";
}

/**
 * Check if running in test.
 */
export function isTest(): boolean {
  return getEnvironment() === "test";
}

/**
 * Environment-specific configuration.
 */
export interface EnvironmentConfig {
  /** Whether to allow mock services */
  allowMockServices: boolean;
  /** Default log level */
  logLevel: "debug" | "info" | "warn" | "error";
  /** Whether to validate API responses strictly */
  strictValidation: boolean;
  /** Whether to show detailed error messages */
  verboseErrors: boolean;
  /** Default timeout for API calls */
  defaultTimeout: number;
  /** Whether to enable cost tracking */
  trackCosts: boolean;
}

/**
 * Get configuration for current environment.
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const env = getEnvironment();

  switch (env) {
    case "production":
      return {
        allowMockServices: false,
        logLevel: "info",
        strictValidation: true,
        verboseErrors: false,
        defaultTimeout: 30000,
        trackCosts: true,
      };

    case "staging":
      return {
        allowMockServices: false,
        logLevel: "info",
        strictValidation: true,
        verboseErrors: true,
        defaultTimeout: 30000,
        trackCosts: true,
      };

    case "test":
      return {
        allowMockServices: true,
        logLevel: "error",
        strictValidation: false,
        verboseErrors: true,
        defaultTimeout: 5000,
        trackCosts: false,
      };
    default:
      return {
        allowMockServices: true,
        logLevel: "debug",
        strictValidation: false,
        verboseErrors: true,
        defaultTimeout: 60000,
        trackCosts: true,
      };
  }
}
