import { logger } from "./logger.ts";

/**
 * Local-only usage counters.
 *
 * Earlier versions shipped an OpenTelemetry pipeline that was ON by default
 * (`enableTelemetry !== false`) and could POST to `OTEL_EXPORTER_OTLP_ENDPOINT`.
 * For a translation CLI that is both a privacy problem and seven dependencies
 * for a feature almost nobody turns on.
 *
 * This module keeps the same call sites but never touches the network: numbers
 * are counted in memory, shown under `--verbose`, then thrown away.
 */

export interface TranslationMetrics {
  provider: string;
  inputTokens: number;
  outputTokens: number;
  fileCount: number;
  keyCount: number;
  responseTimeMs?: number;
  cacheHit?: boolean;
}

interface Session {
  commands: string[];
  files: number;
  keys: number;
  inputTokens: number;
  outputTokens: number;
  errors: Map<string, number>;
  feedback: number[];
  startedAt: number;
}

function newSession(): Session {
  return {
    commands: [],
    files: 0,
    keys: 0,
    inputTokens: 0,
    outputTokens: 0,
    errors: new Map(),
    feedback: [],
    startedAt: Date.now(),
  };
}

export class TelemetryCollector {
  private session: Session = newSession();
  private enabled: boolean;

  constructor(config: { enabled: boolean }) {
    this.enabled = config.enabled;
  }

  recordCommand(command: string): void {
    if (!this.enabled) return;
    if (!this.session.commands.includes(command)) this.session.commands.push(command);
  }

  recordTranslation(metrics: TranslationMetrics): void {
    if (!this.enabled) return;
    this.session.files += metrics.fileCount;
    this.session.keys += metrics.keyCount;
    this.session.inputTokens += metrics.inputTokens;
    this.session.outputTokens += metrics.outputTokens;
  }

  recordError(errorType: string, _details?: string): void {
    if (!this.enabled) return;
    this.session.errors.set(errorType, (this.session.errors.get(errorType) ?? 0) + 1);
  }

  recordFeedback(score: number, _comment?: string): void {
    if (!this.enabled) return;
    this.session.feedback.push(score);
  }

  endSession(): void {
    if (!this.enabled) return;
    if (this.session.keys === 0 && this.session.errors.size === 0) return;

    const seconds = ((Date.now() - this.session.startedAt) / 1000).toFixed(1);
    const tokens = this.session.inputTokens + this.session.outputTokens;
    logger.debug(
      `session: ${this.session.keys} key(s) in ${this.session.files} file(s), ${tokens} tokens, ${seconds}s`,
    );
    if (this.session.errors.size > 0) {
      const errors = [...this.session.errors].map(([type, count]) => `${type}x${count}`).join(", ");
      logger.debug(`session errors: ${errors}`);
    }

    this.session = newSession();
  }

  disable(): void {
    this.enabled = false;
    logger.info("Usage counters disabled for this session");
  }

  isCollectionEnabled(): boolean {
    return this.enabled;
  }

  /** In-memory snapshot. Never contains file paths, keys or translated text. */
  summary(): Record<string, number | string[]> {
    return {
      keys: this.session.keys,
      files: this.session.files,
      inputTokens: this.session.inputTokens,
      outputTokens: this.session.outputTokens,
      commands: [...this.session.commands],
    };
  }
}

let telemetryInstance: TelemetryCollector | null = null;

export function initializeTelemetry(config?: {
  options?: { enableTelemetry?: boolean };
}): TelemetryCollector {
  telemetryInstance = new TelemetryCollector({
    enabled: config?.options?.enableTelemetry !== false,
  });
  return telemetryInstance;
}

export function getTelemetry(): TelemetryCollector | null {
  return telemetryInstance;
}

export const telemetry = {
  recordCommand: (command: string) => telemetryInstance?.recordCommand(command),
  recordTranslation: (metrics: TranslationMetrics) => telemetryInstance?.recordTranslation(metrics),
  recordError: (errorType: string, details?: string) =>
    telemetryInstance?.recordError(errorType, details),
  recordFeedback: (score: number, comment?: string) =>
    telemetryInstance?.recordFeedback(score, comment),
  endSession: () => telemetryInstance?.endSession(),
  disable: () => telemetryInstance?.disable(),
  isEnabled: () => telemetryInstance?.isCollectionEnabled() ?? false,
};
