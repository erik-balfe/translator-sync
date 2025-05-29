#!/usr/bin/env bun
import { telemetry } from "../utils/telemetry";

/**
 * Context for translation requests to provide additional guidance.
 */
export interface TranslationContext {
  domain?: string; // e.g., 'technical', 'marketing', 'ui'
  tone?: string; // e.g., 'formal', 'casual', 'professional'
  preserveVariables?: boolean; // Maintain FTL variables like {$username}
  maxLength?: number; // Response length constraints
}

/**
 * TranslationService defines the interface for translation providers.
 */
export interface TranslationService {
  translateBatch(
    sourceLang: string,
    targetLang: string,
    texts: string[],
    context?: TranslationContext,
  ): Promise<Map<string, string>>;

  getUsageStats?(): { inputTokens: number; outputTokens: number };
}

/**
 * Configuration for translation service providers.
 */
export interface ProviderConfig {
  apiKey: string;
  model?: string;
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;
}

/**
 * A mock implementation of TranslationService.
 * It returns a map with "translated: " prepended to each input text.
 */
export class MockTranslationService implements TranslationService {
  async translateBatch(
    sourceLang: string,
    targetLang: string,
    texts: string[],
    context?: TranslationContext,
  ): Promise<Map<string, string>> {
    const startTime = Date.now();
    const result = new Map<string, string>();

    for (const text of texts) {
      result.set(text, `translated: ${text}`);
    }

    // Record telemetry for mock translation
    telemetry.recordTranslation({
      provider: "mock",
      inputTokens: 0, // Mock service doesn't use tokens
      outputTokens: 0,
      fileCount: 1,
      keyCount: texts.length,
      responseTimeMs: Date.now() - startTime,
    });

    return result;
  }
}
