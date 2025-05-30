#!/usr/bin/env bun
import fs from "node:fs";
import path from "node:path";
import { logger } from "./logger.ts";

/**
 * Simple .env file loader for Bun.
 * Loads environment variables from .env file if it exists.
 */
export function loadEnv(envPath?: string): void {
  const defaultEnvPath = path.join(process.cwd(), ".env");
  const finalPath = envPath || defaultEnvPath;

  if (!fs.existsSync(finalPath)) {
    return; // No .env file, that's fine
  }

  try {
    const content = fs.readFileSync(finalPath, "utf8");
    const lines = content.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      // Parse KEY=VALUE format
      const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (match) {
        const [, key, value] = match;

        // Remove quotes if present
        const cleanValue = value.replace(/^["']|["']$/g, "");

        // Only set if not already in environment
        if (!(key in process.env)) {
          process.env[key] = cleanValue;
        }
      }
    }
  } catch (error) {
    logger.debug(`Could not load .env file: ${error}`);
  }
}
