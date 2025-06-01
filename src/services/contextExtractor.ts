#!/usr/bin/env bun
import {
  FALLBACK_QUALITY_SCORE,
  MIN_DESCRIPTION_LENGTH,
  QUALITY_SCORE_EXCELLENT,
  QUALITY_SCORE_MAX,
  QUALITY_SCORE_THRESHOLD,
} from "../config/constants.ts";
import { logger } from "../utils/logger.ts";
import type { TranslationService } from "./translator.ts";

/**
 * Context refinement result.
 */
export interface RefinedContext {
  refinedDescription: string; // LLM-refined description with only translation-relevant info
  qualityScore: number; // 1-10 score of description usefulness for translation
  suggestions?: string; // What would improve the description
}

/**
 * Service for refining project descriptions and evaluating their quality for translation context.
 */
export class ContextExtractor {
  private translationService: TranslationService;

  constructor(translationService: TranslationService) {
    this.translationService = translationService;
  }

  /**
   * Refine and evaluate project description for translation context.
   */
  async refineProjectDescription(rawDescription: string): Promise<RefinedContext> {
    if (!rawDescription || rawDescription.trim().length < MIN_DESCRIPTION_LENGTH) {
      return {
        refinedDescription: "",
        qualityScore: 0,
        suggestions:
          "Project description is empty. Please provide information about your project's purpose, target audience, and type of content (UI, documentation, marketing, etc.)",
      };
    }

    try {
      const prompt = this.buildRefinementPrompt(rawDescription);
      const response = await this.translationService.translateBatch(
        "en",
        "en", // Same language to get refined output
        [prompt],
        { preserveVariables: false },
      );

      const responseText = response.get(prompt) || "";
      return this.parseRefinementResponse(responseText, rawDescription);
    } catch (error) {
      logger.warn(`Description refinement failed: ${error}`);
      return {
        refinedDescription: rawDescription,
        qualityScore: FALLBACK_QUALITY_SCORE,
        suggestions: "Could not evaluate description quality due to API error",
      };
    }
  }

  /**
   * Build refinement prompt for LLM.
   */
  private buildRefinementPrompt(rawDescription: string): string {
    return `Analyze this project description and refine it to contain only information useful for translation context:

RAW DESCRIPTION:
"${rawDescription}"

Your task:
1. Extract ONLY the information relevant for translation quality and context
2. Focus on: project type, target audience, content style, domain/industry, tone expectations
3. Remove: technical implementation details, version numbers, installation instructions, etc.
4. Rate the overall usefulness of the original description for translation context (1-10)
5. Suggest improvements if the score is below 7

Respond in this EXACT JSON format:
{
  "refinedDescription": "Refined description with only translation-relevant context",
  "qualityScore": 8,
  "suggestions": "Optional suggestions for improvement"
}

Examples of good refined descriptions:
- "Web-based customer support chat interface for e-commerce, casual friendly tone for end users"
- "Internal enterprise dashboard for data analytics, professional technical language for business users"  
- "Marketing website for AI startup, engaging persuasive content for potential customers"
- "Medical patient portal interface, clear accessible language following healthcare regulations"

The refined description should help a translator understand what type of language, tone, and terminology to use.

JSON only:`;
  }

  /**
   * Parse LLM response into refined context.
   */
  private parseRefinementResponse(response: string, fallbackDescription: string): RefinedContext {
    try {
      // Clean response and extract JSON
      const cleanResponse = response.trim().replace(/```json\s*|\s*```/g, "");
      const parsed = JSON.parse(cleanResponse);

      const qualityScore = Math.max(
        0,
        Math.min(QUALITY_SCORE_MAX, Number(parsed.qualityScore) || 0),
      );

      return {
        refinedDescription: parsed.refinedDescription || fallbackDescription,
        qualityScore,
        suggestions: parsed.suggestions || undefined,
      };
    } catch (error) {
      logger.debug(`Failed to parse refinement response: ${error}`);
      logger.debug(`Response was: ${response}`);

      // Fallback: Analyze the raw description quality heuristically
      return this.evaluateDescriptionHeuristically(fallbackDescription);
    }
  }

  /**
   * Fallback heuristic evaluation when LLM parsing fails.
   */
  private evaluateDescriptionHeuristically(description: string): RefinedContext {
    const lower = description.toLowerCase();
    let score = 5; // Start with middle score

    // Positive indicators
    if (lower.includes("ui") || lower.includes("interface") || lower.includes("website"))
      score += 1;
    if (lower.includes("user") || lower.includes("customer") || lower.includes("audience"))
      score += 1;
    if (lower.includes("dashboard") || lower.includes("portal") || lower.includes("platform"))
      score += 1;
    if (lower.includes("professional") || lower.includes("casual") || lower.includes("formal"))
      score += 1;
    if (lower.includes("marketing") || lower.includes("technical") || lower.includes("medical"))
      score += 1;

    // Negative indicators
    if (lower.includes("install") || lower.includes("setup") || lower.includes("config"))
      score -= 1;
    if (lower.includes("version") || lower.includes("update") || lower.includes("changelog"))
      score -= 1;
    if (description.length < 20) score -= 2;
    if (description.length > 500) score -= 1;

    score = Math.max(1, Math.min(QUALITY_SCORE_MAX, score));

    let suggestions: string | undefined;
    if (score < 7) {
      suggestions =
        "Consider adding: project type (UI/docs/marketing), target audience (end-users/developers/business), and content tone (professional/casual/technical)";
    }

    logger.debug(`Heuristic evaluation: score=${score}`);

    return {
      refinedDescription: description, // Use as-is since LLM failed
      qualityScore: score,
      suggestions,
    };
  }

  /**
   * Validate if description quality is sufficient for good translations.
   */
  static isQualitySufficient(
    context: RefinedContext,
    threshold: number = QUALITY_SCORE_THRESHOLD,
  ): boolean {
    return context.qualityScore >= threshold;
  }

  /**
   * Format quality assessment for user display.
   */
  static formatQualityAssessment(context: RefinedContext): string {
    const scoreEmoji =
      context.qualityScore >= QUALITY_SCORE_EXCELLENT
        ? "🟢"
        : context.qualityScore >= QUALITY_SCORE_THRESHOLD
          ? "🟡"
          : "🔴";

    let message = `${scoreEmoji} Description quality: ${context.qualityScore}/10`;

    if (context.suggestions) {
      message += `\n💡 Suggestions: ${context.suggestions}`;
    }

    return message;
  }
}
