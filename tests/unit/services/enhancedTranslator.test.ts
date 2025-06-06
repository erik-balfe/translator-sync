#!/usr/bin/env bun
import { beforeEach, describe, expect, it, mock } from "bun:test";
import { ContextExtractor } from "../../../src/services/contextExtractor.ts";
import { EnhancedTranslator } from "../../../src/services/enhancedTranslator.ts";
import type { TranslationContext, TranslationService } from "../../../src/services/translator.ts";

// Create mock functions at top level
const mockTranslateBatch = mock();
const mockGetUsageStats = mock();

/**
 * Create a mock translation service.
 */
function createMockTranslationService(): TranslationService {
  return {
    translateBatch: mockTranslateBatch,
    getUsageStats: mockGetUsageStats,
  };
}

describe("EnhancedTranslator", () => {
  beforeEach(() => {
    // Clear all mock calls and reset implementations
    mockTranslateBatch.mockClear();
    mockGetUsageStats.mockClear();

    // Set default implementations
    mockTranslateBatch.mockImplementation(async (from, to, texts, context) => {
      const map = new Map<string, string>();
      for (const text of texts) {
        map.set(text, `${text} (translated to ${to})`);
      }
      return map;
    });

    mockGetUsageStats.mockImplementation(() => ({ inputTokens: 100, outputTokens: 150 }));
  });

  describe("translateWithContext", () => {
    it("should translate without context when no description provided", async () => {
      const baseService = createMockTranslationService();
      const translator = new EnhancedTranslator(baseService);

      const texts = ["Hello", "World"];
      const result = await translator.translateWithContext("en", "es", texts);

      expect(result.size).toBe(2);
      expect(result.get("Hello")).toBe("Hello (translated to es)");
      expect(result.get("World")).toBe("World (translated to es)");
      // Verify the basic call was made
      expect(mockTranslateBatch).toHaveBeenCalledTimes(1);
      const callArgs = mockTranslateBatch.mock.calls[0];
      expect(callArgs[0]).toBe("en");
      expect(callArgs[1]).toBe("es");
      expect(callArgs[2]).toEqual(texts);
    });

    it("should add context instructions when description provided", async () => {
      const baseService = createMockTranslationService();
      const translator = new EnhancedTranslator(baseService);

      const texts = ["Welcome"];
      const description = "E-commerce platform with casual tone";
      const result = await translator.translateWithContext("en", "es", texts, description);

      expect(result.size).toBe(1);
      expect(result.get("Welcome")).toBe("Welcome (translated to es)");

      // Verify custom instructions were added
      const calls = mockTranslateBatch.mock.calls;
      expect(calls[0][3]).toHaveProperty("customInstructions");
      expect(calls[0][3].customInstructions).toContain("PROJECT CONTEXT:");
      expect(calls[0][3].customInstructions).toContain(description);
    });

    it("should preserve existing context properties", async () => {
      const baseService = createMockTranslationService();
      const translator = new EnhancedTranslator(baseService);

      const texts = ["Test"];
      const existingContext: TranslationContext = {
        preserveVariables: false,
        preserveHTMLTags: false,
        customInstructions: "Existing instructions",
      };

      await translator.translateWithContext("en", "fr", texts, "Description", existingContext);

      const calls = mockTranslateBatch.mock.calls;
      expect(calls[0][3]).toHaveProperty("preserveVariables", false);
      expect(calls[0][3]).toHaveProperty("preserveHTMLTags", false);
      expect(calls[0][3].customInstructions).toContain("Existing instructions");
      expect(calls[0][3].customInstructions).toContain("PROJECT CONTEXT:");
    });

    it("should handle empty text array", async () => {
      const baseService = createMockTranslationService();
      const translator = new EnhancedTranslator(baseService);

      const result = await translator.translateWithContext("en", "de", []);

      expect(result.size).toBe(0);
      // translateWithContext returns early for empty arrays, so no call should be made
      expect(mockTranslateBatch).toHaveBeenCalledTimes(0);
    });

    it("should handle API errors gracefully", async () => {
      const baseService = createMockTranslationService();
      mockTranslateBatch.mockImplementation(async () => {
        throw new Error("API error");
      });

      const translator = new EnhancedTranslator(baseService);

      await expect(translator.translateWithContext("en", "ja", ["Error test"])).rejects.toThrow(
        "API error",
      );
    });
  });

  describe("refineDescription", () => {
    it("should delegate to context extractor", async () => {
      const baseService = createMockTranslationService();
      const translator = new EnhancedTranslator(baseService);

      // Mock the translateBatch to return a valid refinement response
      mockTranslateBatch.mockImplementation(async (from, to, texts) => {
        const map = new Map<string, string>();
        const response = JSON.stringify({
          refinedDescription: "Refined: Marketing website",
          qualityScore: 7,
          suggestions: null,
        });
        map.set(texts[0], response);
        return map;
      });

      const result = await translator.refineDescription("Marketing website for startup");

      expect(result.refinedDescription).toBe("Refined: Marketing website");
      expect(result.qualityScore).toBe(7);
      expect(result.suggestions).toBeUndefined();
    });

    it("should handle refinement errors", async () => {
      const baseService = createMockTranslationService();
      mockTranslateBatch.mockImplementation(async () => {
        throw new Error("Refinement failed");
      });

      const translator = new EnhancedTranslator(baseService);
      const result = await translator.refineDescription("Test description");

      // Should return fallback
      expect(result.refinedDescription).toBe("Test description");
      expect(result.qualityScore).toBeGreaterThan(0);
      expect(result.suggestions).toContain("API error");
    });
  });

  describe("getUsageStats", () => {
    it("should return usage stats from base service", () => {
      const baseService = createMockTranslationService();
      const translator = new EnhancedTranslator(baseService);

      const stats = translator.getUsageStats();

      expect(stats.inputTokens).toBe(100);
      expect(stats.outputTokens).toBe(150);
      expect(mockGetUsageStats).toHaveBeenCalledTimes(1);
    });

    it("should return empty stats when base service has no getUsageStats", () => {
      const mockTranslateBatchLocal = mock(async () => new Map());
      const baseService: TranslationService = {
        translateBatch: mockTranslateBatchLocal,
      };

      const translator = new EnhancedTranslator(baseService);
      const stats = translator.getUsageStats();

      expect(stats.inputTokens).toBe(0);
      expect(stats.outputTokens).toBe(0);
    });
  });

  describe("context instruction formatting", () => {
    it("should format multi-line descriptions properly", async () => {
      const baseService = createMockTranslationService();
      const translator = new EnhancedTranslator(baseService);

      const description = "Line 1\nLine 2\nLine 3";
      await translator.translateWithContext("en", "es", ["Test"], description);

      const calls = mockTranslateBatch.mock.calls;
      const instructions = calls[0][3].customInstructions;
      expect(instructions).toContain("PROJECT CONTEXT:");
      expect(instructions).toContain(description);
    });

    it("should handle very long descriptions", async () => {
      const baseService = createMockTranslationService();
      const translator = new EnhancedTranslator(baseService);

      const longDescription = "A".repeat(1000);
      await translator.translateWithContext("en", "es", ["Test"], longDescription);

      const calls = mockTranslateBatch.mock.calls;
      const instructions = calls[0][3].customInstructions;
      expect(instructions).toContain("PROJECT CONTEXT:");
      expect(instructions.length).toBeGreaterThan(1000);
    });

    it("should append to existing custom instructions", async () => {
      const baseService = createMockTranslationService();
      const translator = new EnhancedTranslator(baseService);

      const context: TranslationContext = {
        customInstructions: "Rule 1: Be formal\nRule 2: Use technical terms",
      };

      await translator.translateWithContext(
        "en",
        "es",
        ["Test"],
        "Technical documentation",
        context,
      );

      const calls = mockTranslateBatch.mock.calls;
      const instructions = calls[0][3].customInstructions;
      expect(instructions).toContain("Rule 1: Be formal");
      expect(instructions).toContain("Rule 2: Use technical terms");
      expect(instructions).toContain("PROJECT CONTEXT:");
      expect(instructions).toContain("Technical documentation");
    });
  });

  describe("translateBatch", () => {
    it("should delegate to translateWithContext without description", async () => {
      const baseService = createMockTranslationService();
      const translator = new EnhancedTranslator(baseService);

      const texts = ["One", "Two", "Three"];
      const result = await translator.translateBatch("en", "fr", texts);

      expect(result.size).toBe(3);
      expect(result.get("One")).toBe("One (translated to fr)");
      expect(mockTranslateBatch).toHaveBeenCalledTimes(1);
    });

    it("should pass context through correctly", async () => {
      const baseService = createMockTranslationService();
      const translator = new EnhancedTranslator(baseService);

      const context: TranslationContext = {
        preserveVariables: false,
      };

      await translator.translateBatch("en", "de", ["Test"], context);

      const calls = mockTranslateBatch.mock.calls;
      expect(calls[0][3]).toHaveProperty("preserveVariables", false);
    });
  });
});
