#!/usr/bin/env bun
import { logger } from "./logger.ts";

/**
 * Pricing information for different LLM providers and models.
 * All prices are in USD per 1M tokens.
 */
export interface ModelPricing {
  inputPrice: number; // USD per 1M input tokens
  outputPrice: number; // USD per 1M output tokens
}

/**
 * Usage statistics for cost calculation.
 */
export interface UsageStats {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Cost calculation result.
 */
export interface CostResult {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
}

/**
 * Pricing database for supported models.
 */
const MODEL_PRICING: Record<string, ModelPricing> = {
  // Primary Models (Recommended)
  "gpt-4.1-nano": { inputPrice: 0.15, outputPrice: 0.6 }, // Best quality/cost balance
  "deepseek-v3": { inputPrice: 0.14, outputPrice: 0.28 }, // Budget-friendly option

  // Development/Testing
  "llama-4-maverick": { inputPrice: 0.05, outputPrice: 0.1 }, // Cheapest option

  // Legacy/Compatibility (kept for backward compatibility)
  "gpt-4o-mini": { inputPrice: 0.15, outputPrice: 0.6 },
  "deepseek-chat": { inputPrice: 0.14, outputPrice: 0.28 }, // Alias for deepseek-v3
  "deepseek-v2": { inputPrice: 0.14, outputPrice: 0.28 },
  "gpt-3.5-turbo": { inputPrice: 0.5, outputPrice: 1.5 },
  "gpt-3.5-turbo-0125": { inputPrice: 0.5, outputPrice: 1.5 },

  // Premium Options (when quality is paramount)
  "gpt-4o": { inputPrice: 5.0, outputPrice: 15.0 },
  "claude-3.5-sonnet": { inputPrice: 3.0, outputPrice: 15.0 },

  // Other models (less relevant for translation)
  "llama-3-70b": { inputPrice: 0.59, outputPrice: 0.79 },
  "llama-3-70b-8192": { inputPrice: 0.59, outputPrice: 0.79 },
  "llama-3-8b": { inputPrice: 0.05, outputPrice: 0.1 },
  "llama-3-8b-8192": { inputPrice: 0.05, outputPrice: 0.1 },
  "mixtral-8x7b": { inputPrice: 0.27, outputPrice: 0.27 },
  "mixtral-8x7b-32768": { inputPrice: 0.27, outputPrice: 0.27 },
};

/**
 * Calculate the cost of API usage based on token consumption.
 */
export function calculateCost(model: string, usage: UsageStats): CostResult {
  const pricing = MODEL_PRICING[model];

  if (!pricing) {
    logger.warn(`Unknown model for pricing: ${model}. Using default pricing.`);
    // Use gpt-4.1-nano pricing as default
    const defaultPricing = MODEL_PRICING["gpt-4.1-nano"];
    return calculateWithPricing(defaultPricing, usage);
  }

  return calculateWithPricing(pricing, usage);
}

/**
 * Calculate cost with specific pricing.
 */
function calculateWithPricing(pricing: ModelPricing, usage: UsageStats): CostResult {
  const inputCost = (usage.promptTokens / 1_000_000) * pricing.inputPrice;
  const outputCost = (usage.completionTokens / 1_000_000) * pricing.outputPrice;
  const totalCost = inputCost + outputCost;

  return {
    inputCost,
    outputCost,
    totalCost,
    currency: "USD",
  };
}

/**
 * Estimate token count from text (rough approximation).
 * Generally, 1 token ≈ 4 characters for English text.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimate cost for a translation request before making the API call.
 */
export function estimateTranslationCost(
  model: string,
  sourceTexts: string[],
  targetLanguage = "es",
): CostResult {
  const totalSourceLength = sourceTexts.reduce((sum, text) => sum + text.length, 0);

  // Estimate input tokens (source text + prompt overhead)
  const promptOverhead = 200; // Estimated prompt tokens
  const estimatedInputTokens = estimateTokens(sourceTexts.join(" ")) + promptOverhead;

  // Estimate output tokens (typically 1.1x source for similar languages)
  const expansionFactor = getLanguageExpansionFactor(targetLanguage);
  const estimatedOutputTokens = Math.ceil(estimatedInputTokens * expansionFactor);

  const usage: UsageStats = {
    promptTokens: estimatedInputTokens,
    completionTokens: estimatedOutputTokens,
    totalTokens: estimatedInputTokens + estimatedOutputTokens,
  };

  return calculateCost(model, usage);
}

/**
 * Get the typical expansion factor for different target languages.
 */
function getLanguageExpansionFactor(targetLang: string): number {
  const expansionFactors: Record<string, number> = {
    // Romance languages (similar length to English)
    es: 1.1, // Spanish
    fr: 1.15, // French
    it: 1.1, // Italian
    pt: 1.1, // Portuguese

    // Germanic languages
    de: 1.25, // German (longer compound words)
    nl: 1.15, // Dutch

    // Asian languages (often shorter due to character density)
    ja: 0.8, // Japanese
    ko: 0.9, // Korean
    zh: 0.7, // Chinese

    // Other languages
    ru: 1.2, // Russian
    ar: 1.0, // Arabic
    hi: 1.1, // Hindi
  };

  return expansionFactors[targetLang] || 1.1; // Default expansion
}

/**
 * Get pricing information for a specific model.
 */
export function getModelPricing(model: string): ModelPricing | null {
  return MODEL_PRICING[model] || null;
}

/**
 * Get all available models with their pricing.
 */
export function getAllModelPricing(): Record<string, ModelPricing> {
  return { ...MODEL_PRICING };
}

/**
 * Find the cheapest model among available options.
 */
export function findCheapestModel(models: string[]): string | null {
  let cheapestModel: string | null = null;
  let lowestCost = Number.POSITIVE_INFINITY;

  for (const model of models) {
    const pricing = MODEL_PRICING[model];
    if (pricing) {
      // Use average of input and output price for comparison
      const avgCost = (pricing.inputPrice + pricing.outputPrice) / 2;
      if (avgCost < lowestCost) {
        lowestCost = avgCost;
        cheapestModel = model;
      }
    }
  }

  return cheapestModel;
}

/**
 * Format cost for display.
 */
export function formatCost(cost: CostResult): string {
  if (cost.totalCost < 0.001) {
    return `$${(cost.totalCost * 1000).toFixed(3)}‰`; // Show in per-mille for very small costs
  }
  if (cost.totalCost < 0.01) {
    return `$${cost.totalCost.toFixed(4)}`;
  }
  return `$${cost.totalCost.toFixed(3)}`;
}
