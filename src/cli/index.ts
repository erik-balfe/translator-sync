#!/usr/bin/env bun
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { config } from "../config.ts";
import { TranslationServiceFactory } from "../services/serviceFactory.ts";
import type { TranslationService } from "../services/translator.ts";
import { loadEnv } from "../utils/envLoader.ts";
import { isSupportedFile } from "../utils/fileFormatDetector.ts";
import { isDirectory, listFiles, readFile, writeFile } from "../utils/fileManager.ts";
import { logger } from "../utils/logger.ts";
import { parseTranslationFile, serializeTranslationFile } from "../utils/universalParser.ts";

// Load environment variables from .env file
loadEnv();

interface CliOptions {
  dryRun: boolean;
  verbose: boolean;
  config?: string;
  help: boolean;
}

// Parse command-line arguments
const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    "dry-run": { type: "boolean", default: false },
    verbose: { type: "boolean", default: false },
    config: { type: "string" },
    help: { type: "boolean", default: false },
  },
  allowPositionals: true,
});

const options: CliOptions = {
  dryRun: values["dry-run"] || false,
  verbose: values.verbose || false,
  config: values.config,
  help: values.help || false,
};

// Show help message
if (options.help || positionals.length === 0) {
  console.log(`
TranslatorSync - Synchronize i18n translation files using LLM services

USAGE:
  bun run src/cli/index.ts [OPTIONS] <directory>

ARGUMENTS:
  directory    Path to the directory containing translation files

OPTIONS:
  --dry-run    Preview changes without writing files
  --verbose    Enable detailed logging
  --config     Path to custom configuration file
  --help       Show this help message

ENVIRONMENT VARIABLES:
  TRANSLATOR_SERVICE     Translation service (openai, deepseek, groq, mock)
  TRANSLATOR_API_KEY     API key for the translation service
  TRANSLATOR_MODEL       Model to use (e.g., gpt-4o-mini, deepseek-chat)
  LOG_LEVEL             Logging level (debug, info, warn, error)

EXAMPLES:
  # Sync with real translation service
  TRANSLATOR_SERVICE=openai TRANSLATOR_API_KEY=sk-... bun run src/cli/index.ts ./locales

  # Preview changes without writing
  bun run src/cli/index.ts --dry-run ./locales

  # Verbose output for debugging
  bun run src/cli/index.ts --verbose ./locales

SUPPORTED FORMATS:
  - Fluent (.ftl) - Mozilla's modern i18n format
  - JSON (.json) - React/Vue/Angular standard format

For more information: https://github.com/your-org/translator-sync
`);
  process.exit(0);
}

const dirPath = positionals[0];
if (!dirPath) {
  logger.error("Error: Directory path is required. Use --help for usage information.");
  process.exit(1);
}

// Apply verbose logging if requested
if (options.verbose) {
  logger.setLevel("debug");
}

if (!isDirectory(dirPath)) {
  logger.error(`Provided path is not a directory or does not exist: ${dirPath}`);
  process.exit(1);
}

const mainLang = config.mainLang;

// Look for main language file in supported formats
const possibleMainFiles = [
  path.join(dirPath, `${mainLang}.json`),
  path.join(dirPath, `${mainLang}.ftl`),
];

let mainFile: string | null = null;
for (const file of possibleMainFiles) {
  if (fs.existsSync(file)) {
    mainFile = file;
    break;
  }
}

if (!mainFile) {
  logger.error(
    `Main language file not found. Looking for: ${possibleMainFiles.map((f) => path.basename(f)).join(", ")} in directory ${dirPath}`,
  );
  process.exit(1);
}

// Async main function.
async function main() {
  // Read and parse the main language file.
  const englishContent = await readFile(mainFile!);
  const englishTranslations = parseTranslationFile(path.basename(mainFile!), englishContent);
  if (englishTranslations.size === 0) {
    logger.error("No keys found in main language file. Aborting.");
    process.exit(1);
  }
  logger.info(`Loaded ${englishTranslations.size} keys from ${path.basename(mainFile!)}`);

  // Initialize the translation service.
  // Create translation service based on environment variables or default to mock
  const translator: TranslationService = TranslationServiceFactory.fromEnvironment();

  // Process all supported translation files except the main language file.
  const allItems = await listFiles(dirPath);
  const mainFileName = path.basename(mainFile!);
  const files = allItems.filter((file) => isSupportedFile(file) && file !== mainFileName);

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    logger.debug(`Processing ${file}...`);
    const content = await readFile(filePath);
    const existingTranslations = parseTranslationFile(file, content);
    const newTranslations = new Map<string, string>();
    const missingKeys: string[] = [];

    // Preserve order from the english file.
    for (const [key, enValue] of englishTranslations.entries()) {
      if (existingTranslations.has(key)) {
        const existingValue = existingTranslations.get(key);
        if (existingValue !== undefined) {
          newTranslations.set(key, existingValue);
        }
      } else {
        missingKeys.push(key);
      }
    }
    // Log extra keys.
    for (const key of existingTranslations.keys()) {
      if (!englishTranslations.has(key)) {
        logger.info(`Removing extra key '${key}' from ${file}`);
      }
    }
    if (missingKeys.length > 0) {
      logger.info(`Found ${missingKeys.length} missing keys in ${file}. Translating...`);
      const textsToTranslate = missingKeys
        .map((key) => englishTranslations.get(key))
        .filter((text): text is string => text !== undefined);
      const translationMap = await translator.translateBatch(
        "en",
        path.basename(file, ".ftl"),
        textsToTranslate,
      );
      for (const key of missingKeys) {
        const enValue = englishTranslations.get(key);
        if (enValue !== undefined) {
          const translatedText = translationMap.get(enValue);
          if (!translatedText) {
            logger.warn(`Translation failed for key: ${key}, skipping...`);
            continue;
          }
          newTranslations.set(key, translatedText);
        }
      }
    }
    const newContent = serializeTranslationFile(file, newTranslations);

    if (options.dryRun) {
      logger.info(`[DRY RUN] Would update ${file} with ${missingKeys.length} new translations`);
      if (options.verbose) {
        logger.debug(
          `[DRY RUN] New content preview for ${file}:\n${newContent.slice(0, 500)}${newContent.length > 500 ? "..." : ""}`,
        );
      }
    } else {
      await writeFile(filePath, newContent);
      logger.info(`Updated ${file}`);
    }
  }
}

main()
  .then(() => {
    if (options.dryRun) {
      logger.info("Dry run completed. No files were modified.");
    } else {
      logger.info("All translation files processed successfully.");
    }
  })
  .catch((err) => {
    logger.error("Error processing files:", err);
    process.exit(1);
  });
