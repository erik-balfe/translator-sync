#!/usr/bin/env bun
import fs from "fs";
import path from "path";
import { parse } from "@fluent/syntax";

// Set this flag to true for debug logs.
const DEBUG = true;

function debugLog(message: string) {
  if (DEBUG) {
    console.log("[DEBUG]", message);
  }
}

function parseFTLContent(content: string): Map<string, string> {
  const resource = parse(content);
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
  return translations;
}

function serializeFTLContent(translations: Map<string, string>): string {
  let output = "";
  for (const [key, value] of translations) {
    output += `${key} = ${value}\n`;
  }
  return output;
}

// This function mimics a batch translation API. It accepts
// a source language, a target language and a collection of texts,
// then returns a mapping of the source text to the translated text.
async function translateBatch(sourceLang: string, targetLang: string, texts: string[]): Promise<Map<string, string>> {
  debugLog(`Calling translateBatch for ${texts.length} texts from ${sourceLang} to ${targetLang}`);
  const result = new Map<string, string>();
  // In a real implementation this function would call an API.
  // For each text we simply prepend "translated: " for now.
  for (const text of texts) {
    result.set(text, `translated: ${text}`);
  }
  debugLog(`translateBatch returned ${result.size} translations`);
  return result;
}

async function processTranslationFile(filePath: string, englishTranslations: Map<string, string>, targetLang: string): Promise<void> {
  debugLog(`Processing file: ${filePath} for target language: ${targetLang}`);
  const content = fs.readFileSync(filePath, "utf8");
  const langTranslations = parseFTLContent(content);

  // Find the keys missing in the translation file.
  const missingKeys: string[] = [];
  for (const key of englishTranslations.keys()) {
    if (!langTranslations.has(key)) {
      missingKeys.push(key);
    }
  }
  debugLog(`Found ${missingKeys.length} missing keys in ${path.basename(filePath)}`);

  // Gather unique English texts for missing keys.
  const textsToTranslate = Array.from(new Set(missingKeys.map((key) => englishTranslations.get(key)!)));

  // Call the batch translation API only if there are missing keys.
  let translationMap = new Map<string, string>();
  if (textsToTranslate.length > 0) {
    translationMap = await translateBatch("en", targetLang, textsToTranslate);
  }

  // Construct updated translations - follow the order of englishTranslations.
  const newTranslations = new Map<string, string>();
  for (const [key, englishText] of englishTranslations) {
    if (langTranslations.has(key)) {
      newTranslations.set(key, langTranslations.get(key)!);
    } else {
      // Use the translated text from the translationMap.
      const translatedText = translationMap.get(englishText);
      newTranslations.set(key, translatedText ? translatedText : `translated: ${englishText}`);
    }
  }

  // Serialize and overwrite the file.
  const newContent = serializeFTLContent(newTranslations);
  fs.writeFileSync(filePath, newContent, "utf8");
  debugLog(`Finished processing file: ${filePath}`);
  console.log(`Updated ${path.basename(filePath)}`);
}

async function processDirectory(dirPath: string): Promise<void> {
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

  // Process all translation files besides the english one.
  for (const file of files) {
    if (file === "en.ftl") continue;
    const filePath = path.join(dirPath, file);
    const targetLang = path.basename(file, ".ftl");
    await processTranslationFile(filePath, englishTranslations, targetLang);
  }
}

async function main() {
  if (process.argv.length < 3) {
    console.error("Usage: bun syncTranslations.ts <path_to_ftl_directory>");
    process.exit(1);
  }
  const dirPath = process.argv[2];
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    console.error("Provided path is not a directory or does not exist.");
    process.exit(1);
  }
  await processDirectory(dirPath);
}

main();
