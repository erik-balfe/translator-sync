#!/usr/bin/env bun
// Main library exports for programmatic usage

export { TranslationServiceFactory } from "./services/serviceFactory";
export type { TranslationService, TranslationContext } from "./services/translator";
export { parseTranslationFile, serializeTranslationFile } from "./utils/universalParser";
export { loadConfig, saveConfig, interactiveSetup } from "./config/configLoader";
export type { TranslatorConfig } from "./config/configLoader";
export { calculateCost } from "./utils/costCalculator";
export { logger } from "./utils/logger";
