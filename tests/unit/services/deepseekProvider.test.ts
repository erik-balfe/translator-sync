#!/usr/bin/env bun
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { DeepSeekProvider } from "../../../src/services/deepseekProvider.ts";
import type { TranslationContext } from "../../../src/services/translator.ts";

// Create a mock OpenAI client
const mockCreate = mock();
const mockOpenAIClient = {
  chat: {
    completions: {
      create: mockCreate,
    },
  },
};

// Helper function to create a provider with mock client
const createTestProvider = (config: Record<string, unknown> = {}) => {
  return new DeepSeekProvider({
    apiKey: "test-key",
    // biome-ignore lint/suspicious/noExplicitAny: Mock object for testing
    client: mockOpenAIClient as any,
    ...config,
  });
};

describe("DeepSeekProvider", () => {
  beforeEach(() => {
    mockCreate.mockClear();
  });

  afterEach(() => {
    mockCreate.mockClear();
  });

  describe("constructor", () => {
    it("should initialize with default model", () => {
      const provider = createTestProvider();
      expect(provider).toBeDefined();
    });

    it("should accept custom model", () => {
      const provider = createTestProvider({
        model: "deepseek-chat",
      });
      expect(provider).toBeDefined();
    });
  });

  describe("translateBatch", () => {
    it("should successfully translate single text", async () => {
      const mockResponse = {
        id: "chatcmpl-123",
        object: "chat.completion",
        created: 1234567890,
        model: "deepseek-v3",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "Hola",
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 10,
          total_tokens: 60,
        },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const provider = createTestProvider();
      const result = await provider.translateBatch("en", "es", ["Hello"]);

      expect(result.size).toBe(1);
      expect(result.get("Hello")).toBe("Hola");
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith({
        model: "deepseek-chat",
        messages: [{ role: "user", content: expect.stringContaining("Hello") }],
        temperature: 0.1,
        max_tokens: expect.any(Number),
      });
    });

    it("should translate multiple texts in one request", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "Hola\nMundo",
            },
          },
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 20,
        },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const provider = createTestProvider();
      const result = await provider.translateBatch("en", "es", ["Hello", "World"]);

      expect(result.size).toBe(2);
      expect(result.get("Hello")).toBe("Hola");
      expect(result.get("World")).toBe("Mundo");
    });

    it("should handle context with custom instructions", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "¡Hola!",
            },
          },
        ],
        usage: {
          prompt_tokens: 60,
          completion_tokens: 10,
        },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const context: TranslationContext = {
        customInstructions: "Use informal tone",
        preserveVariables: true,
      };

      const provider = createTestProvider();
      await provider.translateBatch("en", "es", ["Hello"], context);

      expect(mockCreate).toHaveBeenCalledWith({
        model: "deepseek-chat",
        messages: [{ role: "user", content: expect.stringContaining("Use informal tone") }],
        temperature: 0.1,
        max_tokens: expect.any(Number),
      });
    });

    it("should handle API errors", async () => {
      const error = new Error("Request failed with status code 429");
      mockCreate.mockRejectedValueOnce(error);

      const provider = createTestProvider();

      await expect(provider.translateBatch("en", "es", ["Hello"])).rejects.toThrow();
    });

    it("should handle network errors", async () => {
      mockCreate.mockRejectedValueOnce(new Error("Network error"));

      const provider = createTestProvider();

      await expect(provider.translateBatch("en", "es", ["Hello"])).rejects.toThrow();
    });

    it("should handle empty response", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "",
            },
          },
        ],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 0,
        },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const provider = createTestProvider();
      const result = await provider.translateBatch("en", "es", ["Hello"]);

      expect(result.size).toBe(1);
      expect(result.get("Hello")).toBe("[Translation unavailable]");
    });

    it("should handle mismatched translation count", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "Only one translation",
            },
          },
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 10,
        },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const provider = createTestProvider();
      const result = await provider.translateBatch("en", "es", ["Hello", "World", "Test"]);

      // Should map the first translation and fallback for others
      expect(result.size).toBe(3);
      expect(result.get("Hello")).toBe("Only one translation");
      expect(result.get("World")).toBe("[Translation unavailable]");
      expect(result.get("Test")).toBe("[Translation unavailable]");
    });

    it("should handle context with HTML preservation", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "<strong>Hola</strong>",
            },
          },
        ],
        usage: {
          prompt_tokens: 60,
          completion_tokens: 10,
        },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const context: TranslationContext = {
        preserveVariables: true,
      };

      const provider = createTestProvider();
      const result = await provider.translateBatch("en", "es", ["<strong>Hello</strong>"], context);

      expect(result.get("<strong>Hello</strong>")).toBe("<strong>Hola</strong>");
    });

    it("should use custom model when specified", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "Bonjour",
            },
          },
        ],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 10,
        },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const provider = createTestProvider({
        model: "deepseek-chat",
      });
      await provider.translateBatch("en", "fr", ["Hello"]);

      expect(mockCreate).toHaveBeenCalledWith({
        model: "deepseek-chat",
        messages: expect.any(Array),
        temperature: 0.1,
        max_tokens: expect.any(Number),
      });
    });

    it("should handle special characters in translations", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Hello "friend"\nHow\'s it going?',
            },
          },
        ],
        usage: {
          prompt_tokens: 80,
          completion_tokens: 20,
        },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const provider = createTestProvider();
      const result = await provider.translateBatch("es", "en", ['Hola "amigo"', "¿Cómo te va?"]);

      expect(result.get('Hola "amigo"')).toBe('Hello "friend"');
      expect(result.get("¿Cómo te va?")).toBe("How's it going?");
    });
  });

  describe("getUsageStats", () => {
    it("should return usage statistics after translation", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "Translated",
            },
          },
        ],
        usage: {
          prompt_tokens: 123,
          completion_tokens: 45,
          total_tokens: 168,
        },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const provider = createTestProvider();
      await provider.translateBatch("en", "es", ["Test"]);

      const stats = provider.getUsageStats();
      expect(stats.inputTokens).toBe(123);
      expect(stats.outputTokens).toBe(45);
    });

    it("should accumulate usage across multiple requests", async () => {
      const provider = createTestProvider();

      // First request
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "First" } }],
        usage: { prompt_tokens: 50, completion_tokens: 10 },
      });

      await provider.translateBatch("en", "es", ["Test1"]);

      // Second request
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "Second" } }],
        usage: { prompt_tokens: 60, completion_tokens: 15 },
      });

      await provider.translateBatch("en", "es", ["Test2"]);

      const stats = provider.getUsageStats();
      expect(stats.inputTokens).toBe(110); // 50 + 60
      expect(stats.outputTokens).toBe(25); // 10 + 15
    });

    it("should return zero stats when no requests made", () => {
      const provider = createTestProvider();
      const stats = provider.getUsageStats();

      expect(stats.inputTokens).toBe(0);
      expect(stats.outputTokens).toBe(0);
    });
  });

  describe("error handling", () => {
    it("should provide meaningful error for missing API key", async () => {
      const error = new Error("Request failed with status code 401");
      mockCreate.mockRejectedValueOnce(error);

      const provider = createTestProvider({ apiKey: "" });

      await expect(provider.translateBatch("en", "es", ["Hello"])).rejects.toThrow();
    });

    it("should handle malformed API response", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [], // Empty choices array
        usage: { prompt_tokens: 0, completion_tokens: 0 },
      });

      const provider = createTestProvider();

      const result = await provider.translateBatch("en", "es", ["Hello"]);
      expect(result.get("Hello")).toBe("[Translation unavailable]");
    });

    it("should handle API response errors", async () => {
      mockCreate.mockRejectedValueOnce(new Error("Invalid JSON"));

      const provider = createTestProvider();

      await expect(provider.translateBatch("en", "es", ["Hello"])).rejects.toThrow("Invalid JSON");
    });
  });
});
