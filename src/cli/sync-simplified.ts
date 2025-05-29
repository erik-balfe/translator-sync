#!/usr/bin/env bun
import fs from "node:fs";
import path from "node:path";
import { type TranslatorConfig, loadConfig } from "../config/configLoader";
import { TranslationServiceFactory } from "../services/serviceFactory";
import type { TranslationService } from "../services/translator";
import { isSupportedFile } from "../utils/fileFormatDetector";
import { readFile, writeFile } from "../utils/fileManager";
import { logger } from "../utils/logger";
import { parseTranslationFile, serializeTranslationFile } from "../utils/universalParser";

export async function syncTranslations(directory?: string) {
  // Load config
  let config: TranslatorConfig;
  try {
    config = loadConfig();
  } catch (error) {
    logger.error("No configuration found. Run 'translator-sync init' first.");
    process.exit(1);
  }

  // Find translation files
  const searchDirs = directory ? [directory] : config.directories;
  const translationGroups = await findTranslationGroups(searchDirs, config);

  if (translationGroups.length === 0) {
    logger.error("No translation files found. Check your directory structure.");
    logger.info("Expected structures:");
    logger.info("  - locales/en/translation.json");
    logger.info("  - locales/en.json");
    process.exit(1);
  }

  // Create translation service
  const translator = TranslationServiceFactory.create({
    provider: config.provider,
    apiKey: config.apiKey || process.env.TRANSLATOR_API_KEY,
    model: config.model,
  });

  // Process each group
  for (const group of translationGroups) {
    await processTranslationGroup(group, config, translator);
  }
}

interface TranslationGroup {
  primaryFile: string;
  targetFiles: string[];
}

async function findTranslationGroups(
  directories: string[],
  config: TranslatorConfig,
): Promise<TranslationGroup[]> {
  const groups: TranslationGroup[] = [];

  for (const dir of directories) {
    const resolvedDir = path.resolve(dir);
    if (!fs.existsSync(resolvedDir)) continue;

    // Check for subdirectory structure (locales/en/translation.json)
    const subdirs = fs
      .readdirSync(resolvedDir)
      .filter((item) => fs.statSync(path.join(resolvedDir, item)).isDirectory());

    if (subdirs.includes(config.primaryLanguage)) {
      // Subdirectory structure
      const primaryDir = path.join(resolvedDir, config.primaryLanguage);
      const files = fs.readdirSync(primaryDir).filter((f) => isSupportedFile(f));

      for (const file of files) {
        const primaryFile = path.join(primaryDir, file);
        const targetFiles: string[] = [];

        // Find same file in other language directories
        for (const lang of subdirs) {
          if (lang === config.primaryLanguage) continue;
          const targetFile = path.join(resolvedDir, lang, file);
          if (fs.existsSync(targetFile)) {
            targetFiles.push(targetFile);
          }
        }

        if (targetFiles.length > 0) {
          groups.push({ primaryFile, targetFiles });
        }
      }
    } else {
      // Flat structure (locales/en.json)
      const files = fs.readdirSync(resolvedDir).filter((f) => isSupportedFile(f));

      const primaryFiles = files.filter((f) => f.includes(config.primaryLanguage));

      for (const primaryFileName of primaryFiles) {
        const primaryFile = path.join(resolvedDir, primaryFileName);
        const targetFiles = files
          .filter((f) => f !== primaryFileName && !f.includes(config.primaryLanguage))
          .map((f) => path.join(resolvedDir, f));

        if (targetFiles.length > 0) {
          groups.push({ primaryFile, targetFiles });
        }
      }
    }
  }

  return groups;
}

async function processTranslationGroup(
  group: TranslationGroup,
  config: TranslatorConfig,
  translator: TranslationService,
) {
  // Load primary translations
  const primaryContent = await readFile(group.primaryFile);
  const primaryTranslations = parseTranslationFile(
    path.basename(group.primaryFile),
    primaryContent,
  );

  logger.info(`\n📁 ${path.dirname(group.primaryFile)}`);
  logger.info(`   Primary: ${path.basename(group.primaryFile)} (${primaryTranslations.size} keys)`);

  // Process each target file
  for (const targetFile of group.targetFiles) {
    const targetContent = await readFile(targetFile);
    const targetTranslations = parseTranslationFile(path.basename(targetFile), targetContent);

    // Find missing keys
    const missingKeys: string[] = [];
    const updatedTranslations = new Map<string, string>();

    for (const [key, value] of primaryTranslations) {
      if (targetTranslations.has(key)) {
        const existingTranslation = targetTranslations.get(key);
        if (existingTranslation) {
          updatedTranslations.set(key, existingTranslation);
        }
      } else {
        missingKeys.push(key);
        updatedTranslations.set(key, value); // Temporarily
      }
    }

    if (missingKeys.length === 0) {
      logger.info(`   ✓ ${path.basename(targetFile)} - up to date`);
      continue;
    }

    logger.info(`   🔄 ${path.basename(targetFile)} - ${missingKeys.length} missing keys`);

    // Translate missing keys
    const textsToTranslate = missingKeys
      .map((key) => {
        const text = primaryTranslations.get(key);
        return text || "";
      })
      .filter((text) => text !== "");
    const targetLang = extractLanguageFromPath(targetFile);

    try {
      const translations = await translator.translateBatch(
        config.primaryLanguage,
        targetLang,
        textsToTranslate,
      );

      // Update with translations
      for (const key of missingKeys) {
        const sourceText = primaryTranslations.get(key);
        if (!sourceText) continue;
        const translation = translations.get(sourceText);
        if (translation) {
          updatedTranslations.set(key, translation);
        }
      }

      // Write updated file
      const newContent = serializeTranslationFile(path.basename(targetFile), updatedTranslations);
      await writeFile(targetFile, newContent);
      logger.info(`   ✅ Updated ${path.basename(targetFile)}`);
    } catch (error) {
      logger.error(`   ❌ Failed to translate ${path.basename(targetFile)}: ${error}`);
    }
  }
}

function extractLanguageFromPath(filePath: string): string {
  const parts = filePath.split(path.sep);

  // Check parent directory (e.g., /es/translation.json)
  if (parts.length >= 2) {
    const parentDir = parts[parts.length - 2];
    if (parentDir.length === 2) {
      return parentDir;
    }
  }

  // Check filename (e.g., es.json, translation.es.json)
  const filename = path.basename(filePath, path.extname(filePath));
  const match = filename.match(/^([a-z]{2})$|\.([a-z]{2})$/i);
  if (match) {
    return match[1] || match[2];
  }

  return "unknown";
}
