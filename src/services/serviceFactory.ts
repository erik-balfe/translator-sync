#!/usr/bin/env bun
import { getEnvironmentConfig } from "../config/environment.ts";
import { getProviderDefaults } from "../config/providers.ts";
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
 * Factory for creating translation service instances.
 */
export class TranslationServiceFactory {
  /**
   * Creates a translation service instance based on the configuration.
   */
  static create(config: ServiceConfig): TranslationService {
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
        // DeepSeek uses OpenAI-compatible API
        return new OpenAIProvider({
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
   * Creates a service from environment variables.
   */
  static fromEnvironment(): TranslationService {
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

    return TranslationServiceFactory.create(config);
  }

  /**
   * Gets available providers.
   */
  static getAvailableProviders(): ServiceProvider[] {
    return ["mock", "openai", "deepseek", "groq", "anthropic"];
  }

  /**
   * Validates a service configuration.
   */
  static validateConfig(config: ServiceConfig): void {
    if (!config.provider) {
      throw new Error("Provider is required");
    }

    if (!TranslationServiceFactory.getAvailableProviders().includes(config.provider)) {
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
}
