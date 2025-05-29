#!/usr/bin/env bun

/**
 * Provider-specific configuration defaults.
 */
export const PROVIDER_DEFAULTS = {
  openai: {
    baseURL: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    timeout: 30000,
    maxRetries: 3,
  },
  deepseek: {
    baseURL: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    timeout: 60000,
    maxRetries: 3,
  },
  groq: {
    baseURL: "https://api.groq.com/openai/v1",
    model: "llama-3-8b-instant",
    timeout: 30000,
    maxRetries: 3,
  },
  anthropic: {
    baseURL: "https://api.anthropic.com/v1",
    model: "claude-3-haiku",
    timeout: 30000,
    maxRetries: 3,
  },
} as const;

export type ProviderName = keyof typeof PROVIDER_DEFAULTS;

/**
 * Get default configuration for a provider.
 */
export function getProviderDefaults(provider: ProviderName) {
  return PROVIDER_DEFAULTS[provider];
}
