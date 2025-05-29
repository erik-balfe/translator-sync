#!/usr/bin/env bun
import { describe, expect, test } from "bun:test";
import { parseFTLContent, serializeFTLContent } from "../../../src/utils/ftlParser";

describe("ftlParser", () => {
  describe("parseFTLContent", () => {
    test("parses simple key-value pairs", () => {
      const content = `hello = Hello, World!
greeting = Welcome to our app`;

      const result = parseFTLContent(content);

      expect(result.size).toBe(2);
      expect(result.get("hello")).toBe("Hello, World!");
      expect(result.get("greeting")).toBe("Welcome to our app");
    });

    test("handles empty content", () => {
      const result = parseFTLContent("");
      expect(result.size).toBe(0);
    });

    test("ignores comments", () => {
      const content = `# This is a comment
hello = Hello, World!
# Another comment
greeting = Welcome`;

      const result = parseFTLContent(content);

      expect(result.size).toBe(2);
      expect(result.get("hello")).toBe("Hello, World!");
      expect(result.get("greeting")).toBe("Welcome");
    });

    test("parses multiline values", () => {
      const content = `long_message =
    This is line one
    This is line two
    This is line three`;

      const result = parseFTLContent(content);

      expect(result.size).toBe(1);
      const value = result.get("long_message");
      expect(value).toContain("This is line one");
      expect(value).toContain("This is line two");
      expect(value).toContain("This is line three");
    });

    test("handles special characters and Unicode", () => {
      const content = `emoji = 😊🌍🚀
punctuation = Test, with; various: punctuation!
unicode = café naïve résumé`;

      const result = parseFTLContent(content);

      expect(result.size).toBe(3);
      expect(result.get("emoji")).toBe("😊🌍🚀");
      expect(result.get("punctuation")).toBe("Test, with; various: punctuation!");
      expect(result.get("unicode")).toBe("café naïve résumé");
    });

    test("handles numeric and symbolic values", () => {
      const content = `number = 42
path = /usr/local/bin
symbols = #$%&*@`;

      const result = parseFTLContent(content);

      expect(result.size).toBe(3);
      expect(result.get("number")).toBe("42");
      expect(result.get("path")).toBe("/usr/local/bin");
      expect(result.get("symbols")).toBe("#$%&*@");
    });

    test("handles empty values", () => {
      // Note: The FTL parser has limitations with truly empty values
      // This test documents current behavior rather than ideal behavior
      const content = `empty_value = ""
another_key = Some content`;

      const result = parseFTLContent(content);

      expect(result.size).toBe(2);
      expect(result.get("empty_value")).toBe(`""`);
      expect(result.get("another_key")).toBe("Some content");
    });

    test("handles complex FTL syntax gracefully", () => {
      // This tests that our parser handles more complex FTL without breaking
      const content = `simple = Hello
# A message with attributes (should only extract main message)
complex = Main message
    .tooltip = Tooltip text
    .aria-label = Aria label`;

      const result = parseFTLContent(content);

      expect(result.size).toBe(2);
      expect(result.get("simple")).toBe("Hello");
      expect(result.get("complex")).toBe("Main message");
    });

    test("handles malformed FTL gracefully", () => {
      const content = `valid = This is valid
invalid key without equals
another_valid = This works`;

      // Should not throw and should parse valid entries
      const result = parseFTLContent(content);

      expect(result.get("valid")).toBe("This is valid");
      expect(result.get("another_valid")).toBe("This works");
    });
  });

  describe("serializeFTLContent", () => {
    test("serializes simple key-value pairs", () => {
      const translations = new Map([
        ["hello", "Hello, World!"],
        ["greeting", "Welcome to our app"],
      ]);

      const result = serializeFTLContent(translations);

      expect(result).toContain("hello = Hello, World!");
      expect(result).toContain("greeting = Welcome to our app");
    });

    test("handles empty map", () => {
      const translations = new Map();
      const result = serializeFTLContent(translations);
      expect(result).toBe("");
    });

    test("formats multiline values correctly", () => {
      const translations = new Map([["multiline", "Line one\nLine two\nLine three"]]);

      const result = serializeFTLContent(translations);

      expect(result).toContain("multiline =");
      expect(result).toContain("    Line one");
      expect(result).toContain("    Line two");
      expect(result).toContain("    Line three");
    });

    test("handles mixed single-line and multiline values", () => {
      const translations = new Map([
        ["simple", "Simple value"],
        ["complex", "Line one\nLine two"],
        ["another_simple", "Another simple value"],
      ]);

      const result = serializeFTLContent(translations);

      expect(result).toContain("simple = Simple value");
      expect(result).toContain("complex =\n    Line one");
      expect(result).toContain("another_simple = Another simple value");
    });

    test("preserves special characters", () => {
      const translations = new Map([
        ["emoji", "😊🌍🚀"],
        ["symbols", "#$%&*@"],
        ["unicode", "café naïve résumé"],
      ]);

      const result = serializeFTLContent(translations);

      expect(result).toContain("emoji = 😊🌍🚀");
      expect(result).toContain("symbols = #$%&*@");
      expect(result).toContain("unicode = café naïve résumé");
    });

    test("handles empty values", () => {
      const translations = new Map([
        ["empty", ""],
        ["normal", "Normal value"],
      ]);

      const result = serializeFTLContent(translations);

      expect(result).toContain("empty = ");
      expect(result).toContain("normal = Normal value");
    });

    test("maintains order of entries", () => {
      const translations = new Map([
        ["first", "First value"],
        ["second", "Second value"],
        ["third", "Third value"],
      ]);

      const result = serializeFTLContent(translations);
      const lines = result.split("\n").filter((line) => line.trim());

      expect(lines[0]).toContain("first = First value");
      expect(lines[1]).toContain("second = Second value");
      expect(lines[2]).toContain("third = Third value");
    });
  });

  describe("round-trip consistency", () => {
    test("parse and serialize simple content maintains integrity", () => {
      const originalContent = `hello = Hello, World!
greeting = Welcome to our app
farewell = Goodbye!`;

      const parsed = parseFTLContent(originalContent);
      const serialized = serializeFTLContent(parsed);
      const reparsed = parseFTLContent(serialized);

      expect(reparsed.size).toBe(parsed.size);
      for (const [key, value] of parsed) {
        expect(reparsed.get(key)).toBe(value);
      }
    });

    test("parse and serialize multiline content", () => {
      const originalContent = `simple = Hello
multiline =
    First line
    Second line
    Third line`;

      const parsed = parseFTLContent(originalContent);
      const serialized = serializeFTLContent(parsed);
      const reparsed = parseFTLContent(serialized);

      expect(reparsed.size).toBe(parsed.size);
      const simpleValue = parsed.get("simple");
      expect(simpleValue).toBeDefined();
      if (simpleValue) {
        expect(reparsed.get("simple")).toBe(simpleValue);
      }

      // Multiline content should preserve essential content
      const originalMultiline = parsed.get("multiline");
      const reparsedMultiline = reparsed.get("multiline");
      expect(reparsedMultiline).toContain("First line");
      expect(reparsedMultiline).toContain("Second line");
      expect(reparsedMultiline).toContain("Third line");
    });

    test("handles edge cases in round-trip", () => {
      const translations = new Map([
        ["spaces", "  with spaces  "],
        ["tabs", "\twith\ttabs\t"],
        ["mixed", "Mixed\n  content\nwith spaces"],
      ]);

      const serialized = serializeFTLContent(translations);
      const reparsed = parseFTLContent(serialized);

      // Note: Empty values don't round-trip perfectly due to FTL parser behavior
      expect(reparsed.size).toBe(3);
      expect(reparsed.get("spaces")).toContain("with spaces");
      expect(reparsed.get("tabs")).toContain("with");
      expect(reparsed.get("mixed")).toContain("Mixed");
    });
  });

  describe("error handling", () => {
    test("handles severely malformed FTL without throwing", () => {
      const malformedContent = `this is not ftl at all
random text here
= missing key
key = 
another random line`;

      expect(() => parseFTLContent(malformedContent)).not.toThrow();

      const result = parseFTLContent(malformedContent);
      // Should still extract any valid key-value pairs it can find
      expect(result instanceof Map).toBe(true);
    });

    test("handles null and undefined gracefully", () => {
      // TypeScript should prevent this, but test runtime behavior
      expect(() => parseFTLContent(null as any)).toThrow();
      expect(() => parseFTLContent(undefined as any)).toThrow();
    });

    test("handles very large content", () => {
      // Create a large FTL content string
      const largeContent = Array.from(
        { length: 1000 },
        (_, i) => `key${i} = Value number ${i} with some content`,
      ).join("\n");

      const result = parseFTLContent(largeContent);
      expect(result.size).toBe(1000);
      expect(result.get("key0")).toBe("Value number 0 with some content");
      expect(result.get("key999")).toBe("Value number 999 with some content");
    });
  });
});
