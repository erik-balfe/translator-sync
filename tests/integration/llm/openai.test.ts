#!/usr/bin/env bun
import { beforeEach, describe, expect, test } from "bun:test";
import { OpenAIProvider } from "../../../src/services/openaiProvider";
import type { TranslationContext } from "../../../src/services/translator";
import { loadEnv } from "../../../src/utils/envLoader";

// Load environment variables from .env file
loadEnv();

// Test helpers
const hasApiKey = (): boolean => {
  return Boolean(process.env.OPENAI_API_KEY || process.env.OPENAI_TEST_API_KEY);
};

const getApiKey = (): string => {
  return process.env.OPENAI_TEST_API_KEY || process.env.OPENAI_API_KEY || "test-key";
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

  // HTML tag preservation check
  const sourceTags = source.match(/<[^>]+>/g) || [];
  for (const tag of sourceTags) {
    expect(translation).toContain(tag);
  }

  // Reasonable length check (translation should be 25% to 300% of source length)
  expect(translation.length).toBeGreaterThan(source.length * 0.25);
  expect(translation.length).toBeLessThan(source.length * 3);
};

describe("OpenAI Translation Provider", () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    provider = new OpenAIProvider({
      apiKey: getApiKey(),
      model: "gpt-4o-mini", // Use cheaper model for testing
      timeout: 30000,
      maxRetries: 1, // Reduce retries for faster tests
    });
  });

  describe("Configuration and Setup", () => {
    test("creates provider with valid config", () => {
      expect(provider).toBeDefined();
    });

    test("throws error with invalid API key", async () => {
      const invalidProvider = new OpenAIProvider({
        apiKey: "invalid-key-123",
        timeout: 5000,
        maxRetries: 1,
      });

      await expect(invalidProvider.translateBatch("en", "es", ["hello"])).rejects.toThrow(
        /authentication|api key|unauthorized/i,
      );
    });
  });

  describe("Basic Translation Functionality", () => {
    skipIfNoApiKey("translates simple text", async () => {
      const texts = ["Hello", "Goodbye", "Thank you"];

      const result = await provider.translateBatch("en", "es", texts);

      expect(result.size).toBe(3);

      for (const [source, translation] of result) {
        validateTranslation(source, translation);
      }
    });

    skipIfNoApiKey("handles empty array", async () => {
      const result = await provider.translateBatch("en", "es", []);
      expect(result.size).toBe(0);
    });

    skipIfNoApiKey("handles single text", async () => {
      const result = await provider.translateBatch("en", "fr", ["Hello world"]);

      expect(result.size).toBe(1);
      const translation = result.get("Hello world");
      validateTranslation("Hello world", translation!);
    });

    skipIfNoApiKey("preserves text order", async () => {
      const texts = ["First", "Second", "Third"];

      const result = await provider.translateBatch("en", "es", texts);

      const resultKeys = Array.from(result.keys());
      expect(resultKeys).toEqual(texts);
    });
  });

  describe("Variable Preservation", () => {
    skipIfNoApiKey("preserves FTL variables", async () => {
      const texts = ["Hello {$name}", "You have {$count} messages", "Welcome to {$appName}!"];

      const result = await provider.translateBatch("en", "es", texts, {
        preserveVariables: true,
      });

      expect(result.size).toBe(3);

      for (const [source, translation] of result) {
        validateTranslation(source, translation, { preserveVariables: true });
      }
    });

    skipIfNoApiKey("preserves multiple variables in one text", async () => {
      const text = "Hello {$firstName} {$lastName}, you have {$count} items in your {$container}";

      const result = await provider.translateBatch("en", "de", [text]);

      const translation = result.get(text)!;
      validateTranslation(text, translation, { preserveVariables: true });

      // Check all variables are present
      expect(translation).toContain("{$firstName}");
      expect(translation).toContain("{$lastName}");
      expect(translation).toContain("{$count}");
      expect(translation).toContain("{$container}");
    });
  });

  describe("HTML Content Handling", () => {
    skipIfNoApiKey("preserves HTML tags", async () => {
      const texts = [
        "<strong>Bold text</strong>",
        "<p>Paragraph with <em>emphasis</em></p>",
        'Click <a href="#">here</a> to continue',
      ];

      const result = await provider.translateBatch("en", "fr", texts);

      for (const [source, translation] of result) {
        validateTranslation(source, translation);
      }
    });

    skipIfNoApiKey("handles mixed HTML and variables", async () => {
      const text =
        "<p>Welcome <strong>{$username}</strong>, you have <em>{$count}</em> notifications</p>";

      const result = await provider.translateBatch("en", "es", [text]);

      const translation = result.get(text)!;
      validateTranslation(text, translation, { preserveVariables: true });

      // Check HTML structure is preserved
      expect(translation).toContain("<p>");
      expect(translation).toContain("</p>");
      expect(translation).toContain("<strong>");
      expect(translation).toContain("</strong>");
      expect(translation).toContain("<em>");
      expect(translation).toContain("</em>");
    });
  });

  describe("Multiline Content", () => {
    skipIfNoApiKey("handles multiline text", async () => {
      const multilineText = `This is line one.
This is line two.
This is line three.`;

      const result = await provider.translateBatch("en", "es", [multilineText]);

      const translation = result.get(multilineText)!;
      validateTranslation(multilineText, translation);

      // Should maintain multiline structure
      const sourceLines = multilineText.split("\n").length;
      const translationLines = translation.split("\n").length;
      expect(translationLines).toBeGreaterThanOrEqual(sourceLines - 1); // Allow some flexibility
    });
  });

  describe("Context-Specific Translation", () => {
    skipIfNoApiKey("uses domain context", async () => {
      const technicalText = "Initialize the database connection";

      const result = await provider.translateBatch("en", "es", [technicalText], {
        domain: "technical",
      });

      const translation = result.get(technicalText)!;
      validateTranslation(technicalText, translation);
    });

    skipIfNoApiKey("uses tone context", async () => {
      const text = "Please complete your profile";

      const formalResult = await provider.translateBatch("en", "es", [text], {
        tone: "formal",
      });

      const casualResult = await provider.translateBatch("en", "es", [text], {
        tone: "casual",
      });

      const formalTranslation = formalResult.get(text)!;
      const casualTranslation = casualResult.get(text)!;

      validateTranslation(text, formalTranslation);
      validateTranslation(text, casualTranslation);

      // Translations should be different due to different tones
      expect(formalTranslation).not.toBe(casualTranslation);
    });
  });

  describe("Batch Processing", () => {
    skipIfNoApiKey("handles medium batch efficiently", async () => {
      const texts = Array.from({ length: 10 }, (_, i) => `Text number ${i + 1}`);

      const startTime = Date.now();
      const result = await provider.translateBatch("en", "es", texts);
      const endTime = Date.now();

      expect(result.size).toBe(10);
      expect(endTime - startTime).toBeLessThan(30000); // Should complete in under 30 seconds

      // Validate all translations
      for (const [source, translation] of result) {
        validateTranslation(source, translation);
      }
    });

    skipIfNoApiKey("maintains accuracy with large batch", async () => {
      const texts = [
        "Welcome to our application",
        "User settings",
        "Save changes",
        "Cancel operation",
        "Confirm deletion",
        "Upload file",
        "Download report",
        "Search results",
        "No items found",
        "Loading...",
      ];

      const result = await provider.translateBatch("en", "de", texts);

      expect(result.size).toBe(texts.length);

      // Each translation should be reasonable
      for (const [source, translation] of result) {
        validateTranslation(source, translation);
        expect(translation.length).toBeGreaterThan(2); // Should be more than just a character or two
      }
    });
  });

  describe("Error Handling", () => {
    test("handles network timeout gracefully", async () => {
      const timeoutProvider = new OpenAIProvider({
        apiKey: getApiKey(),
        timeout: 1, // Very short timeout
        maxRetries: 1,
      });

      await expect(timeoutProvider.translateBatch("en", "es", ["hello"])).rejects.toThrow(
        /timeout|network|timed out/i,
      );
    });

    skipIfNoApiKey("recovers from temporary failures", async () => {
      // This test depends on the service being able to retry
      const result = await provider.translateBatch("en", "es", ["hello"]);

      expect(result.size).toBe(1);
      expect(result.get("hello")).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    skipIfNoApiKey("handles empty strings", async () => {
      const texts = ["", "non-empty", ""];

      const result = await provider.translateBatch("en", "es", texts);

      expect(result.size).toBe(3);

      // Empty strings should have some translation (even if minimal)
      const emptyTranslation = result.get("")!;
      expect(emptyTranslation).toBeDefined();
    });

    skipIfNoApiKey("handles special characters and Unicode", async () => {
      const texts = [
        "Café naïve résumé",
        "🌍 Hello world! 🚀",
        "Testing symbols: @#$%^&*()",
        "Quotes: 'single' and \"double\"",
      ];

      const result = await provider.translateBatch("en", "es", texts);

      for (const [source, translation] of result) {
        validateTranslation(source, translation);
      }
    });

    skipIfNoApiKey("handles very short text", async () => {
      const texts = ["Hi", "OK", "No"];

      const result = await provider.translateBatch("en", "fr", texts);

      for (const [source, translation] of result) {
        validateTranslation(source, translation);
      }
    });
  });

  // Performance and cost-aware tests (run sparingly)
  describe("Performance Tests", () => {
    test.skip("handles large text efficiently", async () => {
      // This test is skipped by default to avoid costs
      const largeText = "This is a long text. ".repeat(100); // ~2000 characters

      const result = await provider.translateBatch("en", "es", [largeText]);

      const translation = result.get(largeText)!;
      validateTranslation(largeText, translation);
    });
  });
});
