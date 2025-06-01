#!/usr/bin/env bun
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { type TranslatorConfig, loadConfig } from "../config/configLoader.ts";
import { QUALITY_SCORE_EXCELLENT, QUALITY_SCORE_THRESHOLD } from "../config/constants.ts";
import type { EnhancedTranslator } from "../services/enhancedTranslator.ts";
import { TranslationServiceFactory } from "../services/serviceFactory.ts";
import type { TranslationContext, TranslationService } from "../services/translator.ts";
import { calculateCost } from "../utils/costCalculator.ts";
import { isSupportedFile } from "../utils/fileFormatDetector.ts";
import { isDirectory, listFiles, readFile, writeFile } from "../utils/fileManager.ts";
import { logger } from "../utils/logger.ts";
import { telemetry } from "../utils/telemetry.ts";
import { parseTranslationFile, serializeTranslationFile } from "../utils/universalParser.ts";

interface SyncOptions {
  dryRun: boolean;
  verbose: boolean;
  config?: string;
}

export async function runSync(args: string[]) {
  // Parse sync-specific arguments
  const { values, positionals } = parseArgs({
    args,
    options: {
      "dry-run": { type: "boolean", default: false },
      verbose: { type: "boolean", default: false },
      config: { type: "string" },
      help: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(`
TranslatorSync - Synchronize translation files

USAGE:
  translator-sync sync [directory] [options]

OPTIONS:
  --dry-run           Preview changes without writing files
  --verbose           Enable detailed logging
  --config <path>     Use specific config file
  --help             Show this help message

If no directory is specified, searches for translations using config file settings.
`);
    process.exit(0);
  }

  const options: SyncOptions = {
    dryRun: values["dry-run"] || false,
    verbose: values.verbose || false,
    config: values.config,
  };

  // Load configuration
  let config: TranslatorConfig;
  try {
    config = loadConfig(options.config);
  } catch (error) {
    logger.error(`Configuration error: ${error}`);
    logger.info("Run 'translator-sync init' to set up configuration");
    process.exit(1);
  }

  // Apply options
  if (options.verbose) {
    logger.setLevel("debug");
  }

  // Find translation directories
  const directories = positionals.length > 0 ? positionals : config.directories;
  const translationDirs: string[] = [];

  for (const dir of directories) {
    const resolvedDir = path.resolve(dir);
    if (isDirectory(resolvedDir)) {
      translationDirs.push(resolvedDir);
      logger.debug(`Found translation directory: ${resolvedDir}`);
    } else {
      logger.debug(`Directory not found: ${resolvedDir}`);
    }
  }

  if (translationDirs.length === 0) {
    logger.error(
      "No translation directories found. Check your configuration or provide a directory path.",
    );
    process.exit(1);
  }

  // Skip description quality checks in simplified flow

  // Create enhanced translation service
  const enhancedTranslator = TranslationServiceFactory.createEnhanced({
    provider: config.provider,
    apiKey: config.apiKey || process.env.TRANSLATOR_API_KEY,
    model: config.model,
  });

  // Skip description logging in simplified flow

  let totalCost = 0;
  let totalTranslations = 0;

  // Process each directory
  for (const dir of translationDirs) {
    logger.info(`\nProcessing directory: ${dir}`);

    // Check if this directory has language subdirectories (e.g., /en, /es)
    const items = await listFiles(dir);
    const langDirs = items.filter((item) => {
      const fullPath = path.join(dir, item);
      return isDirectory(fullPath) && item.length === 2; // Language codes are typically 2 chars
    });

    if (langDirs.length > 0) {
      // Process subdirectory structure (e.g., locales/en/translation.json)
      const result = await processLanguageDirectories(
        dir,
        langDirs,
        config,
        enhancedTranslator,
        options,
      );
      totalCost += result.cost;
      totalTranslations += result.translations;
    } else {
      // Process flat structure (e.g., locales/en.json)
      const result = await processFlatDirectory(dir, items, config, enhancedTranslator, options);
      totalCost += result.cost;
      totalTranslations += result.translations;
    }
  }

  // Summary
  console.log("\n📊 Summary:");
  console.log(`   Translations: ${totalTranslations}`);
  if (totalCost > 0) {
    console.log(`   Cost: $${totalCost.toFixed(4)}`);
  }
  if (options.dryRun) {
    console.log("   Mode: Dry run (no files modified)");
  }
}

async function processLanguageDirectories(
  dir: string,
  langDirs: string[],
  config: TranslatorConfig,
  translator: EnhancedTranslator,
  options: SyncOptions,
): Promise<{ cost: number; translations: number }> {
  let totalCost = 0;
  let totalTranslations = 0;

  // Find primary language directory
  const primaryLangDir = langDirs.find((lang) => lang === config.primaryLanguage);
  if (!primaryLangDir) {
    logger.warn(`Primary language directory '${config.primaryLanguage}' not found in ${dir}`);
    return { cost: 0, translations: 0 };
  }

  // Get all translation files in primary directory
  const primaryDir = path.join(dir, primaryLangDir);
  const primaryFiles = await listFiles(primaryDir);
  const translationFiles = primaryFiles.filter((f) => isSupportedFile(f));

  for (const file of translationFiles) {
    // Load primary translation file
    const primaryPath = path.join(primaryDir, file);
    const primaryContent = await readFile(primaryPath);
    const primaryTranslations = parseTranslationFile(file, primaryContent, primaryPath);

    logger.info(`Primary file: ${file} (${primaryTranslations.size} keys)`);

    // Process each target language directory
    for (const langDir of langDirs) {
      if (langDir === config.primaryLanguage) continue;

      const targetPath = path.join(dir, langDir, file);
      if (!fs.existsSync(targetPath)) {
        logger.debug(`Target file not found: ${targetPath}`);
        continue;
      }

      const result = await processTargetFile(
        targetPath,
        file,
        primaryTranslations,
        config,
        translator,
        options,
      );

      totalCost += result.cost;
      totalTranslations += result.translations;
    }
  }

  return { cost: totalCost, translations: totalTranslations };
}

async function processFlatDirectory(
  dir: string,
  files: string[],
  config: TranslatorConfig,
  translator: EnhancedTranslator,
  options: SyncOptions,
): Promise<{ cost: number; translations: number }> {
  let totalCost = 0;
  let totalTranslations = 0;

  // Find primary language file
  const primaryFiles = files.filter(
    (f) => isSupportedFile(f) && f.includes(config.primaryLanguage),
  );

  if (primaryFiles.length === 0) {
    logger.warn(`No primary language files found for '${config.primaryLanguage}' in ${dir}`);
    return { cost: 0, translations: 0 };
  }

  for (const primaryFile of primaryFiles) {
    const primaryPath = path.join(dir, primaryFile);
    const primaryContent = await readFile(primaryPath);
    const primaryTranslations = parseTranslationFile(primaryFile, primaryContent, primaryPath);

    logger.info(`Primary file: ${primaryFile} (${primaryTranslations.size} keys)`);

    // Find target language files
    const targetFiles = files.filter(
      (f) => f !== primaryFile && isSupportedFile(f) && !f.includes(config.primaryLanguage),
    );

    for (const targetFile of targetFiles) {
      const targetPath = path.join(dir, targetFile);

      const result = await processTargetFile(
        targetPath,
        targetFile,
        primaryTranslations,
        config,
        translator,
        options,
      );

      totalCost += result.cost;
      totalTranslations += result.translations;
    }
  }

  return { cost: totalCost, translations: totalTranslations };
}

async function processTargetFile(
  targetPath: string,
  fileName: string,
  primaryTranslations: Map<string, string>,
  config: TranslatorConfig,
  translator: EnhancedTranslator,
  options: SyncOptions,
): Promise<{ cost: number; translations: number }> {
  let cost = 0;
  let translations = 0;

  const targetContent = await readFile(targetPath);
  const targetTranslations = parseTranslationFile(fileName, targetContent, targetPath);

  // Find missing keys
  const missingKeys: string[] = [];
  const updatedTranslations = new Map<string, string>();

  for (const [key, value] of primaryTranslations) {
    const existingTranslation = targetTranslations.get(key);
    if (existingTranslation) {
      updatedTranslations.set(key, existingTranslation);
    } else {
      missingKeys.push(key);
      updatedTranslations.set(key, value); // Temporarily use source
    }
  }

  if (missingKeys.length === 0) {
    logger.debug(`${fileName}: All keys up to date`);
    return { cost: 0, translations: 0 };
  }

  logger.info(`${fileName}: ${missingKeys.length} missing keys`);

  // Translate missing keys
  const textsToTranslate = missingKeys
    .map((key) => {
      const text = primaryTranslations.get(key);
      return text || "";
    })
    .filter((text) => text !== "");

  const targetLang = extractLanguageFromPath(targetPath);

  try {
    const translationResults = await translator.translateWithContext(
      config.primaryLanguage,
      targetLang,
      textsToTranslate,
      config.refinedDescription || config.projectDescription,
    );

    // Update with translations
    for (const key of missingKeys) {
      const sourceText = primaryTranslations.get(key);
      if (!sourceText) continue;

      const translation = translationResults.get(sourceText);
      if (translation) {
        updatedTranslations.set(key, translation);
        translations++;
      }
    }

    // Calculate cost if using real service
    if (config.provider !== "mock" && translator.getUsageStats) {
      const usage = translator.getUsageStats();
      const costResult = calculateCost(config.model || config.provider, usage);
      cost = costResult.totalCost;

      if (cost > (config.options?.costWarningThreshold || 1.0)) {
        logger.warn(`High cost alert: $${cost.toFixed(4)} for ${fileName}`);
      }
    }

    // Write updated file
    const newContent = serializeTranslationFile(fileName, updatedTranslations, targetPath);

    if (options.dryRun) {
      logger.info(`[DRY RUN] Would update ${fileName}`);
      if (options.verbose) {
        logger.debug(`Preview:\n${newContent.slice(0, 200)}...`);
      }
    } else {
      await writeFile(targetPath, newContent);
      logger.info(`✓ Updated ${fileName}`);
    }
  } catch (error) {
    logger.error(`Failed to translate ${fileName}: ${error}`);
  }

  return { cost, translations };
}

/**
 * Extract language code from file path.
 */
function extractLanguageFromPath(filePath: string): string {
  // Try common patterns: /en/translation.json, en.json, translation.en.json
  const patterns = [
    /\/([a-z]{2})\/[^/]+$/i, // /en/file.json
    /^([a-z]{2})\.[^.]+$/i, // en.json
    /\.([a-z]{2})\.[^.]+$/i, // file.en.json
    /^([a-z]{2}-[A-Z]{2})\./i, // en-US.json
  ];

  for (const pattern of patterns) {
    const match = filePath.match(pattern);
    if (match) {
      return match[1].toLowerCase();
    }
  }

  // Fallback: use first two letters of filename
  return path.basename(filePath).slice(0, 2);
}
