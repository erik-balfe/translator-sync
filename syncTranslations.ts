#!/usr/bin/env bun
import { parse } from "@fluent/syntax";
import fs from "fs";
import path from "path";

// Log received process arguments so we know what the script sees.
console.log("Process args:", process.argv.slice(2));

// Set DEBUG mode based on the presence of "--dev" flag.
let DEBUG = process.argv.includes("--dev");

function debugLog(...args: any[]) {
  if (DEBUG) {
    console.log("[DEBUG]", ...args);
  }
}

function parseFTLContent(content: string): Map<string, string> {
  try {
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
            }
          }
        }
        translations.set(key, value);
      }
    }
    debugLog("Parsed translations", translations);
    return translations;
  } catch (e) {
    console.error("Failed to parse FTL content:", e);
    throw e;
  }
}

function serializeFTLContent(translations: Map<string, string>): string {
  let output = "";
  for (const [key, value] of translations) {
    output += `${key} = ${value}\n`;
  }
  return output;
}

async function translateBatch(
  sourceLang: string,
  targetLang: string,
  texts: string[],
): Promise<Map<string, string>> {
  debugLog(`Calling translateBatch for ${texts.length} texts from ${sourceLang} to ${targetLang}`);
  const result = new Map<string, string>();
  for (const text of texts) {
    result.set(text, `translated: ${text}`);
  }
  debugLog("translateBatch result", result);
  return result;
}

async function processTranslationFile(
  filePath: string,
  englishTranslations: Map<string, string>,
  targetLang: string,
): Promise<void> {
  try {
    debugLog(`Processing file: ${filePath} for target language: ${targetLang}`);
    const content = fs.readFileSync(filePath, "utf8");
    const langTranslations = parseFTLContent(content);

    // Identify keys missing in the translation file.
    const missingKeys: string[] = [];
    for (const key of englishTranslations.keys()) {
      if (!langTranslations.has(key)) {
        missingKeys.push(key);
      }
    }
    debugLog(`Missing keys in ${path.basename(filePath)}:`, missingKeys);

    // Get unique English texts for missing keys.
    const textsToTranslate = Array.from(new Set(missingKeys.map((key) => englishTranslations.get(key)!)));
    let translationMap = new Map<string, string>();
    if (textsToTranslate.length > 0) {
      translationMap = await translateBatch("en", targetLang, textsToTranslate);
    }

    // Build updated translations, preserving the order of English file.
    const newTranslations = new Map<string, string>();
    for (const [key, englishText] of englishTranslations) {
      if (langTranslations.has(key)) {
        newTranslations.set(key, langTranslations.get(key)!);
      } else {
        const translatedText = translationMap.get(englishText);
        newTranslations.set(key, translatedText ? translatedText : `translated: ${englishText}`);
      }
    }
    const newContent = serializeFTLContent(newTranslations);
    fs.writeFileSync(filePath, newContent, "utf8");
    debugLog(`Finished processing file: ${filePath}`);
    console.log(`Updated ${path.basename(filePath)}`);
  } catch (e) {
    console.error("Error processing translation file", filePath, e);
    throw e;
  }
}

async function processDirectory(dirPath: string): Promise<void> {
  try {
    debugLog(`Processing directory: ${dirPath}`);
    const files = fs.readdirSync(dirPath).filter((file) => file.endsWith(".ftl"));
    if (!files.includes("en.ftl")) {
      console.error("English translation file en.ftl not found in the directory.");
      process.exit(1);
    }
    const englishFilePath = path.join(dirPath, "en.ftl");
    const englishContent = fs.readFileSync(englishFilePath, "utf8");
    const englishTranslations = parseFTLContent(englishContent);
    debugLog(`English file loaded with ${englishTranslations.size} keys`);

    for (const file of files) {
      if (file === "en.ftl") continue;
      const filePath = path.join(dirPath, file);
      const targetLang = path.basename(file, ".ftl");
      await processTranslationFile(filePath, englishTranslations, targetLang);
    }
  } catch (e) {
    console.error("Error during directory processing:", e);
    process.exit(1);
  }
}

async function main() {
  try {
    const args = process.argv.slice(2);
    if (args.length < 1) {
      console.error("Usage: bun syncTranslations.ts [--dev] <path_to_ftl_directory>");
      process.exit(1);
    }
    // Extract directory path from arguments (ignoring flags).
    const dirPath = args.find((arg) => !arg.startsWith("--"));
    if (!dirPath) {
      console.error("No directory provided.");
      process.exit(1);
    }
    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
      console.error("Provided path is not a directory or does not exist.");
      process.exit(1);
    }
    await processDirectory(dirPath);
  } catch (e) {
    console.error("Error in main:", e);
    process.exit(1);
  }
}

main();
