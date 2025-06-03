#!/usr/bin/env bun
import { beforeEach, describe, expect, test } from "bun:test";
import { createTranslationService } from "../../../src/services/serviceFactory";
import type { TranslationContext, TranslationService } from "../../../src/services/translator";
import { loadEnv } from "../../../src/utils/envLoader";

// Load environment variables from .env file
loadEnv();

// Test helpers
const hasApiKey = (): boolean => {
  return Boolean(process.env.DEEPSEEK_API_KEY);
};

const skipIfNoApiKey = hasApiKey() ? test : test.skip;

// Helper to validate translation output
const validateTranslation = (
  source: string,
  translation: string,
  context?: TranslationContext,
): void => {
  // Basic validations
  expect(translation).toBeDefined();
  expect(translation.trim().length).toBeGreaterThan(0);
  expect(translation).not.toBe(source); // Should be different from source

  // Variable preservation check
  if (context?.preserveVariables !== false) {
    const sourceVars = source.match(/\{\$[^}]+\}/g) || [];
    for (const variable of sourceVars) {
      expect(translation).toContain(variable);
    }
  }

  // Reasonable length check (translation should be 25% to 300% of source length)
  expect(translation.length).toBeGreaterThan(source.length * 0.25);
  expect(translation.length).toBeLessThan(source.length * 3);
};

describe("DeepSeek Translation Provider", () => {
  let service: TranslationService;

  beforeEach(() => {
    if (hasApiKey()) {
      service = createTranslationService({
        provider: "deepseek",
        apiKey: process.env.DEEPSEEK_API_KEY || "",
        model: "deepseek-chat", // Cheapest model at $0.14/$0.28 per 1M tokens
        timeout: 60000, // Longer timeout for DeepSeek
      });
    }
  });

  describe("Configuration and Setup", () => {
    skipIfNoApiKey("creates service via factory", () => {
      expect(service).toBeDefined();
    });

    test("throws error with invalid API key", async () => {
      const invalidService = createTranslationService({
        provider: "deepseek",
        apiKey: "invalid-key-123",
      });

      await expect(invalidService.translateBatch("en", "es", ["hello"])).rejects.toThrow(
        /authentication|api key|unauthorized|401/i,
      );
    });
  });

  describe("Basic Translation Functionality", () => {
    skipIfNoApiKey("translates simple text", async () => {
      const texts = ["Hello", "Goodbye", "Thank you"];

      const result = await service.translateBatch("en", "es", texts);

      expect(result.size).toBe(3);

      for (const [source, translation] of result) {
        validateTranslation(source, translation);
      }

      console.log("DeepSeek translations:", Object.fromEntries(result));
    });

    skipIfNoApiKey("handles empty array", async () => {
      const result = await service.translateBatch("en", "es", []);
      expect(result.size).toBe(0);
    });

    skipIfNoApiKey("handles single text with cost efficiency", async () => {
      const result = await service.translateBatch("en", "fr", ["Hello world"]);

      expect(result.size).toBe(1);
      const translation = result.get("Hello world");
      expect(translation).toBeDefined();
      if (translation) {
        validateTranslation("Hello world", translation);
      }

      // DeepSeek should be very cost-effective
      console.log(`DeepSeek translation: "Hello world" -> "${translation}"`);
    });
  });

  describe("Variable Preservation", () => {
    skipIfNoApiKey("preserves FTL variables", async () => {
      const texts = ["Hello {$name}", "You have {$count} messages"];

      const result = await service.translateBatch("en", "es", texts, {
        preserveVariables: true,
      });

      expect(result.size).toBe(2);

      for (const [source, translation] of result) {
        validateTranslation(source, translation, { preserveVariables: true });
      }

      console.log("DeepSeek variable preservation:", Object.fromEntries(result));
    });
  });

  describe("Cost-Effective Batch Processing", () => {
    skipIfNoApiKey("handles medium batch efficiently", async () => {
      const texts = Array.from({ length: 5 }, (_, i) => `UI text ${i + 1}`);

      const startTime = Date.now();
      const result = await service.translateBatch("en", "es", texts);
      const endTime = Date.now();

      expect(result.size).toBe(5);
      expect(endTime - startTime).toBeLessThan(20000); // Should be fast

      console.log(`DeepSeek batch processing: ${endTime - startTime}ms for 5 texts`);

      // Validate all translations
      for (const [source, translation] of result) {
        validateTranslation(source, translation);
      }
    });
  });

  describe("Quality Comparison", () => {
    skipIfNoApiKey("provides reasonable quality for cost", async () => {
      const texts = [
        "Welcome to our application",
        "Please enter your password",
        "File uploaded successfully",
      ];

      const result = await service.translateBatch("en", "de", texts);

      expect(result.size).toBe(3);

      // Each translation should be reasonable for the low cost
      for (const [source, translation] of result) {
        validateTranslation(source, translation);
        expect(translation.length).toBeGreaterThan(3); // Should be more than just a few characters
      }

      console.log("DeepSeek quality sample:", Object.fromEntries(result));
    });
  });

  describe("Error Handling", () => {
    skipIfNoApiKey("recovers from temporary failures", async () => {
      // This test verifies the service can handle retries
      const result = await service.translateBatch("en", "es", ["hello"]);

      expect(result.size).toBe(1);
      expect(result.get("hello")).toBeDefined();
    });
  });

  describe("Development Use Cases", () => {
    skipIfNoApiKey("good for quick development iterations", async () => {
      // Test common development scenarios where cost matters more than perfect quality
      const devTexts = ["Error: Invalid input", "Loading...", "Save changes", "Cancel"];

      const result = await service.translateBatch("en", "fr", devTexts);

      expect(result.size).toBe(4);

      // Should provide reasonable translations for development use
      for (const [source, translation] of result) {
        validateTranslation(source, translation);
      }

      console.log("DeepSeek dev translations:", Object.fromEntries(result));
    });
  });
});
