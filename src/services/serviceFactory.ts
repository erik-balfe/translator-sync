#!/usr/bin/env bun
import { getEnvironmentConfig } from "../config/environment.ts";
import { getProviderDefaults } from "../config/providers.ts";
import { DeepSeekProvider } from "./deepseekProvider.ts";
import { EnhancedTranslator } from "./enhancedTranslator.ts";
import { OpenAIProvider } from "./openaiProvider.ts";
import type { ProviderConfig, TranslationService } from "./translator.ts";
import { MockTranslationService } from "./translator.ts";

/**
 * Supported translation service providers.
 */
export type ServiceProvider = "mock" | "openai" | "deepseek" | "groq" | "anthropic";

/**
 * Configuration for creating a translation service.
 */
export interface ServiceConfig {
  provider: ServiceProvider;
  apiKey?: string;
  model?: string;
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;
}

/**
 * Creates a translation service instance based on the configuration.
 */
export function createTranslationService(config: ServiceConfig): TranslationService {
  switch (config.provider) {
    case "mock":
      return new MockTranslationService();

    case "openai": {
      if (!config.apiKey) {
        throw new Error("OpenAI API key is required");
      }
      const defaults = getProviderDefaults("openai");
      return new OpenAIProvider({
        apiKey: config.apiKey,
        model: config.model || defaults.model,
        baseURL: config.baseURL || defaults.baseURL,
        timeout: config.timeout || defaults.timeout,
        maxRetries: config.maxRetries || defaults.maxRetries,
      });
    }

    case "deepseek": {
      if (!config.apiKey) {
        throw new Error("DeepSeek API key is required");
      }
      const defaults = getProviderDefaults("deepseek");
      return new DeepSeekProvider({
        apiKey: config.apiKey,
        model: config.model || defaults.model,
        baseURL: config.baseURL || defaults.baseURL,
        timeout: config.timeout || defaults.timeout,
        maxRetries: config.maxRetries || defaults.maxRetries,
      });
    }

    case "groq": {
      if (!config.apiKey) {
        throw new Error("Groq API key is required");
      }
      const defaults = getProviderDefaults("groq");
      // Groq uses OpenAI-compatible API
      return new OpenAIProvider({
        apiKey: config.apiKey,
        model: config.model || defaults.model,
        baseURL: config.baseURL || defaults.baseURL,
        timeout: config.timeout || defaults.timeout,
        maxRetries: config.maxRetries || defaults.maxRetries,
      });
    }

    case "anthropic":
      throw new Error("Anthropic provider not yet implemented");

    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

/**
 * Creates an enhanced translator with context extraction.
 */
export function createEnhancedTranslator(config: ServiceConfig): EnhancedTranslator {
  const baseService = createTranslationService(config);
  return new EnhancedTranslator(baseService);
}

/**
 * Creates a service from environment variables.
 */
export function createFromEnvironment(): TranslationService {
  const provider = process.env.TRANSLATOR_SERVICE as ServiceProvider;

  if (!provider) {
    throw new Error(
      "TRANSLATOR_SERVICE environment variable is required. " +
        "Set it to one of: openai, deepseek, groq, or mock (for testing only)",
    );
  }

  const envConfig = getEnvironmentConfig();

  if (provider === "mock" && !envConfig.allowMockServices) {
    throw new Error(
      "Mock translation service is not allowed in this environment. " +
        "Please configure a real translation provider.",
    );
  }

  const config: ServiceConfig = {
    provider,
    apiKey: process.env.TRANSLATOR_API_KEY,
    model: process.env.TRANSLATOR_MODEL,
    baseURL: process.env.TRANSLATOR_BASE_URL,
    timeout: process.env.TRANSLATOR_TIMEOUT
      ? Number.parseInt(process.env.TRANSLATOR_TIMEOUT)
      : undefined,
    maxRetries: process.env.TRANSLATOR_MAX_RETRIES
      ? Number.parseInt(process.env.TRANSLATOR_MAX_RETRIES)
      : undefined,
  };

  return createTranslationService(config);
}

/**
 * Gets available providers.
 */
export function getAvailableProviders(): ServiceProvider[] {
  return ["mock", "openai", "deepseek", "groq", "anthropic"];
}

/**
 * Validates a service configuration.
 */
export function validateServiceConfig(config: ServiceConfig): void {
  if (!config.provider) {
    throw new Error("Provider is required");
  }

  if (!getAvailableProviders().includes(config.provider)) {
    throw new Error(`Unsupported provider: ${config.provider}`);
  }

  if (config.provider !== "mock" && !config.apiKey) {
    throw new Error(`API key is required for provider: ${config.provider}`);
  }

  if (config.timeout && config.timeout < 1000) {
    throw new Error("Timeout must be at least 1000ms");
  }

  if (config.maxRetries && config.maxRetries < 0) {
    throw new Error("Max retries must be non-negative");
  }
}

/**
 * Legacy class wrapper for backward compatibility.
 * @deprecated Use direct function imports instead
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Legacy wrapper for backward compatibility
export class TranslationServiceFactory {
  static create = createTranslationService;
  static createEnhanced = createEnhancedTranslator;
  static fromEnvironment = createFromEnvironment;
  static getAvailableProviders = getAvailableProviders;
  static validateConfig = validateServiceConfig;
}
