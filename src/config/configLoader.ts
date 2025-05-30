#!/usr/bin/env bun
import fs from "node:fs";
import path from "node:path";
import { logger } from "../utils/logger.ts";

export interface TranslatorConfig {
  version: string;
  provider: "openai" | "deepseek" | "groq" | "mock";
  model?: string;
  apiKey?: string; // Can be in config or env var
  primaryLanguage: string;
  directories: string[];
  filePattern?: string; // e.g., "translation.json" or "*.json"
  options?: {
    preserveFormatting?: boolean;
    costWarningThreshold?: number;
    maxConcurrentRequests?: number;
    dryRun?: boolean;
    verbose?: boolean;
    enableTelemetry?: boolean; // Privacy-first telemetry (opt-out)
  };
}

const CONFIG_FILENAME = ".translator-sync.json";
const DEFAULT_CONFIG: Partial<TranslatorConfig> = {
  version: "1.0",
  provider: "openai",
  model: "gpt-4.1-nano",
  primaryLanguage: "en",
  directories: ["./locales", "./public/locales", "./src/locales"],
  options: {
    preserveFormatting: true,
    costWarningThreshold: 1.0,
    maxConcurrentRequests: 3,
    enableTelemetry: true, // Opt-out by default, but we'll ask during setup
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
 * Interactive configuration setup.
 */
export async function interactiveSetup(): Promise<TranslatorConfig> {
  console.log("\n🌐 TranslatorSync Setup\n");

  // Provider selection
  console.log("Select translation provider:");
  console.log("1. OpenAI (GPT-4.1-nano) - Best quality ✅");
  console.log("2. DeepSeek (DeepSeek-v3) - Budget-friendly 💰");
  console.log("3. Groq (Llama-4-Maverick) - Fast and free 🚀");
  console.log("4. Mock - Testing only 🧪");

  const providerChoice = prompt("Enter choice (1-4): ") || "1";
  let provider: TranslatorConfig["provider"];

  if (providerChoice === "1") {
    provider = "openai";
  } else if (providerChoice === "2") {
    provider = "deepseek";
  } else if (providerChoice === "3") {
    provider = "groq";
  } else if (providerChoice === "4") {
    provider = "mock";
  } else {
    provider = "openai"; // Default
  }

  // Model selection based on provider
  let model: string | undefined;
  switch (provider) {
    case "openai":
      model = "gpt-4.1-nano"; // Default to recommended model
      console.log(`\n✅ Using recommended model: ${model}`);
      break;
    case "deepseek":
      model = "deepseek-v3";
      console.log(`\n✅ Using model: ${model}`);
      break;
    case "groq":
      model = "llama-4-maverick";
      console.log(`\n✅ Using model: ${model}`);
      break;
    case "mock":
      // Mock provider doesn't need a model
      model = undefined;
      break;
    default:
      model = undefined;
  }

  // API Key
  let apiKey: string | undefined;
  if (provider !== "mock") {
    const apiKeyInput = prompt(`\nEnter your ${provider.toUpperCase()} API key: `);
    apiKey = apiKeyInput || undefined;
    if (!apiKey) {
      console.log(
        "⚠️  No API key provided. You'll need to set TRANSLATOR_API_KEY environment variable.",
      );
    }
  }

  // Primary language
  const primaryLanguage = prompt("\nPrimary language code (default: en): ") || "en";

  // Directories
  console.log("\nWhere are your translation files located?");
  console.log("Common patterns: ./locales, ./public/locales, ./src/locales");
  const dirInput =
    prompt("Enter directories (comma-separated, default: ./locales): ") || "./locales";
  const directories = dirInput.split(",").map((d) => d.trim());

  // Privacy-first telemetry disclosure
  console.log("\n📊 Anonymous Usage Analytics");
  console.log("━".repeat(50));
  console.log("TranslatorSync can collect anonymous usage data to improve the tool.");
  console.log("");
  console.log("🔒 PRIVACY GUARANTEE:");
  console.log("• Zero user identification (no IPs, emails, or personal data)");
  console.log("• Content-blind (never sees your translations)");
  console.log("• Token counts only (not actual content)");
  console.log("• Open source & libertarian ethics");
  console.log("• Exclusively for improving the tool for everyone");
  console.log("");
  console.log("📈 COLLECTED DATA (anonymous only):");
  console.log("• Usage patterns: commands used, session timing");
  console.log("• Performance: token counts, response times, error types");
  console.log("• Resource usage: costs, cache rates, provider usage");
  console.log("• Optional feedback: satisfaction scores");
  console.log("");
  console.log("You can disable this anytime in .translator-sync.json");

  const enableTelemetryInput = prompt("\nEnable anonymous analytics? (Y/n): ");
  const enableTelemetry =
    enableTelemetryInput?.toLowerCase() !== "n" && enableTelemetryInput?.toLowerCase() !== "no";

  const config: TranslatorConfig = {
    version: "1.0",
    provider,
    model,
    apiKey,
    primaryLanguage,
    directories,
    options: {
      ...DEFAULT_CONFIG.options,
      enableTelemetry,
    },
  };

  // Save config
  saveConfig(config);

  if (apiKey) {
    console.log("\n✅ Setup complete! You can now run:");
    console.log("   translator-sync");
  } else {
    console.log("\n✅ Setup complete! Run with API key:");
    console.log("   TRANSLATOR_API_KEY=your-key translator-sync");
  }

  return config;
}
