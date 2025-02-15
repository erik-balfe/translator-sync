#!/usr/bin/env bun
import fs from "node:fs";
import path from "path";
import { config } from "../config";
import type { TranslationService } from "../services/translator";
import { MockTranslationService } from "../services/translator";
import { isDirectory, listFiles, readFile, writeFile } from "../utils/fileManager";
import { parseFTLContent, serializeFTLContent } from "../utils/ftlParser";

// Process command‐line arguments.
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error("Usage: bun run src/cli/index.ts <path_to_ftl_directory>");
  process.exit(1);
}

const dirPath = args[0];

if (!isDirectory(dirPath)) {
  console.error("Provided path is not a directory or does not exist:", dirPath);
  process.exit(1);
}

const mainLang = config.mainLang;
const mainFile = path.join(dirPath, `${mainLang}.ftl`);
if (!fs.existsSync(mainFile)) {
  console.error(`Main language file ${mainLang}.ftl not found in directory ${dirPath}`);
  process.exit(1);
}

// Async main function.
async function main() {
  // Read and parse the main language file.
  const englishContent = await readFile(mainFile);
  const englishTranslations = parseFTLContent(englishContent);
  if (englishTranslations.size === 0) {
    console.error("No keys found in main language file. Aborting.");
    process.exit(1);
  }
  console.log(`Loaded ${englishTranslations.size} keys from ${mainLang}.ftl`);

  // Initialize the translation service.
  const translator: TranslationService = new MockTranslationService();

  // Process all FTL files except the main language file.
  const allItems = await listFiles(dirPath);
  const files = allItems.filter((file) => file.endsWith(".ftl") && file !== `${mainLang}.ftl`);

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    console.log(`Processing ${file}...`);
    const content = await readFile(filePath);
    const existingTranslations = parseFTLContent(content);
    const newTranslations = new Map<string, string>();
    const missingKeys: string[] = [];

    // Preserve order from the english file.
    for (const [key, enValue] of englishTranslations.entries()) {
      if (existingTranslations.has(key)) {
        newTranslations.set(key, existingTranslations.get(key)!);
      } else {
        missingKeys.push(key);
      }
    }
    // Log extra keys.
    for (const key of existingTranslations.keys()) {
      if (!englishTranslations.has(key)) {
        console.log(`Removing extra key '${key}' from ${file}`);
      }
    }
    if (missingKeys.length > 0) {
      console.log(`Found ${missingKeys.length} missing keys in ${file}. Translating...`);
      const textsToTranslate = missingKeys.map((key) => englishTranslations.get(key)!);
      const translationMap = await translator.translateBatch(
        "en",
        path.basename(file, ".ftl"),
        textsToTranslate,
      );
      for (const key of missingKeys) {
        const enValue = englishTranslations.get(key)!;
        const translatedText = translationMap.get(enValue) || `translated: ${enValue}`;
        newTranslations.set(key, translatedText);
      }
    }
    const newContent = serializeFTLContent(newTranslations);
    await writeFile(filePath, newContent);
    console.log(`Updated ${file}`);
  }
}

main()
  .then(() => {
    console.log("All translation files processed.");
  })
  .catch((err) => {
    console.error("Error processing files:", err);
    process.exit(1);
  });
