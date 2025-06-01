#!/usr/bin/env bun

import { type FileFormat, detectFileFormat } from "./fileFormatDetector.ts";
import { parseFTLContent, serializeFTLContent } from "./ftlParser.ts";
import { parseJsonContent, serializeJsonContent } from "./jsonParser.ts";
import { logger } from "./logger.ts";

/**
 * Parse translation file content regardless of format.
 */
export function parseTranslationFile(
  filename: string,
  content: string,
  filePath?: string,
): Map<string, string> {
  const format = detectFileFormat(filename, content);

  switch (format) {
    case "ftl":
      logger.debug(`Parsing ${filename} as FTL format`);
      return parseFTLContent(content);

    case "json":
      logger.debug(`Parsing ${filename} as JSON format`);
      return parseJsonContent(content, filePath);

    default:
      throw new Error(
        `Unsupported file format for ${filename}. Supported formats: FTL (.ftl), JSON (.json)`,
      );
  }
}

/**
 * Serialize translations to the appropriate format based on filename.
 */
export function serializeTranslationFile(
  filename: string,
  translations: Map<string, string>,
  filePath?: string,
): string {
  const format = detectFileFormat(filename);

  switch (format) {
    case "ftl":
      logger.debug(`Serializing ${filename} as FTL format`);
      return serializeFTLContent(translations);

    case "json":
      logger.debug(`Serializing ${filename} as JSON format`);
      return serializeJsonContent(translations, filePath);

    default:
      throw new Error(
        `Unsupported file format for ${filename}. Supported formats: FTL (.ftl), JSON (.json)`,
      );
  }
}

/**
 * Get the detected format for a file.
 */
export function getFileFormat(filename: string, content?: string): FileFormat {
  return detectFileFormat(filename, content);
}

/**
 * Check if two files have compatible formats for syncing.
 */
export function areFormatsCompatible(primaryFile: string, targetFile: string): boolean {
  const primaryFormat = detectFileFormat(primaryFile);
  const targetFormat = detectFileFormat(targetFile);

  // For now, all formats can sync with each other
  // Later we might add restrictions
  return primaryFormat !== "unknown" && targetFormat !== "unknown";
}
