#!/usr/bin/env bun
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { DeepSeekProvider } from "../../../src/services/deepseekProvider.ts";
import type { TranslationContext } from "../../../src/services/translator.ts";

// Mock OpenAI module
const mockCreate = mock();
const mockOpenAI = mock(() => ({
  chat: {
    completions: {
      create: mockCreate,
    },
  },
}));

// Mock the openai module
import.meta.resolve = () => "";
import.meta.require = () => ({ default: mockOpenAI });

describe("DeepSeekProvider", () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    mockFetch.mockClear();
  });

  describe("constructor", () => {
    it("should initialize with default model", () => {
      const provider = new DeepSeekProvider({ apiKey: "test-key" });
      expect(provider).toBeDefined();
    });

    it("should accept custom model", () => {
      const provider = new DeepSeekProvider({
        apiKey: "test-key",
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

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const provider = new DeepSeekProvider({ apiKey: "test-key" });
      const result = await provider.translateBatch("en", "es", ["Hello"]);

      expect(result.size).toBe(1);
      expect(result.get("Hello")).toBe("Hola");
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.deepseek.com/v1/chat/completions",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-key",
          },
        }),
      );
    });

    it("should translate multiple texts in one request", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "Hola\n---\nMundo",
            },
          },
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 20,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const provider = new DeepSeekProvider({ apiKey: "test-key" });
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

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const context: TranslationContext = {
        customInstructions: "Use informal tone",
        preserveVariables: true,
      };

      const provider = new DeepSeekProvider({ apiKey: "test-key" });
      await provider.translateBatch("en", "es", ["Hello"], context);

      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);
      expect(body.messages[0].content).toContain("Use informal tone");
    });

    it("should handle API errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: async () => "Rate limit exceeded",
      });

      const provider = new DeepSeekProvider({ apiKey: "test-key" });

      await expect(provider.translateBatch("en", "es", ["Hello"])).rejects.toThrow(
        "DeepSeek API error: 429 Too Many Requests",
      );
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const provider = new DeepSeekProvider({ apiKey: "test-key" });

      await expect(provider.translateBatch("en", "es", ["Hello"])).rejects.toThrow("Network error");
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

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const provider = new DeepSeekProvider({ apiKey: "test-key" });
      const result = await provider.translateBatch("en", "es", ["Hello"]);

      expect(result.size).toBe(0);
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

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const provider = new DeepSeekProvider({ apiKey: "test-key" });
      const result = await provider.translateBatch("en", "es", ["Hello", "World", "Test"]);

      // Should only map the first translation
      expect(result.size).toBe(1);
      expect(result.get("Hello")).toBe("Only one translation");
      expect(result.get("World")).toBeUndefined();
    });

    it("should preserve formatting when requested", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "  Hola  ",
            },
          },
        ],
        usage: {
          prompt_tokens: 60,
          completion_tokens: 10,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const context: TranslationContext = {
        preserveFormatting: true,
      };

      const provider = new DeepSeekProvider({ apiKey: "test-key" });
      const result = await provider.translateBatch("en", "es", ["  Hello  "], context);

      expect(result.get("  Hello  ")).toBe("  Hola  ");
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

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const provider = new DeepSeekProvider({
        apiKey: "test-key",
        model: "deepseek-chat",
      });
      await provider.translateBatch("en", "fr", ["Hello"]);

      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);
      expect(body.model).toBe("deepseek-chat");
    });

    it("should handle special characters in translations", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Hello "friend"\n---\nHow\'s it going?',
            },
          },
        ],
        usage: {
          prompt_tokens: 80,
          completion_tokens: 20,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const provider = new DeepSeekProvider({ apiKey: "test-key" });
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

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const provider = new DeepSeekProvider({ apiKey: "test-key" });
      await provider.translateBatch("en", "es", ["Test"]);

      const stats = provider.getUsageStats();
      expect(stats.inputTokens).toBe(123);
      expect(stats.outputTokens).toBe(45);
    });

    it("should accumulate usage across multiple requests", async () => {
      const provider = new DeepSeekProvider({ apiKey: "test-key" });

      // First request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "First" } }],
          usage: { prompt_tokens: 50, completion_tokens: 10 },
        }),
      });

      await provider.translateBatch("en", "es", ["Test1"]);

      // Second request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "Second" } }],
          usage: { prompt_tokens: 60, completion_tokens: 15 },
        }),
      });

      await provider.translateBatch("en", "es", ["Test2"]);

      const stats = provider.getUsageStats();
      expect(stats.inputTokens).toBe(110); // 50 + 60
      expect(stats.outputTokens).toBe(25); // 10 + 15
    });

    it("should return zero stats when no requests made", () => {
      const provider = new DeepSeekProvider({ apiKey: "test-key" });
      const stats = provider.getUsageStats();

      expect(stats.inputTokens).toBe(0);
      expect(stats.outputTokens).toBe(0);
    });
  });

  describe("error handling", () => {
    it("should provide meaningful error for missing API key", async () => {
      const provider = new DeepSeekProvider({ apiKey: "" });

      await expect(provider.translateBatch("en", "es", ["Hello"])).rejects.toThrow();
    });

    it("should handle malformed API response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: "response" }),
      });

      const provider = new DeepSeekProvider({ apiKey: "test-key" });

      await expect(provider.translateBatch("en", "es", ["Hello"])).rejects.toThrow();
    });

    it("should handle JSON parse errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      });

      const provider = new DeepSeekProvider({ apiKey: "test-key" });

      await expect(provider.translateBatch("en", "es", ["Hello"])).rejects.toThrow("Invalid JSON");
    });
  });
});
