#!/usr/bin/env bun
// Main library exports for programmatic usage

export { TranslationServiceFactory } from "./services/serviceFactory.ts";
export type { TranslationService, TranslationContext } from "./services/translator.ts";
export { parseTranslationFile, serializeTranslationFile } from "./utils/universalParser.ts";
export { loadConfig, saveConfig, interactiveSetup } from "./config/configLoader.ts";
export type { TranslatorConfig } from "./config/configLoader.ts";
export { calculateCost } from "./utils/costCalculator.ts";
export { logger } from "./utils/logger.ts";
