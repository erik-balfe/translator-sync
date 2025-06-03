#!/usr/bin/env bun
import fs from "node:fs";
import path from "node:path";
import { logger } from "../utils/logger.ts";
import {
  CONFIG_FILENAME,
  CONFIG_VERSION,
  DEFAULT_COST_WARNING_THRESHOLD,
  DEFAULT_DIRECTORIES,
  DEFAULT_MAX_CONCURRENT_REQUESTS,
  DEFAULT_PRIMARY_LANGUAGE,
  FALLBACK_QUALITY_SCORE,
  MIN_DESCRIPTION_LENGTH,
  QUALITY_SCORE_EXCELLENT,
  QUALITY_SCORE_THRESHOLD,
  SEPARATOR_LENGTH,
  SEPARATOR_LENGTH_LONG,
  SEPARATOR_LINE,
} from "./constants.ts";

export interface TranslatorConfig {
  version: string;
  provider: "openai" | "deepseek" | "groq" | "mock";
  model?: string;
  apiKey?: string; // Can be in config or env var
  primaryLanguage: string;
  directories: string[];
  filePattern?: string; // e.g., "translation.json" or "*.json"
  projectDescription?: string; // Raw project description from user
  refinedDescription?: string; // LLM-refined description for translation context
  descriptionQuality?: number; // Quality score (1-10) of the description
  options?: {
    preserveFormatting?: boolean;
    costWarningThreshold?: number;
    maxConcurrentRequests?: number;
    dryRun?: boolean;
    verbose?: boolean;
    enableTelemetry?: boolean; // Privacy-first telemetry (opt-out)
  };
}

const DEFAULT_CONFIG: Partial<TranslatorConfig> = {
  version: CONFIG_VERSION,
  provider: "openai",
  model: "gpt-4.1-nano",
  primaryLanguage: DEFAULT_PRIMARY_LANGUAGE,
  directories: DEFAULT_DIRECTORIES,
  options: {
    preserveFormatting: true,
    costWarningThreshold: DEFAULT_COST_WARNING_THRESHOLD,
    maxConcurrentRequests: DEFAULT_MAX_CONCURRENT_REQUESTS,
    enableTelemetry: true, // Enabled by default with privacy-first approach
  },
};

/**
 * Find config file in current directory or parent directories.
 */
export function findConfigFile(startDir: string = process.cwd()): string | null {
  let currentDir = startDir;

  while (currentDir !== path.dirname(currentDir)) {
    const configPath = path.join(currentDir, CONFIG_FILENAME);
    if (fs.existsSync(configPath)) {
      return configPath;
    }
    currentDir = path.dirname(currentDir);
  }

  return null;
}

/**
 * Load configuration from file and environment.
 */
export function loadConfig(configPath?: string): TranslatorConfig {
  let config: Partial<TranslatorConfig> = { ...DEFAULT_CONFIG };

  // 1. Load from config file
  const actualConfigPath = configPath || findConfigFile();
  if (actualConfigPath) {
    try {
      const fileContent = fs.readFileSync(actualConfigPath, "utf-8");
      const fileConfig = JSON.parse(fileContent) as Partial<TranslatorConfig>;
      config = { ...config, ...fileConfig };
      logger.debug(`Loaded config from ${actualConfigPath}`);
    } catch (error) {
      logger.warn(`Failed to load config from ${actualConfigPath}: ${error}`);
    }
  }

  // 2. Override with environment variables
  if (process.env.TRANSLATOR_SERVICE) {
    const validProviders = ["openai", "deepseek", "groq", "mock"] as const;
    type ValidProvider = (typeof validProviders)[number];
    const envProvider = process.env.TRANSLATOR_SERVICE as ValidProvider;
    if (validProviders.includes(envProvider)) {
      config.provider = envProvider;
    }
  }
  if (process.env.TRANSLATOR_MODEL) {
    config.model = process.env.TRANSLATOR_MODEL;
  }
  if (process.env.TRANSLATOR_API_KEY) {
    config.apiKey = process.env.TRANSLATOR_API_KEY;
  }

  // 3. Validate required fields
  if (!config.provider) {
    throw new Error(
      "Translation provider is required. Set in config file or TRANSLATOR_SERVICE env var.",
    );
  }

  return config as TranslatorConfig;
}

/**
 * Save configuration to file.
 */
export function saveConfig(config: TranslatorConfig, configPath?: string): void {
  const actualPath = configPath || path.join(process.cwd(), CONFIG_FILENAME);

  // Don't save API key to file for security
  const configToSave = { ...config };
  configToSave.apiKey = undefined;

  const content = JSON.stringify(configToSave, null, 2);
  fs.writeFileSync(actualPath, content);
  logger.info(`Configuration saved to ${actualPath}`);

  // Check if .gitignore exists and add config file if needed
  const gitignorePath = path.join(path.dirname(actualPath), ".gitignore");
  if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, "utf-8");
    if (!gitignoreContent.includes(CONFIG_FILENAME)) {
      fs.appendFileSync(gitignorePath, `\n# TranslatorSync configuration\n${CONFIG_FILENAME}\n`);
      logger.info(`Added ${CONFIG_FILENAME} to .gitignore`);
    }
  }
}

/**
 * Extract project description from package.json if available.
 */
function extractDescriptionFromPackageJson(startDir: string = process.cwd()): string | null {
  try {
    const packagePath = path.join(startDir, "package.json");
    if (fs.existsSync(packagePath)) {
      const packageContent = JSON.parse(fs.readFileSync(packagePath, "utf-8"));
      return packageContent.description || null;
    }
  } catch (error) {
    logger.debug(`Failed to read package.json: ${error}`);
  }
  return null;
}

/**
 * Extract project description from README files.
 */
function extractDescriptionFromReadme(startDir: string = process.cwd()): string | null {
  const readmeFiles = ["README.md", "README.txt", "README.rst", "README"];

  for (const filename of readmeFiles) {
    try {
      const readmePath = path.join(startDir, filename);
      if (fs.existsSync(readmePath)) {
        const content = fs.readFileSync(readmePath, "utf-8");

        // Extract first paragraph or first few lines as description
        const lines = content.split("\n").filter((line) => line.trim().length > 0);

        // Skip title (usually first line with # or ==)
        let startIndex = 0;
        if (lines[0]?.startsWith("#") || lines[1]?.includes("=")) {
          startIndex = 1;
        }

        // Take first meaningful paragraph (up to 200 words)
        const descriptionLines = [];
        for (let i = startIndex; i < lines.length && descriptionLines.length < 5; i++) {
          const line = lines[i].trim();
          if (line.length > 0 && !line.startsWith("#") && !line.startsWith("![")) {
            descriptionLines.push(line);
            // Stop at first blank line after getting some content
            if (descriptionLines.length > 0 && i + 1 < lines.length && lines[i + 1].trim() === "") {
              break;
            }
          }
        }

        const description = descriptionLines.join(" ").slice(0, 500);
        return description.length > 20 ? description : null;
      }
    } catch (error) {
      logger.debug(`Failed to read ${filename}: ${error}`);
    }
  }

  return null;
}

/**
 * Auto-detect project description from available sources.
 */
function autoDetectProjectDescription(startDir: string = process.cwd()): string | null {
  // Try package.json first (usually more concise)
  const packageDesc = extractDescriptionFromPackageJson(startDir);
  if (packageDesc && packageDesc.length > 10) {
    return packageDesc;
  }

  // Fallback to README
  const readmeDesc = extractDescriptionFromReadme(startDir);
  if (readmeDesc && readmeDesc.length > 20) {
    return readmeDesc;
  }

  return null;
}

/**
 * Evaluate and refine project description using LLM.
 */
export async function evaluateProjectDescription(
  rawDescription: string,
  config: Partial<TranslatorConfig>,
): Promise<{ refinedDescription: string; qualityScore: number; suggestions?: string }> {
  // Import here to avoid circular dependency
  const { TranslationServiceFactory } = await import("../services/serviceFactory.ts");
  const { EnhancedTranslator } = await import("../services/enhancedTranslator.ts");

  try {
    // Create a temporary service for description evaluation
    const service = TranslationServiceFactory.create({
      provider: config.provider || "openai",
      apiKey: config.apiKey || process.env.TRANSLATOR_API_KEY || "",
      model: config.model,
    });

    const enhanced = new EnhancedTranslator(service);
    const result = await enhanced.refineDescription(rawDescription);

    return {
      refinedDescription: result.refinedDescription,
      qualityScore: result.qualityScore,
      suggestions: result.suggestions,
    };
  } catch (error) {
    logger.warn(`Failed to evaluate description: ${error}`);
    return {
      refinedDescription: rawDescription,
      qualityScore: FALLBACK_QUALITY_SCORE,
      suggestions: "Could not evaluate description quality due to API error",
    };
  }
}

/**
 * Show privacy notice for telemetry.
 */
function showPrivacyNotice(): void {
  console.log("\n🔒 Privacy Notice");
  console.log("TranslatorSync collects anonymous usage data to improve the tool.");
  console.log("• No personal data or translation content is ever collected");
  console.log("• Only usage patterns and performance metrics");
  console.log(
    "• You can disable this anytime by setting enableTelemetry: false in .translator-sync.json\n",
  );
}

/**
 * Select translation provider interactively.
 */
function selectProvider(): TranslatorConfig["provider"] {
  console.log("Select translation provider:");
  console.log("1. OpenAI (GPT-4.1-nano) - Recommended");
  console.log("2. DeepSeek (DeepSeek-v3) - Budget-friendly");
  console.log("3. Groq (Llama-4-Maverick) - Fast and free");
  console.log("4. Mock - Testing only\n");

  const providerChoice = prompt("Provider [1]: ") || "1";

  const providerMap: Record<string, TranslatorConfig["provider"]> = {
    "1": "openai",
    "2": "deepseek",
    "3": "groq",
    "4": "mock",
  };

  return providerMap[providerChoice] || "openai";
}

/**
 * Get model for selected provider.
 */
function getModelForProvider(provider: TranslatorConfig["provider"]): string | undefined {
  const modelMap: Record<TranslatorConfig["provider"], string | undefined> = {
    openai: "gpt-4.1-nano",
    deepseek: "deepseek-v3",
    groq: "llama-4-maverick",
    mock: undefined,
  };

  return modelMap[provider];
}

/**
 * Prompt for API key.
 */
function promptForApiKey(provider: TranslatorConfig["provider"]): string | undefined {
  if (provider === "mock") {
    return undefined;
  }

  console.log(`\n${provider.toUpperCase()} API key (press Enter to skip):`);
  const apiKeyInput = prompt("> ");
  const apiKey = apiKeyInput || undefined;

  if (!apiKey) {
    console.log("\n[!] No API key provided.");
    console.log(`    Add your API key to ${CONFIG_FILENAME} in the "apiKey" field`);
    console.log("    or set TRANSLATOR_API_KEY environment variable.");
    console.log("    The translator-sync command will not work without a valid API key.\n");
  }

  return apiKey;
}

/**
 * Get run instructions based on how the tool was invoked.
 */
function getRunInstructions(): string {
  // Check if we're running via npx/bunx
  const isGlobalRun = process.argv[1]?.includes("translator-sync");

  if (isGlobalRun) {
    return "\n✅ Setup complete! You can now run:\n\n   npx translator-sync\n   # or\n   bunx translator-sync\n   # or\n   deno run -A npm:translator-sync";
  }

  return '\n✅ Setup complete! \n\nAdd to your package.json scripts:\n   "translate": "translator-sync"\n\nThen run:\n   npm run translate\n   # or\n   bun run translate\n   # or\n   deno task translate';
}

/**
 * Setup project description with quality enforcement.
 */
async function setupProjectDescription(
  provider: TranslatorConfig["provider"],
  apiKey: string | undefined,
  model: string | undefined,
): Promise<{
  projectDescription?: string;
  refinedDescription?: string;
  descriptionQuality?: number;
}> {
  // Skip description setup in simplified flow
  return {};
}

/**
 * Interactive configuration setup.
 */
export async function interactiveSetup(): Promise<TranslatorConfig> {
  console.log("\n🌐 TranslatorSync Setup\n");

  // Show privacy notice on first setup
  const existingConfig = findConfigFile();
  if (!existingConfig) {
    showPrivacyNotice();
  }

  // Provider selection with default
  const provider = selectProvider();
  const model = getModelForProvider(provider);

  // API key (optional)
  const apiKey = promptForApiKey(provider);

  // Primary language with better default prompt
  const primaryLanguage = prompt("\nPrimary language code [en]: ") || DEFAULT_PRIMARY_LANGUAGE;

  // Directories with better default handling
  console.log("\nTranslation files location:");
  console.log("Common patterns: ./locales, ./public/locales, ./src/locales\n");
  const dirInput = prompt("Directories (comma-separated) [./locales]: ") || DEFAULT_DIRECTORIES[0];
  const directories = dirInput.split(",").map((d) => d.trim());

  const config: TranslatorConfig = {
    version: CONFIG_VERSION,
    provider,
    model,
    apiKey,
    primaryLanguage,
    directories,
    options: {
      ...DEFAULT_CONFIG.options,
      enableTelemetry: true, // Always enabled by default
    },
  };

  // Save config
  saveConfig(config);

  // Show appropriate run instructions
  console.log(getRunInstructions());

  return config;
}
