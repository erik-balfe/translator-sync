#!/usr/bin/env bun

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

export interface LoggerConfig {
  level: LogLevel;
  silent?: boolean;
}

/**
 * Simple logger implementation with log levels.
 * In production, this could be replaced with a more robust logging library.
 */
export class Logger {
  private static instance: Logger;
  private level: LogLevel;
  private silent: boolean;

  private readonly levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    silent: 4,
  };

  private constructor(config: LoggerConfig) {
    this.level = config.level;
    this.silent = config.silent || false;
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      const level =
        (process.env.LOG_LEVEL as LogLevel) ||
        (process.env.NODE_ENV === "production" ? "info" : "debug");

      Logger.instance = new Logger({
        level,
        silent: process.env.LOG_SILENT === "true",
      });
    }
    return Logger.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    if (this.silent) return false;
    return this.levels[level] >= this.levels[this.level];
  }

  private formatMessage(level: LogLevel, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    if (data !== undefined) {
      const dataStr = typeof data === "object" ? JSON.stringify(data, null, 2) : String(data);
      return `${prefix} ${message}\n${dataStr}`;
    }

    return `${prefix} ${message}`;
  }

  debug(message: string, data?: unknown): void {
    if (this.shouldLog("debug")) {
      console.log(this.formatMessage("debug", message, data));
    }
  }

  info(message: string, data?: unknown): void {
    if (this.shouldLog("info")) {
      console.log(this.formatMessage("info", message, data));
    }
  }

  warn(message: string, data?: unknown): void {
    if (this.shouldLog("warn")) {
      console.warn(this.formatMessage("warn", message, data));
    }
  }

  error(message: string, data?: unknown): void {
    if (this.shouldLog("error")) {
      console.error(this.formatMessage("error", message, data));
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setSilent(silent: boolean): void {
    this.silent = silent;
  }
}

// Export singleton instance
export const logger = Logger.getInstance();
