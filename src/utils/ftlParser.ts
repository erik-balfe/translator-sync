#!/usr/bin/env bun
import { parse } from "@fluent/syntax";

/**
 * Parses FTL content and returns a map of message IDs to their values.
 */
export function parseFTLContent(content: string): Map<string, string> {
  const resource = parse(content, {});
  const translations = new Map<string, string>();
  for (const entry of resource.body) {
    if (entry.type === "Message" && entry.id && entry.id.name) {
      const key = entry.id.name;
      let value = "";
      if (entry.value) {
        for (const element of entry.value.elements) {
          if (element.type === "TextElement") {
            value += element.value;
          } else if (element.type === "Placeable") {
            // Handle variables and other placeables
            if (element.expression.type === "VariableReference") {
              value += `{$${element.expression.id.name}}`;
            } else {
              // For other placeable types, try to serialize them
              value += `{${JSON.stringify(element.expression)}}`;
            }
          }
        }
      }
      translations.set(key, value);
    }
  }
  return translations;
}

/**
 * Serializes a map of translations into FTL content.
 * If a value contains newline characters, it is formatted as a multiline block.
 */
export function serializeFTLContent(translations: Map<string, string>): string {
  let output = "";
  for (const [key, value] of translations) {
    if (value.includes("\n")) {
      const lines = value.split("\n");
      // Format as Fluent multiline block: key = then subsequent lines indented.
      const indented = lines.map((line) => line.trimEnd()).join("\n    ");
      output += `${key} =\n    ${indented}\n`;
    } else {
      output += `${key} = ${value}\n`;
    }
  }
  return output;
}
