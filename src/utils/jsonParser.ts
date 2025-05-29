#!/usr/bin/env bun

/**
 * JSON translation file parser and serializer.
 * Supports flat and nested JSON structures used by React i18next, Vue i18n, etc.
 */

import { logger } from "./logger";

export interface JsonTranslation {
  [key: string]: string | JsonTranslation;
}

/**
 * Flatten nested JSON to dot notation keys.
 * Example: {user: {name: "Name"}} -> {"user.name": "Name"}
 */
export function flattenJson(obj: JsonTranslation, prefix = ""): Map<string, string> {
  const result = new Map<string, string>();

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === "string") {
      result.set(fullKey, value);
    } else if (typeof value === "object" && value !== null) {
      const nested = flattenJson(value, fullKey);
      for (const [nestedKey, nestedValue] of nested) {
        result.set(nestedKey, nestedValue);
      }
    }
  }

  return result;
}

/**
 * Unflatten dot notation keys back to nested JSON.
 * Example: {"user.name": "Name"} -> {user: {name: "Name"}}
 */
export function unflattenJson(translations: Map<string, string>): JsonTranslation {
  const result: JsonTranslation = {};

  for (const [key, value] of translations) {
    const parts = key.split(".");
    let current = result;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part] as JsonTranslation;
    }

    current[parts[parts.length - 1]] = value;
  }

  return result;
}

/**
 * Parse JSON translation file content.
 */
export function parseJsonContent(content: string): Map<string, string> {
  try {
    const parsed = JSON.parse(content) as JsonTranslation;
    return flattenJson(parsed);
  } catch (error) {
    logger.error(`Failed to parse JSON content: ${error}`);
    throw new Error(`Invalid JSON translation file: ${error}`);
  }
}

/**
 * Serialize translations to JSON format.
 */
export function serializeJsonContent(translations: Map<string, string>): string {
  try {
    const nested = unflattenJson(translations);
    return JSON.stringify(nested, null, 2);
  } catch (error) {
    logger.error(`Failed to serialize JSON content: ${error}`);
    throw new Error(`Failed to serialize translations: ${error}`);
  }
}

/**
 * Validate if content is valid JSON.
 */
export function isValidJson(content: string): boolean {
  try {
    JSON.parse(content);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract variables from a translation string.
 * Supports multiple formats:
 * - React i18next: {{variable}}
 * - Vue i18n: {variable}
 * - React Intl: {variable}
 * - Ruby i18n: %{variable}
 * - Fluent: {$variable}
 */
export function extractVariables(text: string): string[] {
  const variables = new Set<string>();

  // Process in order of specificity to avoid conflicts
  // 1. React i18next: {{variable}}
  const reactMatches = text.match(/\{\{[^}]+\}\}/g);
  if (reactMatches) {
    for (const match of reactMatches) {
      variables.add(match);
    }
  }

  // 2. Ruby i18n: %{variable}
  const rubyMatches = text.match(/%\{[^}]+\}/g);
  if (rubyMatches) {
    for (const match of rubyMatches) {
      variables.add(match);
    }
  }

  // 3. Fluent: {$variable}
  const fluentMatches = text.match(/\{\$[^}]+\}/g);
  if (fluentMatches) {
    for (const match of fluentMatches) {
      variables.add(match);
    }
  }

  // 4. Vue i18n / React Intl: {variable} (but not already captured)
  // First, create a cleaned text with already captured variables removed
  let cleanedText = text;
  for (const variable of variables) {
    cleanedText = cleanedText.replace(new RegExp(escapeRegex(variable), "g"), "");
  }

  const vueMatches = cleanedText.match(/\{[^}$%]+\}/g);
  if (vueMatches) {
    for (const match of vueMatches) {
      variables.add(match);
    }
  }

  return Array.from(variables);
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Check if a translation preserves all variables from the source.
 */
export function validateVariablePreservation(source: string, translation: string): boolean {
  const sourceVars = extractVariables(source);
  const translationVars = extractVariables(translation);

  // Check if all source variables are present in translation
  for (const variable of sourceVars) {
    if (!translationVars.includes(variable)) {
      logger.warn(`Variable ${variable} missing in translation`);
      return false;
    }
  }

  return true;
}

/**
 * Get variable preservation instructions for LLM based on detected patterns.
 */
export function getVariableInstructions(text: string): string {
  const variables = extractVariables(text);

  if (variables.length === 0) {
    return "";
  }

  const patterns = new Set<string>();

  for (const variable of variables) {
    if (variable.startsWith("{{") && variable.endsWith("}}")) {
      patterns.add("React i18next format ({{variable}})");
    } else if (variable.startsWith("{$")) {
      patterns.add("Fluent format ({$variable})");
    } else if (variable.startsWith("%{")) {
      patterns.add("Ruby i18n format (%{variable})");
    } else if (variable.startsWith("{") && variable.endsWith("}")) {
      patterns.add("Vue i18n / React Intl format ({variable})");
    }
  }

  return `CRITICAL: Preserve ALL variables exactly as they appear. Detected formats: ${Array.from(patterns).join(", ")}. Variables found: ${variables.join(", ")}`;
}
