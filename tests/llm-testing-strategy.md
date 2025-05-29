# LLM Testing Strategy for TranslatorSync

## Overview
Testing LLM translation services presents unique challenges due to their non-deterministic nature. This document outlines our strategy for testing real LLM integrations while maintaining reliability and useful feedback.

## Core Testing Principles

### 1. Test Behavior, Not Exact Output
Since LLM responses are non-deterministic, we test:
- **API Integration**: Connection, authentication, request/response handling
- **Output Structure**: Translation maps have correct keys and non-empty values
- **Error Handling**: Network failures, authentication issues, rate limits
- **Performance**: Response times, timeout handling
- **Cost Tracking**: Usage monitoring and budget controls

### 2. Use Secondary Validation
Instead of comparing exact strings, we validate:
- **Language Detection**: Responses appear to be in target language
- **Content Preservation**: Variables, HTML tags, formatting maintained
- **Length Reasonableness**: Translations aren't too short/long compared to source
- **Character Set**: Output uses appropriate Unicode for target language

### 3. Self-Validation with LLMs
For complex validation, we can use LLMs themselves to evaluate translations:
- **Quality Assessment**: Use a separate API call to rate translation quality
- **Accuracy Check**: Ask LLM to verify translation correctness
- **Consistency Validation**: Check multiple translations of same text for similarity

## Testing Strategy Implementation

### Test Categories

#### 1. Integration Tests (API Level)
```typescript
describe("LLM Translation Service Integration", () => {
  test("authenticates successfully with valid API key", async () => {
    const service = new OpenAIProvider({ apiKey: validApiKey });
    // Test should not throw authentication error
    const result = await service.translateBatch("en", "es", ["hello"]);
    expect(result.size).toBe(1);
    expect(result.get("hello")).toBeDefined();
  });

  test("handles rate limiting gracefully", async () => {
    // Mock rate limit response or use test with high volume
    const service = new OpenAIProvider({ apiKey: validApiKey });
    
    const startTime = Date.now();
    const result = await service.translateBatch("en", "es", ["hello"]);
    const endTime = Date.now();
    
    expect(result.size).toBe(1);
    // Should implement backoff if rate limited
    if (endTime - startTime > 1000) {
      console.log("Rate limiting detected and handled");
    }
  });
});
```

#### 2. Output Validation Tests
```typescript
describe("Translation Output Validation", () => {
  test("preserves FTL variables in translations", async () => {
    const service = new OpenAIProvider({ apiKey: validApiKey });
    const texts = ["Hello {$name}", "You have {$count} messages"];
    
    const result = await service.translateBatch("en", "es", texts);
    
    for (const [source, translation] of result) {
      // Extract variables from source
      const sourceVars = source.match(/\{\$[^}]+\}/g) || [];
      
      // Check variables are preserved in translation
      for (const variable of sourceVars) {
        expect(translation).toContain(variable);
      }
    }
  });

  test("maintains reasonable translation length", async () => {
    const service = new OpenAIProvider({ apiKey: validApiKey });
    const texts = ["Hello", "This is a medium length sentence.", "Very long text with multiple sentences and complex structure that should be translated appropriately."];
    
    const result = await service.translateBatch("en", "es", texts);
    
    for (const [source, translation] of result) {
      const sourceLength = source.length;
      const translationLength = translation.length;
      
      // Translation should be within 50% to 200% of source length
      expect(translationLength).toBeGreaterThan(sourceLength * 0.5);
      expect(translationLength).toBeLessThan(sourceLength * 2.0);
    }
  });

  test("produces non-empty translations", async () => {
    const service = new OpenAIProvider({ apiKey: validApiKey });
    const texts = ["Hello", "Goodbye", "Thank you"];
    
    const result = await service.translateBatch("en", "es", texts);
    
    for (const [source, translation] of result) {
      expect(translation.trim().length).toBeGreaterThan(0);
      expect(translation).not.toBe(source); // Should be different from source
    }
  });
});
```

#### 3. Self-Validation Tests
```typescript
describe("LLM Self-Validation", () => {
  test("translation quality assessment", async () => {
    const translationService = new OpenAIProvider({ apiKey: validApiKey });
    const validationService = new OpenAIProvider({ apiKey: validApiKey });
    
    const result = await translationService.translateBatch("en", "es", ["Hello world"]);
    const translation = result.get("Hello world");
    
    // Use LLM to validate the translation
    const validationPrompt = `
      Evaluate this translation quality on a scale of 1-10:
      Source (English): "Hello world"
      Translation (Spanish): "${translation}"
      
      Respond with only a number from 1-10.
    `;
    
    const validationResult = await validationService.translateBatch("en", "en", [validationPrompt]);
    const score = parseInt(validationResult.get(validationPrompt) || "0");
    
    expect(score).toBeGreaterThanOrEqual(6); // Expect reasonable quality
  });

  test("translation consistency check", async () => {
    const service = new OpenAIProvider({ apiKey: validApiKey });
    
    // Translate the same text multiple times
    const source = "Hello world";
    const translations = [];
    
    for (let i = 0; i < 3; i++) {
      const result = await service.translateBatch("en", "es", [source]);
      translations.push(result.get(source));
    }
    
    // Check that translations are similar (not necessarily identical)
    // This would require fuzzy string matching or LLM-based similarity check
    expect(translations).toHaveLength(3);
    translations.forEach(t => expect(t).toBeDefined());
  });
});
```

#### 4. Error Handling Tests
```typescript
describe("LLM Error Handling", () => {
  test("handles invalid API key", async () => {
    const service = new OpenAIProvider({ apiKey: "invalid-key" });
    
    await expect(
      service.translateBatch("en", "es", ["hello"])
    ).rejects.toThrow(/auth|api key|unauthorized/i);
  });

  test("handles network timeout", async () => {
    const service = new OpenAIProvider({ 
      apiKey: validApiKey,
      timeout: 1 // Very short timeout
    });
    
    await expect(
      service.translateBatch("en", "es", ["hello"])
    ).rejects.toThrow(/timeout|network/i);
  });

  test("handles quota exceeded", async () => {
    // This test would need to be carefully managed to avoid actual quota issues
    // Could use a mock service or test account with known limits
  });
});
```

#### 5. Performance Tests
```typescript
describe("LLM Performance", () => {
  test("batch processing efficiency", async () => {
    const service = new OpenAIProvider({ apiKey: validApiKey });
    const texts = Array.from({ length: 10 }, (_, i) => `Text number ${i}`);
    
    const startTime = Date.now();
    const result = await service.translateBatch("en", "es", texts);
    const endTime = Date.now();
    
    expect(result.size).toBe(10);
    expect(endTime - startTime).toBeLessThan(30000); // 30 second max
  });

  test("concurrent request handling", async () => {
    const service = new OpenAIProvider({ apiKey: validApiKey });
    
    const promises = Array.from({ length: 3 }, () =>
      service.translateBatch("en", "es", ["hello"])
    );
    
    const results = await Promise.all(promises);
    
    results.forEach(result => {
      expect(result.size).toBe(1);
      expect(result.get("hello")).toBeDefined();
    });
  });
});
```

### Test Environment Setup

#### API Key Management
```typescript
// tests/helpers/testConfig.ts
export const getTestApiKeys = () => {
  return {
    openai: process.env.OPENAI_TEST_API_KEY || process.env.OPENAI_API_KEY,
    deepseek: process.env.DEEPSEEK_TEST_API_KEY || process.env.DEEPSEEK_API_KEY,
    anthropic: process.env.ANTHROPIC_TEST_API_KEY || process.env.ANTHROPIC_API_KEY
  };
};

export const hasValidApiKey = (provider: string): boolean => {
  const keys = getTestApiKeys();
  return Boolean(keys[provider]);
};
```

#### Test Conditions
```typescript
// tests/helpers/testConditions.ts
export const skipIfNoApiKey = (provider: string) => {
  return hasValidApiKey(provider) ? test : test.skip;
};

export const runIfApiKey = (provider: string, fn: () => void) => {
  if (hasValidApiKey(provider)) {
    fn();
  } else {
    console.log(`Skipping ${provider} tests - no API key provided`);
  }
};
```

### Test Execution Strategy

#### Local Development
- **Mock by default**: Unit tests use mock services
- **Opt-in real API**: Set environment variable to enable real API tests
- **Cost control**: Limit test text size and frequency

#### CI/CD Pipeline
- **Separate test suite**: LLM integration tests run separately from unit tests
- **API key management**: Secure environment variables for test keys
- **Cost monitoring**: Track and limit API usage in tests
- **Failure tolerance**: LLM tests can be flaky, allow retries

#### Test Data Management
```typescript
// tests/fixtures/llmTestData.ts
export const testTranslations = {
  simple: ["Hello", "Goodbye", "Thank you"],
  withVariables: ["Hello {$name}", "You have {$count} messages"],
  multiline: ["Line 1\nLine 2\nLine 3"],
  withHtml: ["<strong>Bold text</strong>", "<p>Paragraph</p>"],
  edge: ["", "   ", "🌍", "Very long text..."]
};

export const expectedBehaviors = {
  preserveVariables: true,
  preserveHtml: true,
  nonEmptyOutput: true,
  reasonableLength: true
};
```

### Validation Helpers

#### Language Detection Helper
```typescript
// tests/helpers/languageValidation.ts
export const detectLanguage = async (text: string): Promise<string> => {
  // Simple heuristic or use a language detection library
  // Could also use LLM for language detection
  const patterns = {
    es: /[ñáéíóúü]/i,
    fr: /[àâäçéèêëïîôöùûüÿ]/i,
    de: /[äöüß]/i
  };
  
  for (const [lang, pattern] of Object.entries(patterns)) {
    if (pattern.test(text)) {
      return lang;
    }
  }
  
  return "unknown";
};
```

#### Variable Preservation Helper
```typescript
// tests/helpers/variableValidation.ts
export const validateVariablePreservation = (source: string, translation: string): boolean => {
  const sourceVars = source.match(/\{\$[^}]+\}/g) || [];
  const translationVars = translation.match(/\{\$[^}]+\}/g) || [];
  
  if (sourceVars.length !== translationVars.length) {
    return false;
  }
  
  for (const variable of sourceVars) {
    if (!translationVars.includes(variable)) {
      return false;
    }
  }
  
  return true;
};
```

## Usage Guidelines

### Running LLM Tests
```bash
# Run all tests (mock services only)
bun test

# Run with real LLM services (requires API keys)
ENABLE_LLM_TESTS=true bun test tests/integration/llm/

# Run specific provider tests
OPENAI_API_KEY=your_key bun test tests/integration/llm/openai.test.ts

# Run performance tests (use sparingly)
ENABLE_PERFORMANCE_TESTS=true bun test tests/performance/llm/
```

### Cost Management
- **Budget limits**: Set daily/monthly API usage limits
- **Test optimization**: Use smallest effective test data
- **Shared resources**: Reuse translations across multiple test assertions
- **Monitoring**: Track costs per test run

### Debugging LLM Tests
```typescript
// tests/helpers/debugging.ts
export const debugLLMResponse = (source: string, translation: string, metadata?: any) => {
  if (process.env.DEBUG_LLM_TESTS) {
    console.log("=== LLM Translation Debug ===");
    console.log("Source:", source);
    console.log("Translation:", translation);
    console.log("Metadata:", metadata);
    console.log("================");
  }
};
```

This strategy ensures reliable testing of LLM services while managing costs and maintaining useful feedback for development.