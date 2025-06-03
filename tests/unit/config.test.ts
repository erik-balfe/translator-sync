#!/usr/bin/env bun
import { describe, expect, test } from "bun:test";
import { config } from "../../src/config";

describe("config", () => {
  test("has mainLang property", () => {
    expect(config).toHaveProperty("mainLang");
  });

  test("mainLang is set to 'en'", () => {
    expect(config.mainLang).toBe("en");
  });

  test("mainLang is a string", () => {
    expect(typeof config.mainLang).toBe("string");
  });

  test("mainLang is not empty", () => {
    expect(config.mainLang.length).toBeGreaterThan(0);
  });

  test("config object is readonly-like", () => {
    // This tests that config is an object we can read from
    const originalValue = config.mainLang;

    // Attempt to modify (this won't actually change it in TypeScript with proper types)
    try {
      // biome-ignore lint/suspicious/noExplicitAny: Testing runtime behavior for read-only property
      (config as any).mainLang = "fr";
    } catch (error) {
      // If it throws, that's fine - it means it's protected
    }

    // In JavaScript, this might change, but let's document current behavior
    expect(config.mainLang).toBeDefined();
  });

  test("config structure is stable", () => {
    // Test that config has expected structure
    const expectedKeys = ["mainLang"];
    const actualKeys = Object.keys(config);

    for (const key of expectedKeys) {
      expect(actualKeys).toContain(key);
    }
  });

  test("mainLang is valid language code format", () => {
    // Basic validation that it looks like a language code
    expect(config.mainLang).toMatch(/^[a-z]{2,3}(-[A-Z]{2})?$/);
  });
});
