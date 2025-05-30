#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { interactiveSetup, loadConfig } from "../config/configLoader.ts";
import { loadEnv } from "../utils/envLoader.ts";
import { initializeFeedback, recordUsage } from "../utils/feedback.ts";
import { logger } from "../utils/logger.ts";
import {
  configureOTelFromEnv,
  initializeOpenTelemetry,
  shutdownOpenTelemetry,
} from "../utils/otel.ts";
import { initializeTelemetry, telemetry } from "../utils/telemetry.ts";
import { runSync } from "./sync.ts";

// Load environment variables
loadEnv();

// Initialize telemetry early (before any operations)
const otelConfig = configureOTelFromEnv();
const otelSdk = initializeOpenTelemetry(otelConfig);

// Parse command-line arguments
const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    help: { type: "boolean", default: false },
    version: { type: "boolean", default: false },
  },
  allowPositionals: true,
});

const command = positionals[0];

async function main() {
  let telemetryInitialized = false;

  try {
    // Show version
    if (values.version) {
      console.log("TranslatorSync v1.0.0");
      process.exit(0);
    }

    // Show help
    if (values.help) {
      console.log(`
TranslatorSync - AI-powered i18n file synchronization

USAGE:
  translator-sync [command] [options]

COMMANDS:
  init                 Interactive setup wizard
  sync [directory]     Synchronize translation files (default command)
  
OPTIONS:
  --help              Show this help message
  --version           Show version information

EXAMPLES:
  # First time setup
  translator-sync init

  # Sync translations in current directory
  translator-sync
  
  # Sync specific directory
  translator-sync ./locales
  
  # Sync with config in parent directory
  cd my-app && translator-sync

For more options, run: translator-sync sync --help
`);
      process.exit(0);
    }

    // Initialize telemetry and feedback (only for actual commands)
    if (!values.help && !values.version) {
      try {
        const config = loadConfig();
        if (config.options?.enableTelemetry !== false) {
          initializeTelemetry(config);
          initializeFeedback();
          telemetryInitialized = true;
          logger.debug("Telemetry initialized");
        }
      } catch (error) {
        // Config not found - that's ok for init command
        if (command !== "init") {
          logger.debug(`Could not load config for telemetry: ${error}`);
        }
      }
    }

    // Record command execution
    const span = telemetry.recordCommand(command || "sync");

    // Handle commands
    switch (command) {
      case "init":
        await interactiveSetup();
        break;

      case "sync":
        await runSync(positionals.slice(1));
        break;

      case "feedback":
        await handleFeedbackCommand(positionals.slice(1));
        break;

      default:
        // If no command, assume sync
        if (command && !command.startsWith("-")) {
          await runSync(positionals);
        } else {
          await runSync([]);
        }
    }

    // Record usage for feedback collection
    if (telemetryInitialized) {
      await recordUsage();
    }

    span?.end();
  } catch (error) {
    // Record error anonymously
    telemetry.recordError("cli_error", error instanceof Error ? error.message : String(error));
    logger.error(`Error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  } finally {
    // Graceful shutdown
    if (telemetryInitialized) {
      await telemetry.endSession();
      await shutdownOpenTelemetry();
    }
  }
}

async function handleFeedbackCommand(args: string[]) {
  const subcommand = args[0];
  const feedbackCollector = await import("../utils/feedback.ts").then((m) =>
    m.getFeedbackCollector(),
  );

  if (!feedbackCollector) {
    console.log("Feedback system not initialized.");
    return;
  }

  switch (subcommand) {
    case "--disable":
      feedbackCollector.disableFeedback();
      break;
    case "--enable":
      feedbackCollector.enableFeedback();
      break;
    case "--stats":
      feedbackCollector.showStats();
      break;
    default:
      await feedbackCollector.manualFeedback();
      break;
  }
}

// Graceful shutdown on signals
process.on("SIGINT", async () => {
  await telemetry.endSession();
  await shutdownOpenTelemetry();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await telemetry.endSession();
  await shutdownOpenTelemetry();
  process.exit(0);
});

main().catch(async (error) => {
  telemetry.recordError("main_error", error instanceof Error ? error.message : String(error));
  logger.error(`Fatal error: ${error instanceof Error ? error.message : error}`);
  await telemetry.endSession();
  await shutdownOpenTelemetry();
  process.exit(1);
});
