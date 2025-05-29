#!/usr/bin/env bun
import { beforeEach, describe, expect, test } from "bun:test";
import { MockTranslationService } from "../../../src/services/translator";

describe("translator services", () => {
  describe("MockTranslationService", () => {
    let service: MockTranslationService;

    beforeEach(() => {
      service = new MockTranslationService();
    });

    test("translates batch of texts with mock prefix", async () => {
      const texts = ["Hello", "Goodbye", "Thank you"];

      const result = await service.translateBatch("en", "es", texts);

      expect(result.size).toBe(3);
      expect(result.get("Hello")).toBe("translated: Hello");
      expect(result.get("Goodbye")).toBe("translated: Goodbye");
      expect(result.get("Thank you")).toBe("translated: Thank you");
    });

    test("handles empty array", async () => {
      const result = await service.translateBatch("en", "es", []);

      expect(result.size).toBe(0);
    });

    test("handles single text", async () => {
      const result = await service.translateBatch("en", "fr", ["Hello"]);

      expect(result.size).toBe(1);
      expect(result.get("Hello")).toBe("translated: Hello");
    });

    test("preserves original text structure", async () => {
      const texts = [
        "Hello world",
        "Line 1\nLine 2\nLine 3",
        "Text with special chars: !@#$%",
        "Unicode: 世界 🌍",
      ];

      const result = await service.translateBatch("en", "de", texts);

      expect(result.size).toBe(4);
      expect(result.get("Hello world")).toBe("translated: Hello world");
      expect(result.get("Line 1\nLine 2\nLine 3")).toBe("translated: Line 1\nLine 2\nLine 3");
      expect(result.get("Text with special chars: !@#$%")).toBe(
        "translated: Text with special chars: !@#$%",
      );
      expect(result.get("Unicode: 世界 🌍")).toBe("translated: Unicode: 世界 🌍");
    });

    test("handles duplicate texts correctly", async () => {
      const texts = ["Hello", "Hello", "Goodbye"];

      const result = await service.translateBatch("en", "es", texts);

      expect(result.size).toBe(2); // Only unique texts
      expect(result.get("Hello")).toBe("translated: Hello");
      expect(result.get("Goodbye")).toBe("translated: Goodbye");
    });

    test("language parameters don't affect mock output", async () => {
      const texts = ["Hello"];

      const result1 = await service.translateBatch("en", "es", texts);
      const result2 = await service.translateBatch("fr", "de", texts);
      const result3 = await service.translateBatch("ja", "ko", texts);

      expect(result1.get("Hello")).toBe("translated: Hello");
      expect(result2.get("Hello")).toBe("translated: Hello");
      expect(result3.get("Hello")).toBe("translated: Hello");
    });

    test("handles very long texts", async () => {
      const longText = "A".repeat(10000);
      const texts = [longText];

      const result = await service.translateBatch("en", "es", texts);

      expect(result.size).toBe(1);
      expect(result.get(longText)).toBe(`translated: ${longText}`);
    });

    test("handles empty strings", async () => {
      const texts = ["", "Hello", ""];

      const result = await service.translateBatch("en", "es", texts);

      expect(result.size).toBe(2); // Empty string and "Hello"
      expect(result.get("")).toBe("translated: ");
      expect(result.get("Hello")).toBe("translated: Hello");
    });

    test("handles texts with only whitespace", async () => {
      const texts = ["   ", "\t\t", "\n\n", "Hello"];

      const result = await service.translateBatch("en", "es", texts);

      expect(result.size).toBe(4);
      expect(result.get("   ")).toBe("translated:    ");
      expect(result.get("\t\t")).toBe("translated: \t\t");
      expect(result.get("\n\n")).toBe("translated: \n\n");
      expect(result.get("Hello")).toBe("translated: Hello");
    });

    test("performance with large batch", async () => {
      const texts = Array.from({ length: 1000 }, (_, i) => `Text number ${i}`);

      const startTime = Date.now();
      const result = await service.translateBatch("en", "es", texts);
      const endTime = Date.now();

      expect(result.size).toBe(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second

      // Spot check some results
      expect(result.get("Text number 0")).toBe("translated: Text number 0");
      expect(result.get("Text number 500")).toBe("translated: Text number 500");
      expect(result.get("Text number 999")).toBe("translated: Text number 999");
    });

    test("maintains Map ordering", async () => {
      const texts = ["First", "Second", "Third", "Fourth"];

      const result = await service.translateBatch("en", "es", texts);

      const keys = Array.from(result.keys());
      expect(keys).toEqual(["First", "Second", "Third", "Fourth"]);
    });

    test("handles FTL variable-like syntax", async () => {
      const texts = ["Hello {$name}", "You have {$count} messages", "Welcome to {$appName}!"];

      const result = await service.translateBatch("en", "es", texts);

      expect(result.size).toBe(3);
      expect(result.get("Hello {$name}")).toBe("translated: Hello {$name}");
      expect(result.get("You have {$count} messages")).toBe(
        "translated: You have {$count} messages",
      );
      expect(result.get("Welcome to {$appName}!")).toBe("translated: Welcome to {$appName}!");
    });

    test("handles HTML-like content", async () => {
      const texts = [
        "<strong>Bold text</strong>",
        "<p>Paragraph with <em>emphasis</em></p>",
        "Text with <br/> line break",
      ];

      const result = await service.translateBatch("en", "es", texts);

      expect(result.size).toBe(3);
      expect(result.get("<strong>Bold text</strong>")).toBe(
        "translated: <strong>Bold text</strong>",
      );
      expect(result.get("<p>Paragraph with <em>emphasis</em></p>")).toBe(
        "translated: <p>Paragraph with <em>emphasis</em></p>",
      );
      expect(result.get("Text with <br/> line break")).toBe(
        "translated: Text with <br/> line break",
      );
    });

    test("mock service is deterministic", async () => {
      const texts = ["Hello", "World"];

      const result1 = await service.translateBatch("en", "es", texts);
      const result2 = await service.translateBatch("en", "es", texts);

      const hello1 = result1.get("Hello");
      const hello2 = result2.get("Hello");
      expect(hello1).toBeDefined();
      expect(hello2).toBeDefined();
      if (hello1 && hello2) {
        expect(hello1).toBe(hello2);
      }

      const world1 = result1.get("World");
      const world2 = result2.get("World");
      expect(world1).toBeDefined();
      expect(world2).toBeDefined();
      if (world1 && world2) {
        expect(world1).toBe(world2);
      }
    });

    test("maintains input-output mapping integrity", async () => {
      const texts = ["Simple text", "Text\nwith\nnewlines", "Text with\ttabs", "Mixed\n\tcontent"];

      const result = await service.translateBatch("en", "es", texts);

      // Each input should have exactly one corresponding output
      for (const text of texts) {
        expect(result.has(text)).toBe(true);
        expect(result.get(text)).toStartWith("translated: ");
        expect(result.get(text)).toContain(text);
      }
    });
  });
});
