#!/usr/bin/env bun
import { describe, expect, it, mock } from "bun:test";
import {
  FALLBACK_QUALITY_SCORE,
  MIN_DESCRIPTION_LENGTH,
  QUALITY_SCORE_EXCELLENT,
  QUALITY_SCORE_MAX,
  QUALITY_SCORE_THRESHOLD,
} from "../../../src/config/constants.ts";
import { ContextExtractor, type RefinedContext } from "../../../src/services/contextExtractor.ts";
import type { TranslationService } from "../../../src/services/translator.ts";

/**
 * Create a mock translation service.
 */
function createMockTranslationService(): TranslationService {
  return {
    translateBatch: mock(async () => new Map()),
    getUsageStats: mock(() => ({ inputTokens: 0, outputTokens: 0 })),
  };
}

describe("ContextExtractor", () => {
  describe("refineProjectDescription", () => {
    it("should return empty result for empty description", async () => {
      const service = createMockTranslationService();
      const extractor = new ContextExtractor(service);

      const result = await extractor.refineProjectDescription("");

      expect(result.refinedDescription).toBe("");
      expect(result.qualityScore).toBe(0);
      expect(result.suggestions).toContain("empty");
      expect(service.translateBatch).not.toHaveBeenCalled();
    });

    it("should return empty result for short description", async () => {
      const service = createMockTranslationService();
      const extractor = new ContextExtractor(service);

      const result = await extractor.refineProjectDescription("abc");

      expect(result.refinedDescription).toBe("");
      expect(result.qualityScore).toBe(0);
      expect(result.suggestions).toContain("empty");
      expect(service.translateBatch).not.toHaveBeenCalled();
    });

    it("should successfully refine valid description with good quality", async () => {
      const service = createMockTranslationService();
      const mockResponse = JSON.stringify({
        refinedDescription: "E-commerce customer support chat interface with casual tone",
        qualityScore: 8,
        suggestions: null,
      });

      service.translateBatch = mock(async (from, to, texts) => {
        const map = new Map<string, string>();
        map.set(texts[0], mockResponse);
        return map;
      });

      const extractor = new ContextExtractor(service);
      const result = await extractor.refineProjectDescription(
        "This is a React-based customer support chat interface for our e-commerce platform",
      );

      expect(result.refinedDescription).toBe(
        "E-commerce customer support chat interface with casual tone",
      );
      expect(result.qualityScore).toBe(8);
      expect(result.suggestions).toBeUndefined();
      expect(service.translateBatch).toHaveBeenCalledTimes(1);
    });

    it("should handle low quality description", async () => {
      const service = createMockTranslationService();
      const mockResponse = JSON.stringify({
        refinedDescription: "Generic web application",
        qualityScore: 3,
        suggestions: "Add more specific details about your project type, audience, and tone",
      });

      service.translateBatch = mock(async (from, to, texts) => {
        const map = new Map<string, string>();
        map.set(texts[0], mockResponse);
        return map;
      });

      const extractor = new ContextExtractor(service);
      const result = await extractor.refineProjectDescription(
        "This is a web app built with modern technologies",
      );

      expect(result.refinedDescription).toBe("Generic web application");
      expect(result.qualityScore).toBe(3);
      expect(result.suggestions).toContain("specific details");
    });

    it("should handle invalid JSON response gracefully", async () => {
      const service = createMockTranslationService();
      service.translateBatch = mock(async (from, to, texts) => {
        const map = new Map<string, string>();
        map.set(texts[0], "This is not valid JSON");
        return map;
      });

      const extractor = new ContextExtractor(service);
      const rawDescription = "Marketing website for AI startup";
      const result = await extractor.refineProjectDescription(rawDescription);

      // Should fall back to heuristic evaluation
      expect(result.refinedDescription).toBe(rawDescription);
      expect(result.qualityScore).toBeGreaterThanOrEqual(1);
      expect(result.qualityScore).toBeLessThanOrEqual(QUALITY_SCORE_MAX);
    });

    it("should handle API errors gracefully", async () => {
      const service = createMockTranslationService();
      service.translateBatch = mock(async () => {
        throw new Error("API request failed");
      });

      const extractor = new ContextExtractor(service);
      const rawDescription = "Internal dashboard for analytics";
      const result = await extractor.refineProjectDescription(rawDescription);

      expect(result.refinedDescription).toBe(rawDescription);
      expect(result.qualityScore).toBe(FALLBACK_QUALITY_SCORE);
      expect(result.suggestions).toContain("API error");
    });

    it("should cap quality score at maximum", async () => {
      const service = createMockTranslationService();
      const mockResponse = JSON.stringify({
        refinedDescription: "Perfect description",
        qualityScore: 15, // Over maximum
        suggestions: null,
      });

      service.translateBatch = mock(async (from, to, texts) => {
        const map = new Map<string, string>();
        map.set(texts[0], mockResponse);
        return map;
      });

      const extractor = new ContextExtractor(service);
      const result = await extractor.refineProjectDescription("Some description");

      expect(result.qualityScore).toBe(QUALITY_SCORE_MAX);
    });

    it("should handle empty response from LLM", async () => {
      const service = createMockTranslationService();
      service.translateBatch = mock(async (from, to, texts) => {
        const map = new Map<string, string>();
        // Empty response
        return map;
      });

      const extractor = new ContextExtractor(service);
      const rawDescription = "Test description";
      const result = await extractor.refineProjectDescription(rawDescription);

      expect(result.refinedDescription).toBe(rawDescription);
      expect(result.qualityScore).toBeGreaterThanOrEqual(1);
    });
  });

  describe("isQualitySufficient", () => {
    it("should return true for excellent quality", () => {
      const context: RefinedContext = {
        refinedDescription: "Great description",
        qualityScore: QUALITY_SCORE_EXCELLENT,
      };

      expect(ContextExtractor.isQualitySufficient(context)).toBe(true);
    });

    it("should return true for threshold quality", () => {
      const context: RefinedContext = {
        refinedDescription: "Good description",
        qualityScore: QUALITY_SCORE_THRESHOLD,
      };

      expect(ContextExtractor.isQualitySufficient(context)).toBe(true);
    });

    it("should return false for low quality", () => {
      const context: RefinedContext = {
        refinedDescription: "Poor description",
        qualityScore: QUALITY_SCORE_THRESHOLD - 1,
      };

      expect(ContextExtractor.isQualitySufficient(context)).toBe(false);
    });

    it("should use custom threshold", () => {
      const context: RefinedContext = {
        refinedDescription: "Description",
        qualityScore: 8,
      };

      expect(ContextExtractor.isQualitySufficient(context, 9)).toBe(false);
      expect(ContextExtractor.isQualitySufficient(context, 7)).toBe(true);
    });
  });

  describe("formatQualityAssessment", () => {
    it("should format excellent quality with green emoji", () => {
      const context: RefinedContext = {
        refinedDescription: "Excellent",
        qualityScore: QUALITY_SCORE_EXCELLENT,
      };

      const formatted = ContextExtractor.formatQualityAssessment(context);
      expect(formatted).toContain("🟢");
      expect(formatted).toContain(`${QUALITY_SCORE_EXCELLENT}/10`);
    });

    it("should format good quality with yellow emoji", () => {
      const context: RefinedContext = {
        refinedDescription: "Good",
        qualityScore: QUALITY_SCORE_THRESHOLD,
      };

      const formatted = ContextExtractor.formatQualityAssessment(context);
      expect(formatted).toContain("🟡");
      expect(formatted).toContain(`${QUALITY_SCORE_THRESHOLD}/10`);
    });

    it("should format poor quality with red emoji", () => {
      const context: RefinedContext = {
        refinedDescription: "Poor",
        qualityScore: 3,
      };

      const formatted = ContextExtractor.formatQualityAssessment(context);
      expect(formatted).toContain("🔴");
      expect(formatted).toContain("3/10");
    });

    it("should include suggestions when available", () => {
      const context: RefinedContext = {
        refinedDescription: "Description",
        qualityScore: 4,
        suggestions: "Add more details about target audience",
      };

      const formatted = ContextExtractor.formatQualityAssessment(context);
      expect(formatted).toContain("💡 Suggestions:");
      expect(formatted).toContain("target audience");
    });

    it("should not include suggestions when not available", () => {
      const context: RefinedContext = {
        refinedDescription: "Description",
        qualityScore: 8,
      };

      const formatted = ContextExtractor.formatQualityAssessment(context);
      expect(formatted).not.toContain("💡 Suggestions:");
    });
  });

  describe("API error handling", () => {
    it("should return fallback score when API fails", async () => {
      const service = createMockTranslationService();
      service.translateBatch = mock(async () => {
        throw new Error("API error");
      });

      const extractor = new ContextExtractor(service);
      const result = await extractor.refineProjectDescription(
        "React UI dashboard interface for users",
      );

      expect(result.qualityScore).toBe(FALLBACK_QUALITY_SCORE);
      expect(result.suggestions).toContain("API error");
    });
  });

  describe("heuristic evaluation", () => {
    it("should give higher score for UI/interface mentions", async () => {
      const service = createMockTranslationService();
      service.translateBatch = mock(async (from, to, texts) => {
        // Return invalid JSON to trigger heuristic evaluation
        const map = new Map<string, string>();
        map.set(texts[0], "invalid json response");
        return map;
      });

      const extractor = new ContextExtractor(service);
      const result = await extractor.refineProjectDescription(
        "React UI dashboard interface for users",
      );

      expect(result.qualityScore).toBeGreaterThan(5);
    });

    it("should give lower score for technical details", async () => {
      const service = createMockTranslationService();
      service.translateBatch = mock(async (from, to, texts) => {
        // Return invalid JSON to trigger heuristic evaluation
        const map = new Map<string, string>();
        map.set(texts[0], "invalid json response");
        return map;
      });

      const extractor = new ContextExtractor(service);
      const result = await extractor.refineProjectDescription(
        "Install npm packages and setup configuration files",
      );

      expect(result.qualityScore).toBeLessThan(5);
    });

    it("should penalize very short descriptions", async () => {
      const service = createMockTranslationService();
      service.translateBatch = mock(async (from, to, texts) => {
        // Return invalid JSON to trigger heuristic evaluation
        const map = new Map<string, string>();
        map.set(texts[0], "invalid json response");
        return map;
      });

      const extractor = new ContextExtractor(service);
      const result = await extractor.refineProjectDescription("A simple app");

      expect(result.qualityScore).toBeLessThan(4);
    });

    it("should provide suggestions for low scores", async () => {
      const service = createMockTranslationService();
      service.translateBatch = mock(async (from, to, texts) => {
        // Return invalid JSON to trigger heuristic evaluation
        const map = new Map<string, string>();
        map.set(texts[0], "invalid json response");
        return map;
      });

      const extractor = new ContextExtractor(service);
      const result = await extractor.refineProjectDescription("Just some code");

      expect(result.qualityScore).toBeLessThan(7);
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions).toContain("project type");
    });
  });
});
