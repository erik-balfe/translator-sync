#!/usr/bin/env bun
import { parse } from "@fluent/syntax";
import fs from "fs";
import path from "path";

// Log received args and current working directory.
console.log("[DEBUG]", new Date().toISOString(), "Process args:", process.argv.slice(2));
console.log("[DEBUG]", new Date().toISOString(), "Current working directory:", process.cwd());

// Set DEBUG mode if "--dev" flag is present.
let DEBUG = process.argv.includes("--dev");

function debugLog(...args: any[]) {
  if (DEBUG) {
    console.log("[DEBUG]", new Date().toISOString(), ...args);
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
    debugLog("Parsed translations from content. Number of keys:", translations.size);
    return translations;
  } catch (e) {
    console.error("[ERROR]", new Date().toISOString(), "Failed to parse FTL content:", e);
    throw e;
  }
}

function serializeFTLContent(translations: Map<string, string>): string {
  let output = "";
  for (const [key, value] of translations) {
    if (value.includes("\n")) {
      // Format as Fluent multiline: write key =, then indent each line.
      const lines = value.split("\n");
      const indented = lines.map((line) => line.trimEnd()).join("\n    ");
      output += `${key} =\n    ${indented}\n`;
    } else {
      output += `${key} = ${value}\n`;
    }
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
  debugLog("translateBatch result size:", result.size);
  return result;
}

async function processTranslationFile(
  filePath: string,
  englishTranslations: Map<string, string>,
  targetLang: string,
): Promise<void> {
  try {
    debugLog("Processing file:", filePath, "for target language:", targetLang);
    const content = fs.readFileSync(filePath, "utf8");
    debugLog("Read file:", filePath, "Content length:", content.length);
    const langTranslations = parseFTLContent(content);

    // Identify missing keys.
    const missingKeys: string[] = [];
    for (const key of englishTranslations.keys()) {
      if (!langTranslations.has(key)) {
        missingKeys.push(key);
      }
    }
    debugLog("File:", path.basename(filePath), "Missing keys count:", missingKeys.length);

    // Gather unique English texts for missing keys.
    const textsToTranslate = Array.from(new Set(missingKeys.map((key) => englishTranslations.get(key)!)));
    let translationMap = new Map<string, string>();
    if (textsToTranslate.length > 0) {
      translationMap = await translateBatch("en", targetLang, textsToTranslate);
    }

    // Build updated translations preserving order.
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
    debugLog("Wrote updated content to file:", filePath, "New content length:", newContent.length);
    console.log("[INFO]", new Date().toISOString(), "Updated", path.basename(filePath));
  } catch (e) {
    console.error("[ERROR]", new Date().toISOString(), "Error processing translation file:", filePath, e);
    throw e;
  }
}

async function processDirectory(dirPath: string): Promise<void> {
  try {
    debugLog("Processing directory:", dirPath);
    const files = fs.readdirSync(dirPath).filter((file) => file.endsWith(".ftl"));
    debugLog("Found files:", files);
    if (!files.includes("en.ftl")) {
      console.error(
        "[ERROR]",
        new Date().toISOString(),
        "English translation file en.ftl not found in the directory.",
      );
      process.exit(1);
    }
    const englishFilePath = path.join(dirPath, "en.ftl");
    const englishContent = fs.readFileSync(englishFilePath, "utf8");
    debugLog("Read English file:", englishFilePath, "Content length:", englishContent.length);
    const englishTranslations = parseFTLContent(englishContent);

    // Abort if no keys found.
    if (englishTranslations.size === 0) {
      console.error("[ERROR]", new Date().toISOString(), "No keys found in en.ftl. Aborting.");
      process.exit(1);
    }
    debugLog("English file loaded with keys:", englishTranslations.size);

    // Process all non-English translation files.
    for (const file of files) {
      if (file === "en.ftl") continue;
      const filePath = path.join(dirPath, file);
      const targetLang = path.basename(file, ".ftl");
      await processTranslationFile(filePath, englishTranslations, targetLang);
    }
  } catch (e) {
    console.error("[ERROR]", new Date().toISOString(), "Error during directory processing:", e);
    process.exit(1);
  }
}

async function main() {
  try {
    const args = process.argv.slice(2);
    debugLog("Arguments received:", args);
    if (args.length < 1) {
      console.error("Usage: bun syncTranslations.ts [--dev] <path_to_ftl_directory>");
      process.exit(1);
    }
    // Get first non-flag argument.
    const dirPath = args.find((arg) => !arg.startsWith("--"));
    if (!dirPath) {
      console.error("No directory provided.");
      process.exit(1);
    }
    debugLog("Using directory path:", dirPath);
    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
      console.error("Provided path is not a directory or does not exist:", dirPath);
      process.exit(1);
    }
    await processDirectory(dirPath);
    debugLog("Completed processing directory:", dirPath);
  } catch (e) {
    console.error("[ERROR]", new Date().toISOString(), "Error in main:", e);
    process.exit(1);
  }
}

main();
