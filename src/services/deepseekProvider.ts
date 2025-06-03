#!/usr/bin/env bun
import OpenAI from "openai";
import { getVariableInstructions } from "../utils/jsonParser.ts";
import { logger } from "../utils/logger.ts";
import { telemetry } from "../utils/telemetry.ts";
import type { ProviderConfig, TranslationContext, TranslationService } from "./translator.ts";

/**
 * DeepSeek-specific configuration.
 */
export interface DeepSeekConfig extends ProviderConfig {
  model?: string; // defaults to 'deepseek-chat'
  temperature?: number; // defaults to 0.1 for consistent translations
  client?: OpenAI; // Optional client for testing
}

/**
 * DeepSeek V3 translation service using OpenAI-compatible API.
 */
export class DeepSeekProvider implements TranslationService {
  private client: OpenAI;
  private config: DeepSeekConfig;
  private totalInputTokens = 0;
  private totalOutputTokens = 0;

  constructor(config: DeepSeekConfig) {
    this.config = {
      model: "deepseek-chat", // DeepSeek V3 model
      temperature: 0.1,
      timeout: 30000,
      maxRetries: 3,
      baseURL: "https://api.deepseek.com", // DeepSeek API endpoint
      ...config,
    };

    // Use provided client for testing or create new one
    this.client =
      config.client ||
      new OpenAI({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseURL,
        timeout: this.config.timeout,
        maxRetries: this.config.maxRetries,
      });
  }

  async translateBatch(
    sourceLang: string,
    targetLang: string,
    texts: string[],
    context: TranslationContext = {},
  ): Promise<Map<string, string>> {
    if (texts.length === 0) {
      return new Map();
    }

    const startTime = Date.now();
    const maxRetries = this.config.maxRetries || 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const prompt = this.buildPrompt(sourceLang, targetLang, texts, context);

        const response = await this.client.chat.completions.create({
          model: this.config.model || "deepseek-chat",
          messages: [{ role: "user", content: prompt }],
          temperature: this.config.temperature,
          max_tokens: this.calculateMaxTokens(texts),
        });

        // Track usage
        const inputTokens = response.usage?.prompt_tokens || 0;
        const outputTokens = response.usage?.completion_tokens || 0;
        this.totalInputTokens += inputTokens;
        this.totalOutputTokens += outputTokens;

        const result = this.parseResponse(texts, response.choices[0]?.message?.content || "");

        // Record telemetry for successful translation
        telemetry.recordTranslation({
          provider: "deepseek",
          inputTokens,
          outputTokens,
          fileCount: 1,
          keyCount: texts.length,
          responseTimeMs: Date.now() - startTime,
        });

        return result;
      } catch (error) {
        lastError = this.handleError(error) as Error;

        // Record error telemetry
        telemetry.recordError("translation_error", lastError.message);

        // Don't retry on non-retryable errors
        if (this.isNonRetryableError(lastError)) {
          // Record final failure telemetry
          telemetry.recordTranslation({
            provider: "deepseek",
            inputTokens: 0,
            outputTokens: 0,
            fileCount: 1,
            keyCount: texts.length,
            responseTimeMs: Date.now() - startTime,
          });
          throw lastError;
        }

        // Exponential backoff: 1s, 2s, 4s
        if (attempt < maxRetries - 1) {
          const delay = 2 ** attempt * 1000;
          logger.debug(`Retry attempt ${attempt + 1} after ${delay}ms delay`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // Record final failure telemetry after all retries
    telemetry.recordTranslation({
      provider: "deepseek",
      inputTokens: 0,
      outputTokens: 0,
      fileCount: 1,
      keyCount: texts.length,
      responseTimeMs: Date.now() - startTime,
    });

    throw lastError || new Error("Translation failed after retries");
  }

  private buildPrompt(
    sourceLang: string,
    targetLang: string,
    texts: string[],
    context: TranslationContext,
  ): string {
    const languageNames = this.getLanguageNames(sourceLang, targetLang);
    const contextInstructions = this.buildContextInstructions(context);

    // Get variable preservation instructions based on actual content
    const variableInstructions = texts.map((text) => getVariableInstructions(text)).filter(Boolean);
    const uniqueInstructions = [...new Set(variableInstructions)].join("\n");

    return `You are a professional translator. Translate the following texts from ${languageNames.source} to ${languageNames.target}.

${contextInstructions}

CRITICAL REQUIREMENTS:
- Preserve ALL variables and placeholders EXACTLY as they appear in the source
- Maintain the same formatting (line breaks, spacing, indentation)
- Return translations in the same order as input
- Be culturally appropriate for the target language
- Do not add explanations or comments
- Each line of output should correspond to one input text

${uniqueInstructions ? `VARIABLE PRESERVATION:\n${uniqueInstructions}\n` : ""}

Input texts (one per line):
${texts.map((text, i) => `${i + 1}. ${text}`).join("\n")}

Output format (one translation per line, same order, no numbers):`;
  }

  private buildContextInstructions(context: TranslationContext): string {
    const instructions: string[] = [];

    // Add custom instructions first (from refined project description)
    if (context.customInstructions) {
      instructions.push(context.customInstructions);
    }

    // Legacy structured context (for backward compatibility)
    if (context.domain) {
      const domainMap: Record<string, string> = {
        technical: "Use technical terminology and precise language.",
        marketing: "Use engaging, persuasive language suitable for marketing.",
        ui: "Use concise, clear language suitable for user interfaces.",
        legal: "Use formal, precise legal terminology.",
        medical: "Use appropriate medical terminology.",
      };

      if (domainMap[context.domain]) {
        instructions.push(domainMap[context.domain]);
      }
    }

    if (context.tone) {
      const toneMap: Record<string, string> = {
        formal: "Use formal, professional language.",
        casual: "Use casual, friendly language.",
        professional: "Use business-professional language.",
        conversational: "Use natural, conversational language.",
      };

      if (toneMap[context.tone]) {
        instructions.push(toneMap[context.tone]);
      }
    }

    if (context.preserveVariables !== false) {
      instructions.push("CRITICAL: Preserve ALL variables in {$variable} format exactly.");
    }

    if (context.preserveLength) {
      instructions.push(
        "CRITICAL: You MUST match the character length of the original text as closely as possible.",
        "UI elements have strict space constraints - translations that are too long or too short will break the interface.",
        "Work creatively to find translations that fit the exact same space (character count).",
        "If impossible to match exactly, prioritize staying within the original length rather than expanding.",
      );
    }

    if (context.maxLength) {
      instructions.push(`CRITICAL: Keep translations under ${context.maxLength} characters.`);
    }

    return instructions.length > 0 ? `CONTEXT:\n${instructions.join("\n\n")}\n` : "";
  }

  private getLanguageNames(
    sourceLang: string,
    targetLang: string,
  ): { source: string; target: string } {
    const languageMap: Record<string, string> = {
      en: "English",
      es: "Spanish",
      fr: "French",
      de: "German",
      it: "Italian",
      pt: "Portuguese",
      ru: "Russian",
      ja: "Japanese",
      ko: "Korean",
      zh: "Chinese",
      ar: "Arabic",
      hi: "Hindi",
      nl: "Dutch",
      sv: "Swedish",
      no: "Norwegian",
      da: "Danish",
      fi: "Finnish",
      pl: "Polish",
      cs: "Czech",
      hu: "Hungarian",
      tr: "Turkish",
    };

    return {
      source: languageMap[sourceLang] || sourceLang,
      target: languageMap[targetLang] || targetLang,
    };
  }

  private calculateMaxTokens(texts: string[]): number {
    // Rough estimation: average text length * 1.5 (for expansion) * 1.3 (token ratio)
    const totalChars = texts.reduce((sum, text) => sum + text.length, 0);
    const estimatedTokens = Math.ceil(totalChars * 1.5 * 1.3);

    // Ensure reasonable bounds
    return Math.max(500, Math.min(4000, estimatedTokens));
  }

  private parseResponse(originalTexts: string[], response: string): Map<string, string> {
    const result = new Map<string, string>();

    // Split response into lines and clean up
    const lines = response
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    // Match each original text with its translation
    for (let i = 0; i < originalTexts.length; i++) {
      const originalText = originalTexts[i];
      const translation = lines[i] || "";

      if (translation) {
        // Clean up any numbering or formatting artifacts
        const cleanTranslation = translation
          .replace(/^\d+\.\s*/, "") // Remove leading numbers
          .replace(/^[-*]\s*/, "") // Remove bullet points
          .trim();

        result.set(originalText, cleanTranslation);
      } else {
        // Fallback if translation is missing
        result.set(originalText, "[Translation unavailable]");
      }
    }

    return result;
  }

  private handleError(error: unknown): Error {
    if (error instanceof Error) {
      // Handle DeepSeek-specific errors (similar to OpenAI API)
      if (error.message.includes("401")) {
        return new Error("DeepSeek API authentication failed. Please check your API key.");
      }

      if (error.message.includes("429")) {
        return new Error("DeepSeek API rate limit exceeded. Please try again later.");
      }

      if (error.message.includes("400")) {
        return new Error("DeepSeek API request invalid. Please check your input.");
      }

      if (error.message.includes("timeout")) {
        return new Error("DeepSeek API request timed out. Please try again.");
      }

      // Return original error for other cases
      return error;
    }

    return new Error(`DeepSeek translation failed: ${String(error)}`);
  }

  private isNonRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Don't retry authentication failures
    if (message.includes("401") || message.includes("authentication")) {
      return true;
    }

    // Don't retry invalid requests
    if (message.includes("400") || message.includes("invalid")) {
      return true;
    }

    // Retry rate limits, timeouts, and network errors
    return false;
  }

  getUsageStats(): { inputTokens: number; outputTokens: number } {
    return {
      inputTokens: this.totalInputTokens,
      outputTokens: this.totalOutputTokens,
    };
  }
}
