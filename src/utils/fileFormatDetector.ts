#!/usr/bin/env bun

import { isValidJson } from "./jsonParser.ts";

/**
 * Supported translation file formats.
 */
export type FileFormat = "ftl" | "json" | "unknown";

/**
 * Detect file format based on extension and content.
 */
export function detectFileFormat(filename: string, content?: string): FileFormat {
  // Primary detection: file extension
  const extension = filename.toLowerCase().split(".").pop();

  switch (extension) {
    case "ftl":
      return "ftl";
    case "json":
      return "json";
    default:
      // Fallback: content-based detection
      if (content) {
        return detectFormatFromContent(content);
      }
      return "unknown";
  }
}

/**
 * Detect format from file content.
 */
function detectFormatFromContent(content: string): FileFormat {
  const trimmed = content.trim();

  // Check if it's valid JSON
  if (isValidJson(trimmed)) {
    return "json";
  }

  // Check for FTL patterns
  if (hasFtlPatterns(trimmed)) {
    return "ftl";
  }

  return "unknown";
}

/**
 * Check if content has FTL-specific patterns.
 */
function hasFtlPatterns(content: string): boolean {
  // FTL patterns
  const ftlPatterns = [
    /^[a-zA-Z][a-zA-Z0-9_-]*\s*=/m, // key = value
    /\{\$[a-zA-Z][a-zA-Z0-9_-]*\}/, // {$variable}
    /\*\[[^\]]+\]/, // *[variant]
    /\.([a-zA-Z][a-zA-Z0-9_-]*)\s*=/, // .attribute = value
  ];

  return ftlPatterns.some((pattern) => pattern.test(content));
}

/**
 * Get supported file extensions for a format.
 */
export function getSupportedExtensions(format: FileFormat): string[] {
  switch (format) {
    case "ftl":
      return [".ftl"];
    case "json":
      return [".json"];
    default:
      return [];
  }
}

/**
 * Get all supported file extensions.
 */
export function getAllSupportedExtensions(): string[] {
  return [".ftl", ".json"];
}

/**
 * Check if a file is supported based on its extension.
 */
export function isSupportedFile(filename: string): boolean {
  const extension = `.${filename.toLowerCase().split(".").pop()}`;
  return getAllSupportedExtensions().includes(extension);
}
