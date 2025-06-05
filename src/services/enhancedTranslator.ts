#!/usr/bin/env bun
import { logger } from "../utils/logger.ts";
import { ContextExtractor, type RefinedContext } from "./contextExtractor.ts";
import type { TranslationContext, TranslationService } from "./translator.ts";

/**
 * Enhanced translator that uses refined project descriptions for better translation context.
 */
export class EnhancedTranslator {
  private translationService: TranslationService;
  private contextExtractor: ContextExtractor;

  constructor(translationService: TranslationService) {
    this.translationService = translationService;
    this.contextExtractor = new ContextExtractor(translationService);
  }

  /**
   * Translate with context derived from refined project description.
   */
  async translateWithContext(
    sourceLang: string,
    targetLang: string,
    texts: string[],
    refinedDescription?: string,
    existingContext?: TranslationContext,
  ): Promise<Map<string, string>> {
    if (texts.length === 0) {
      return new Map();
    }

    // Build context instructions from refined description
    const contextInstructions = this.buildContextInstructions(refinedDescription);

    if (contextInstructions) {
      logger.debug(`Using project context: ${contextInstructions.slice(0, 100)}...`);
    }

    // Merge existing context with new context instructions
    const combinedInstructions = [existingContext?.customInstructions, contextInstructions]
      .filter(Boolean)
      .join("\n\n");

    // Create dynamic translation context
    const translationContext = {
      preserveVariables: true,
      ...existingContext, // Spread existing context first
      // Add/override custom instructions
      customInstructions: combinedInstructions || existingContext?.customInstructions,
    };

    // Perform translation with context
    return await this.translationService.translateBatch(
      sourceLang,
      targetLang,
      texts,
      translationContext,
    );
  }

  /**
   * Build context instructions from refined description.
   */
  private buildContextInstructions(refinedDescription?: string): string | undefined {
    if (!refinedDescription || refinedDescription.trim().length < 10) {
      return undefined;
    }

    return `PROJECT CONTEXT: ${refinedDescription}

Based on this project context, adapt your translations to match the appropriate:
- Language style and tone
- Target audience expectations  
- Domain-specific terminology
- Professional vs casual language
- Length constraints for UI elements
- Cultural and contextual appropriateness

The translations should feel natural and appropriate for this specific project type and audience.`;
  }

  /**
   * Refine a raw project description for translation context.
   */
  async refineDescription(rawDescription: string): Promise<RefinedContext> {
    return await this.contextExtractor.refineProjectDescription(rawDescription);
  }

  /**
   * Standard translateBatch method that forwards to translateWithContext.
   */
  async translateBatch(
    sourceLang: string,
    targetLang: string,
    texts: string[],
    context?: TranslationContext,
  ): Promise<Map<string, string>> {
    return this.translateWithContext(sourceLang, targetLang, texts, undefined, context);
  }

  /**
   * Forward usage stats from underlying service.
   */
  getUsageStats(): { inputTokens: number; outputTokens: number } {
    const stats = this.translationService.getUsageStats?.();
    return stats || { inputTokens: 0, outputTokens: 0 };
  }
}
