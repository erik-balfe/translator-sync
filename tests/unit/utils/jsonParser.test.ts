#!/usr/bin/env bun
import { beforeEach, describe, expect, test } from "bun:test";
import {
  type JsonTranslation,
  clearStructureCache,
  detectJsonStructure,
  extractVariables,
  flattenJson,
  getVariableInstructions,
  isValidJson,
  parseJsonContent,
  serializeJsonContent,
  unflattenJson,
  validateVariablePreservation,
} from "../../../src/utils/jsonParser";

describe("JSON Parser", () => {
  beforeEach(() => {
    clearStructureCache();
  });

  describe("detectJsonStructure", () => {
    test("detects flat structure", () => {
      const flat: JsonTranslation = {
        "simple.key": "value",
        "another.key.with.dots": "another value",
        'Ask anything. Type "/" for prompts': "Ask anything",
      };
      expect(detectJsonStructure(flat)).toBe("flat");
    });

    test("detects nested structure", () => {
      const nested: JsonTranslation = {
        user: {
          name: "Name",
          email: "Email",
        },
        settings: {
          theme: "dark",
        },
      };
      expect(detectJsonStructure(nested)).toBe("nested");
    });

    test("detects flat for empty object", () => {
      expect(detectJsonStructure({})).toBe("flat");
    });
  });

  describe("flattenJson", () => {
    test("flattens simple nested object", () => {
      const nested = {
        user: {
          name: "John",
          profile: {
            email: "john@example.com",
          },
        },
        app: {
          title: "My App",
        },
      };

      const result = flattenJson(nested);

      expect(result.get("user.name")).toBe("John");
      expect(result.get("user.profile.email")).toBe("john@example.com");
      expect(result.get("app.title")).toBe("My App");
      expect(result.size).toBe(3);
    });

    test("handles flat object", () => {
      const flat = {
        title: "Hello",
        description: "World",
      };

      const result = flattenJson(flat);

      expect(result.get("title")).toBe("Hello");
      expect(result.get("description")).toBe("World");
      expect(result.size).toBe(2);
    });

    test("handles empty object", () => {
      const result = flattenJson({});
      expect(result.size).toBe(0);
    });

    test("handles deeply nested object", () => {
      const deepNested = {
        level1: {
          level2: {
            level3: {
              level4: "value",
            },
          },
        },
      };

      const result = flattenJson(deepNested);
      expect(result.get("level1.level2.level3.level4")).toBe("value");
    });
  });

  describe("unflattenJson", () => {
    test("unflattens dot notation to nested object", () => {
      const translations = new Map([
        ["user.name", "John"],
        ["user.profile.email", "john@example.com"],
        ["app.title", "My App"],
      ]);

      const result = unflattenJson(translations);

      expect(result).toEqual({
        user: {
          name: "John",
          profile: {
            email: "john@example.com",
          },
        },
        app: {
          title: "My App",
        },
      });
    });

    test("handles single level keys", () => {
      const translations = new Map([
        ["title", "Hello"],
        ["description", "World"],
      ]);

      const result = unflattenJson(translations);

      expect(result).toEqual({
        title: "Hello",
        description: "World",
      });
    });

    test("handles empty map", () => {
      const result = unflattenJson(new Map());
      expect(result).toEqual({});
    });
  });

  describe("parseJsonContent", () => {
    test("parses flat JSON preserving dots in keys", () => {
      const json = JSON.stringify({
        'Ask anything. Type "/" for prompts': "Ask anything",
        "Show Help": "Show Help",
      });
      const result = parseJsonContent(json);
      expect(result.get('Ask anything. Type "/" for prompts')).toBe("Ask anything");
      expect(result.get("Show Help")).toBe("Show Help");
      expect(result.size).toBe(2);
    });

    test("parses nested JSON with flattening", () => {
      const json = JSON.stringify({
        user: {
          name: "John",
          settings: {
            theme: "dark",
          },
        },
      });
      const result = parseJsonContent(json);
      expect(result.get("user.name")).toBe("John");
      expect(result.get("user.settings.theme")).toBe("dark");
      expect(result.size).toBe(2);
    });

    test("caches structure when filePath provided", () => {
      const flatJson = JSON.stringify({
        "key.with.dots": "value",
      });
      parseJsonContent(flatJson, "test.json");

      // Serialize should preserve flat structure
      const result = serializeJsonContent(new Map([["key.with.dots", "translated"]]), "test.json");
      const parsed = JSON.parse(result);
      expect(parsed["key.with.dots"]).toBe("translated");
    });

    test("parses valid JSON", () => {
      const json = JSON.stringify({ key: "value" });
      const result = parseJsonContent(json);
      expect(result.get("key")).toBe("value");
    });

    test("throws on invalid JSON", () => {
      expect(() => parseJsonContent("invalid json")).toThrow("Invalid JSON translation file");
    });
  });

  describe("serializeJsonContent", () => {
    test("serializes flat structure when detected", () => {
      const translations = new Map([
        ['Ask anything. Type "/" for prompts', "Pregunta lo que quieras"],
        ["Show Help", "Mostrar Ayuda"],
      ]);
      const result = serializeJsonContent(translations, undefined, "flat");
      const parsed = JSON.parse(result);
      expect(parsed['Ask anything. Type "/" for prompts']).toBe("Pregunta lo que quieras");
      expect(parsed["Show Help"]).toBe("Mostrar Ayuda");
    });

    test("serializes nested structure when forced", () => {
      const translations = new Map([
        ["user.name", "Name"],
        ["user.email", "Email"],
      ]);
      const result = serializeJsonContent(translations, undefined, "nested");
      const parsed = JSON.parse(result);
      expect(parsed.user.name).toBe("Name");
      expect(parsed.user.email).toBe("Email");
    });

    test("auto-detects nested structure from key patterns", () => {
      const translations = new Map([
        ["user.name", "Name"],
        ["user.email", "Email"],
        ["settings.theme", "Theme"],
      ]);
      const result = serializeJsonContent(translations);
      const parsed = JSON.parse(result);
      expect(parsed.user.name).toBe("Name");
      expect(parsed.user.email).toBe("Email");
      expect(parsed.settings.theme).toBe("Theme");
    });

    test("preserves flat structure for single dot keys", () => {
      const translations = new Map([
        ["version.1.0", "Version 1.0"],
        ["api.key", "API Key"],
      ]);
      const result = serializeJsonContent(translations);
      const parsed = JSON.parse(result);
      expect(parsed["version.1.0"]).toBe("Version 1.0");
      expect(parsed["api.key"]).toBe("API Key");
    });

    test("uses cached structure from parsing", () => {
      // Parse a flat file first
      const originalJson = JSON.stringify({
        "key.with.dots": "original",
        "another.key": "value",
      });
      parseJsonContent(originalJson, "cached.json");

      // Serialize with different content should preserve flat structure
      const newTranslations = new Map([
        ["key.with.dots", "translated"],
        ["another.key", "translated value"],
        ["new.key", "new value"],
      ]);
      const result = serializeJsonContent(newTranslations, "cached.json");
      const parsed = JSON.parse(result);

      expect(parsed["key.with.dots"]).toBe("translated");
      expect(parsed["another.key"]).toBe("translated value");
      expect(parsed["new.key"]).toBe("new value");
    });

    test("serializes to nested object", () => {
      const translations = new Map([
        ["user.name", "John"],
        ["user.profile.email", "john@example.com"],
      ]);

      const result = serializeJsonContent(translations, undefined, "nested");
      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        user: {
          name: "John",
          profile: {
            email: "john@example.com",
          },
        },
      });
    });

    test("handles empty translations", () => {
      const result = serializeJsonContent(new Map());
      expect(result).toBe("{}");
    });

    test("formats JSON with proper indentation", () => {
      const translations = new Map([["key", "value"]]);
      const result = serializeJsonContent(translations);
      expect(result).toContain("\n");
      expect(result).toContain("  ");
    });
  });

  describe("isValidJson", () => {
    test("returns true for valid JSON", () => {
      expect(isValidJson("{}")).toBe(true);
      expect(isValidJson('{"key": "value"}')).toBe(true);
      expect(isValidJson("[]")).toBe(true);
      expect(isValidJson("null")).toBe(true);
      expect(isValidJson("123")).toBe(true);
      expect(isValidJson('"string"')).toBe(true);
    });

    test("returns false for invalid JSON", () => {
      expect(isValidJson("")).toBe(false);
      expect(isValidJson("invalid")).toBe(false);
      expect(isValidJson("{key: value}")).toBe(false);
      expect(isValidJson("{'key': 'value'}")).toBe(false);
      expect(isValidJson("{,}")).toBe(false);
    });
  });

  describe("extractVariables", () => {
    test("extracts React i18next variables", () => {
      const text = "Hello {{name}}, you have {{count}} messages";
      const vars = extractVariables(text);
      expect(vars).toContain("{{name}}");
      expect(vars).toContain("{{count}}");
      expect(vars).toHaveLength(2);
    });

    test("extracts Vue i18n variables", () => {
      const text = "Hello {name}, your balance is {balance}";
      const vars = extractVariables(text);
      expect(vars).toContain("{name}");
      expect(vars).toContain("{balance}");
      expect(vars).toHaveLength(2);
    });

    test("extracts Ruby i18n variables", () => {
      const text = "Welcome %{user} to %{app}";
      const vars = extractVariables(text);
      expect(vars).toContain("%{user}");
      expect(vars).toContain("%{app}");
      expect(vars).toHaveLength(2);
    });

    test("extracts Fluent variables", () => {
      const text = "You have {$unread} unread messages in {$folder}";
      const vars = extractVariables(text);
      expect(vars).toContain("{$unread}");
      expect(vars).toContain("{$folder}");
      expect(vars).toHaveLength(2);
    });

    test("handles mixed formats", () => {
      const text = "User {{name}} has {count} items and %{percentage}% complete";
      const vars = extractVariables(text);
      expect(vars).toContain("{{name}}");
      expect(vars).toContain("{count}");
      expect(vars).toContain("%{percentage}");
      expect(vars).toHaveLength(3);
    });

    test("handles text with no variables", () => {
      const text = "Simple text without any variables";
      const vars = extractVariables(text);
      expect(vars).toHaveLength(0);
    });

    test("avoids duplicates", () => {
      const text = "Hello {{name}} and goodbye {{name}}";
      const vars = extractVariables(text);
      expect(vars).toContain("{{name}}");
      expect(vars).toHaveLength(1);
    });

    test("handles nested braces correctly", () => {
      const text = "Value: {{formatNumber({value})}}";
      const vars = extractVariables(text);
      expect(vars).toContain("{{formatNumber({value})}}");
      expect(vars).toHaveLength(1);
    });
  });

  describe("validateVariablePreservation", () => {
    test("validates when all variables are preserved", () => {
      const source = "Hello {{name}}, you have {{count}} items";
      const translation = "Hola {{name}}, tienes {{count}} elementos";
      expect(validateVariablePreservation(source, translation)).toBe(true);
    });

    test("fails when variables are missing", () => {
      const source = "Hello {{name}}";
      const translation = "Hola";
      expect(validateVariablePreservation(source, translation)).toBe(false);
    });

    test("fails when variables are modified", () => {
      const source = "Hello {{name}}";
      const translation = "Hola {{nombre}}";
      expect(validateVariablePreservation(source, translation)).toBe(false);
    });

    test("handles empty strings", () => {
      expect(validateVariablePreservation("", "")).toBe(true);
      expect(validateVariablePreservation("Hello", "Hola")).toBe(true);
    });

    test("validates different variable formats", () => {
      const source = "User {name} has %{count} items";
      const translation = "Usuario {name} tiene %{count} elementos";
      expect(validateVariablePreservation(source, translation)).toBe(true);
    });
  });

  describe("getVariableInstructions", () => {
    test("generates instructions for React i18next format", () => {
      const text = "Hello {{name}}";
      const instructions = getVariableInstructions(text);
      expect(instructions).toContain("React i18next format");
      expect(instructions).toContain("{{name}}");
    });

    test("generates instructions for Vue i18n format", () => {
      const text = "Hello {name}";
      const instructions = getVariableInstructions(text);
      expect(instructions).toContain("Vue i18n / React Intl format");
      expect(instructions).toContain("{name}");
    });

    test("generates instructions for multiple formats", () => {
      const text = "{{user}} has {count} items, %{percentage}% done";
      const instructions = getVariableInstructions(text);
      expect(instructions).toContain("React i18next");
      expect(instructions).toContain("Vue i18n");
      expect(instructions).toContain("Ruby i18n");
    });

    test("returns empty string for no variables", () => {
      const text = "Simple text";
      const instructions = getVariableInstructions(text);
      expect(instructions).toBe("");
    });

    test("lists all found variables", () => {
      const text = "{{var1}} and {{var2}}";
      const instructions = getVariableInstructions(text);
      expect(instructions).toContain("{{var1}}");
      expect(instructions).toContain("{{var2}}");
    });
  });

  describe("Real-world test cases", () => {
    test("handles Chatbot UI translation format correctly", () => {
      const englishJson = {
        'Ask anything. Type "/" for prompts, "@" for files, and "#" for tools.':
          'Ask anything. Type "/" for prompts, "@" for files, and "#" for tools.',
      };

      // Parse
      const content = JSON.stringify(englishJson);
      const parsed = parseJsonContent(content, "en/translation.json");
      expect(parsed.size).toBe(1);
      expect(
        parsed.get('Ask anything. Type "/" for prompts, "@" for files, and "#" for tools.'),
      ).toBe('Ask anything. Type "/" for prompts, "@" for files, and "#" for tools.');

      // Translate and serialize
      const translated = new Map([
        [
          'Ask anything. Type "/" for prompts, "@" for files, and "#" for tools.',
          'Pregunta lo que quieras. Escribe "/" para prompts, "@" para archivos y "#" para herramientas.',
        ],
      ]);
      const serialized = serializeJsonContent(translated, "es/translation.json");
      const result = JSON.parse(serialized);

      // Should preserve flat structure
      expect(result['Ask anything. Type "/" for prompts, "@" for files, and "#" for tools.']).toBe(
        'Pregunta lo que quieras. Escribe "/" para prompts, "@" para archivos y "#" para herramientas.',
      );
    });

    test("handles complex nested i18n structure", () => {
      const nestedJson = {
        common: {
          buttons: {
            save: "Save",
            cancel: "Cancel",
          },
          messages: {
            success: "Operation successful",
            error: "An error occurred",
          },
        },
        pages: {
          home: {
            title: "Welcome",
            subtitle: "Get started here",
          },
        },
      };

      const content = JSON.stringify(nestedJson);
      const parsed = parseJsonContent(content, "en/common.json");

      expect(parsed.get("common.buttons.save")).toBe("Save");
      expect(parsed.get("common.messages.error")).toBe("An error occurred");
      expect(parsed.get("pages.home.title")).toBe("Welcome");

      // Serialize back should preserve nested structure
      const serialized = serializeJsonContent(parsed, "en/common.json");
      const result = JSON.parse(serialized);

      expect(result.common.buttons.save).toBe("Save");
      expect(result.pages.home.title).toBe("Welcome");
    });

    test("handles mixed content without breaking structure", () => {
      // Flat structure with dots
      const flatWithDots = {
        "version.1.0.0": "Version 1.0.0",
        "api.endpoint.url": "API Endpoint URL",
      };

      const parsed = parseJsonContent(JSON.stringify(flatWithDots), "config.json");
      const serialized = serializeJsonContent(parsed, "config.json");
      const result = JSON.parse(serialized);

      expect(result["version.1.0.0"]).toBe("Version 1.0.0");
      expect(result["api.endpoint.url"]).toBe("API Endpoint URL");
    });
  });
});
