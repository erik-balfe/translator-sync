#!/usr/bin/env bun
import { describe, expect, test } from "bun:test";
import {
  areFormatsCompatible,
  getFileFormat,
  parseTranslationFile,
  serializeTranslationFile,
} from "../../../src/utils/universalParser";

describe("Universal Parser", () => {
  describe("parseTranslationFile", () => {
    test("parses FTL files", () => {
      const ftlContent = "hello = Hello world\nwelcome = Welcome {$name}";
      const result = parseTranslationFile("en.ftl", ftlContent);

      expect(result.get("hello")).toBe("Hello world");
      expect(result.get("welcome")).toBe("Welcome {$name}");
      expect(result.size).toBe(2);
    });

    test("parses JSON files", () => {
      const jsonContent = JSON.stringify({
        hello: "Hello world",
        user: {
          welcome: "Welcome {{name}}",
        },
      });

      const result = parseTranslationFile("en.json", jsonContent);

      expect(result.get("hello")).toBe("Hello world");
      expect(result.get("user.welcome")).toBe("Welcome {{name}}");
      expect(result.size).toBe(2);
    });

    test("throws error for unsupported format", () => {
      expect(() => {
        parseTranslationFile("file.txt", "content");
      }).toThrow(/Unsupported file format/);
    });
  });

  describe("serializeTranslationFile", () => {
    test("serializes to FTL format", () => {
      const translations = new Map([
        ["hello", "Hello world"],
        ["welcome", "Welcome {$name}"],
      ]);

      const result = serializeTranslationFile("en.ftl", translations);

      expect(result).toContain("hello = Hello world");
      expect(result).toContain("welcome = Welcome {$name}");
    });

    test("serializes to JSON format", () => {
      const translations = new Map([
        ["hello", "Hello world"],
        ["user.welcome", "Welcome {{name}}"],
      ]);

      const result = serializeTranslationFile("en.json", translations);
      const parsed = JSON.parse(result);

      expect(parsed.hello).toBe("Hello world");
      expect(parsed.user.welcome).toBe("Welcome {{name}}");
    });

    test("throws error for unsupported format", () => {
      const translations = new Map([["key", "value"]]);

      expect(() => {
        serializeTranslationFile("file.txt", translations);
      }).toThrow(/Unsupported file format/);
    });
  });

  describe("getFileFormat", () => {
    test("returns correct format for supported files", () => {
      expect(getFileFormat("en.ftl")).toBe("ftl");
      expect(getFileFormat("en.json")).toBe("json");
      expect(getFileFormat("file.txt")).toBe("unknown");
    });
  });

  describe("areFormatsCompatible", () => {
    test("considers supported formats compatible", () => {
      expect(areFormatsCompatible("en.ftl", "es.ftl")).toBe(true);
      expect(areFormatsCompatible("en.json", "es.json")).toBe(true);
      expect(areFormatsCompatible("en.ftl", "es.json")).toBe(true);
      expect(areFormatsCompatible("en.json", "es.ftl")).toBe(true);
    });

    test("rejects unknown formats", () => {
      expect(areFormatsCompatible("en.txt", "es.ftl")).toBe(false);
      expect(areFormatsCompatible("en.ftl", "es.txt")).toBe(false);
      expect(areFormatsCompatible("en.txt", "es.txt")).toBe(false);
    });
  });
});
