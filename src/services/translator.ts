#!/usr/bin/env bun
/**
 * TranslationService defines the interface for translation providers.
 */
export interface TranslationService {
  translateBatch(sourceLang: string, targetLang: string, texts: string[]): Promise<Map<string, string>>;
}

/**
 * A mock implementation of TranslationService.
 * It returns a map with "translated: " prepended to each input text.
 */
export class MockTranslationService implements TranslationService {
  async translateBatch(
    sourceLang: string,
    targetLang: string,
    texts: string[],
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    for (const text of texts) {
      result.set(text, `translated: ${text}`);
    }
    return result;
  }
}
