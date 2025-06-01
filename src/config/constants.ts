#!/usr/bin/env bun

/**
 * Configuration constants for TranslatorSync
 */

// Quality thresholds
export const QUALITY_SCORE_THRESHOLD = 6;
export const QUALITY_SCORE_EXCELLENT = 8;
export const QUALITY_SCORE_MAX = 10;

// Defaults
export const DEFAULT_PRIMARY_LANGUAGE = "en";
export const DEFAULT_DIRECTORIES = ["./locales", "./public/locales", "./src/locales"];
export const DEFAULT_COST_WARNING_THRESHOLD = 1.0;
export const DEFAULT_MAX_CONCURRENT_REQUESTS = 3;

// UI Constants
export const SEPARATOR_LINE = "━";
export const SEPARATOR_LENGTH = 50;
export const SEPARATOR_LENGTH_LONG = 60;

// Description quality
export const MIN_DESCRIPTION_LENGTH = 5;
export const FALLBACK_QUALITY_SCORE = 3;

// Config
export const CONFIG_VERSION = "1.0";
export const CONFIG_FILENAME = ".translator-sync.json";
