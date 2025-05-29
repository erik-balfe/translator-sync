#!/usr/bin/env bun
import { describe, expect, test } from "bun:test";
import {
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
  });

  describe("unflattenJson", () => {
    test("unflattens dot notation keys", () => {
      const flat = new Map([
        ["user.name", "John"],
        ["user.profile.email", "john@example.com"],
        ["app.title", "My App"],
      ]);

      const result = unflattenJson(flat);

      expect(result.user.name).toBe("John");
      expect(result.user.profile.email).toBe("john@example.com");
      expect(result.app.title).toBe("My App");
    });

    test("handles single-level keys", () => {
      const flat = new Map([
        ["title", "Hello"],
        ["description", "World"],
      ]);

      const result = unflattenJson(flat);

      expect(result.title).toBe("Hello");
      expect(result.description).toBe("World");
    });
  });

  describe("parseJsonContent", () => {
    test("parses valid JSON with nested structure", () => {
      const json = JSON.stringify({
        hello: "Hello {{name}}",
        user: {
          profile: {
            email: "Email: {email}",
          },
        },
      });

      const result = parseJsonContent(json);

      expect(result.get("hello")).toBe("Hello {{name}}");
      expect(result.get("user.profile.email")).toBe("Email: {email}");
      expect(result.size).toBe(2);
    });

    test("throws error for invalid JSON", () => {
      expect(() => parseJsonContent("invalid json")).toThrow(/Invalid JSON translation file/);
    });
  });

  describe("serializeJsonContent", () => {
    test("serializes flat translations to nested JSON", () => {
      const translations = new Map([
        ["hello", "Hello {{name}}"],
        ["user.profile.email", "Email: {email}"],
        ["app.title", "My App"],
      ]);

      const result = serializeJsonContent(translations);
      const parsed = JSON.parse(result);

      expect(parsed.hello).toBe("Hello {{name}}");
      expect(parsed.user.profile.email).toBe("Email: {email}");
      expect(parsed.app.title).toBe("My App");
    });
  });

  describe("isValidJson", () => {
    test("validates correct JSON", () => {
      expect(isValidJson('{"key": "value"}')).toBe(true);
      expect(isValidJson("[]")).toBe(true);
      expect(isValidJson("null")).toBe(true);
    });

    test("rejects invalid JSON", () => {
      expect(isValidJson("invalid")).toBe(false);
      expect(isValidJson("{key: value}")).toBe(false);
      expect(isValidJson("")).toBe(false);
    });
  });

  describe("extractVariables", () => {
    test("extracts React i18next variables", () => {
      const variables = extractVariables("Hello {{name}} and {{age}}!");
      expect(variables).toContain("{{name}}");
      expect(variables).toContain("{{age}}");
      expect(variables).toHaveLength(2);
    });

    test("extracts Vue i18n variables", () => {
      const variables = extractVariables("Hello {name} and {age}!");
      expect(variables).toContain("{name}");
      expect(variables).toContain("{age}");
      expect(variables).toHaveLength(2);
    });

    test("extracts Ruby i18n variables", () => {
      const variables = extractVariables("Hello %{name} and %{age}!");
      expect(variables).toContain("%{name}");
      expect(variables).toContain("%{age}");
      expect(variables).toHaveLength(2);
    });

    test("extracts Fluent variables", () => {
      const variables = extractVariables("Hello {$name} and {$age}!");
      expect(variables).toContain("{$name}");
      expect(variables).toContain("{$age}");
      expect(variables).toHaveLength(2);
    });

    test("extracts mixed variable formats", () => {
      const variables = extractVariables("Hello {{react}} {vue} %{ruby} {$fluent}!");
      expect(variables).toContain("{{react}}");
      expect(variables).toContain("{vue}");
      expect(variables).toContain("%{ruby}");
      expect(variables).toContain("{$fluent}");
      expect(variables).toHaveLength(4);
    });

    test("returns empty array for text without variables", () => {
      const variables = extractVariables("Hello world!");
      expect(variables).toHaveLength(0);
    });
  });

  describe("validateVariablePreservation", () => {
    test("validates preserved variables", () => {
      const source = "Hello {{name}} and {age}!";
      const translation = "Hola {{name}} y {age}!";

      expect(validateVariablePreservation(source, translation)).toBe(true);
    });

    test("detects missing variables", () => {
      const source = "Hello {{name}} and {age}!";
      const translation = "Hola {{name}}!"; // Missing {age}

      expect(validateVariablePreservation(source, translation)).toBe(false);
    });

    test("allows extra variables in translation", () => {
      const source = "Hello {{name}}!";
      const translation = "Hola {{name}} y {extra}!"; // Extra variable is OK

      expect(validateVariablePreservation(source, translation)).toBe(true);
    });
  });

  describe("getVariableInstructions", () => {
    test("generates instructions for React i18next", () => {
      const instructions = getVariableInstructions("Hello {{name}}!");
      expect(instructions).toContain("React i18next format");
      expect(instructions).toContain("{{name}}");
    });

    test("generates instructions for mixed formats", () => {
      const instructions = getVariableInstructions("Hello {{react}} {vue} %{ruby}!");
      expect(instructions).toContain("React i18next format");
      expect(instructions).toContain("Vue i18n / React Intl format");
      expect(instructions).toContain("Ruby i18n format");
    });

    test("returns empty string for no variables", () => {
      const instructions = getVariableInstructions("Hello world!");
      expect(instructions).toBe("");
    });
  });
});
