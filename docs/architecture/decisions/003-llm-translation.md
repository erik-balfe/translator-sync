# ADR-003: Configurable LLM Translation Service Architecture

## Status
**Accepted** - 2025-01-XX

## Context
TranslatorSync requires a robust, configurable translation service that can:
- Support multiple LLM providers (OpenAI, DeepSeek, Anthropic, etc.)
- Handle different pricing models and rate limits
- Provide fallback mechanisms for reliability
- Support cost tracking and optimization
- Allow easy switching between providers
- Scale from development to production usage

## Decision
We will implement a **configurable, multi-provider LLM translation architecture** with:
1. **Service abstraction layer** with unified interface
2. **Provider-specific implementations** for each LLM service
3. **Fallback chain support** for reliability
4. **Configuration-driven provider selection**
5. **Built-in rate limiting and retry logic**
6. **Cost tracking and monitoring**

## Architecture Design

### Core Interface
```typescript
interface TranslationService {
  translateBatch(
    sourceLang: string,
    targetLang: string,
    texts: string[],
    context?: TranslationContext
  ): Promise<Map<string, string>>;
  
  getConfig(): ProviderConfig;
  getCostEstimate(textCount: number, avgLength: number): Promise<number>;
  getUsageStats(): UsageStats;
}

interface TranslationContext {
  domain?: string;           // e.g., 'technical', 'marketing', 'ui'
  tone?: string;            // e.g., 'formal', 'casual', 'professional'
  preserveVariables?: boolean; // Maintain FTL variables like {$username}
  maxLength?: number;       // Response length constraints
}
```

### Provider Implementation Pattern
```typescript
abstract class BaseLLMProvider implements TranslationService {
  protected config: ProviderConfig;
  protected rateLimiter: RateLimiter;
  protected costTracker: CostTracker;
  
  abstract translateBatch(
    sourceLang: string,
    targetLang: string,
    texts: string[],
    context?: TranslationContext
  ): Promise<Map<string, string>>;
  
  protected abstract buildPrompt(
    sourceLang: string,
    targetLang: string,
    texts: string[],
    context: TranslationContext
  ): string;
  
  protected abstract parseResponse(response: any): Map<string, string>;
}
```

### Service Factory
```typescript
class TranslationServiceFactory {
  static create(config: TranslationConfig): TranslationService {
    const primaryProvider = this.createProvider(config.primary);
    const fallbackProviders = config.fallbacks?.map(c => this.createProvider(c)) || [];
    
    return new FallbackTranslationService(primaryProvider, fallbackProviders);
  }
  
  private static createProvider(config: ProviderConfig): TranslationService {
    switch (config.provider) {
      case 'openai': return new OpenAIProvider(config);
      case 'deepseek': return new DeepSeekProvider(config);
      case 'anthropic': return new AnthropicProvider(config);
      case 'openrouter': return new OpenRouterProvider(config);
      default: throw new Error(`Unknown provider: ${config.provider}`);
    }
  }
}
```

## Provider Implementations

### OpenAI Provider
```typescript
class OpenAIProvider extends BaseLLMProvider {
  private client: OpenAI;
  
  constructor(config: OpenAIConfig) {
    super(config);
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL
    });
  }
  
  async translateBatch(
    sourceLang: string,
    targetLang: string,
    texts: string[],
    context: TranslationContext = {}
  ): Promise<Map<string, string>> {
    await this.rateLimiter.acquire();
    
    const prompt = this.buildPrompt(sourceLang, targetLang, texts, context);
    
    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model || 'gpt-4-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1, // Low temperature for consistent translations
        max_tokens: this.calculateMaxTokens(texts),
      });
      
      const translations = this.parseResponse(response);
      this.costTracker.recordUsage(response.usage);
      
      return translations;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }
  
  protected buildPrompt(
    sourceLang: string,
    targetLang: string,
    texts: string[],
    context: TranslationContext
  ): string {
    const contextInstructions = this.buildContextInstructions(context);
    
    return `You are a professional translator. Translate the following texts from ${sourceLang} to ${targetLang}.

${contextInstructions}

IMPORTANT RULES:
- Preserve any variables in curly braces like {$username} or {$count}
- Maintain the same formatting (line breaks, spacing)
- Return translations in the same order as input
- For Fluent format, preserve pluralization syntax
- Be culturally appropriate for the target language

Input texts (one per line):
${texts.map((text, i) => `${i + 1}. ${text}`).join('\n')}

Output format (one translation per line, same order):`;
  }
}
```

### DeepSeek Provider
```typescript
class DeepSeekProvider extends BaseLLMProvider {
  private client: HttpClient;
  
  constructor(config: DeepSeekConfig) {
    super(config);
    this.client = new HttpClient({
      baseURL: 'https://api.deepseek.com/v1',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }
  
  async translateBatch(
    sourceLang: string,
    targetLang: string,
    texts: string[],
    context: TranslationContext = {}
  ): Promise<Map<string, string>> {
    await this.rateLimiter.acquire();
    
    const prompt = this.buildPrompt(sourceLang, targetLang, texts, context);
    
    try {
      const response = await this.client.post('/chat/completions', {
        model: this.config.model || 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: this.calculateMaxTokens(texts),
      });
      
      const translations = this.parseResponse(response.data);
      this.costTracker.recordUsage({
        prompt_tokens: response.data.usage.prompt_tokens,
        completion_tokens: response.data.usage.completion_tokens,
        total_tokens: response.data.usage.total_tokens
      });
      
      return translations;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }
}
```

## Configuration System

### Configuration Schema
```typescript
interface TranslationConfig {
  primary: ProviderConfig;
  fallbacks?: ProviderConfig[];
  caching?: CacheConfig;
  rateLimiting?: RateLimitConfig;
  costTracking?: CostTrackingConfig;
}

interface ProviderConfig {
  provider: 'openai' | 'deepseek' | 'anthropic' | 'openrouter';
  apiKey: string;
  model?: string;
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;
  customHeaders?: Record<string, string>;
}

interface CacheConfig {
  enabled: boolean;
  ttl: number; // Time to live in seconds
  maxSize: number; // Maximum cache entries
  persistToFile?: boolean;
}

interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerDay?: number;
  burstSize?: number;
}
```

### Configuration Sources
```typescript
class ConfigManager {
  static load(): TranslationConfig {
    // Priority order: CLI args > env vars > config file > defaults
    return {
      ...this.loadDefaults(),
      ...this.loadFromFile(),
      ...this.loadFromEnv(),
      ...this.loadFromCLI()
    };
  }
  
  private static loadFromEnv(): Partial<TranslationConfig> {
    return {
      primary: {
        provider: process.env.TRANSLATOR_SERVICE as any,
        apiKey: process.env.TRANSLATOR_API_KEY!,
        model: process.env.TRANSLATOR_MODEL,
        baseURL: process.env.TRANSLATOR_BASE_URL
      }
    };
  }
  
  private static loadFromFile(): Partial<TranslationConfig> {
    const configPath = process.env.TRANSLATOR_CONFIG || './translator.config.json';
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    return {};
  }
}
```

### Example Configuration Files
```json
// translator.config.json
{
  "primary": {
    "provider": "deepseek",
    "apiKey": "${DEEPSEEK_API_KEY}",
    "model": "deepseek-chat",
    "timeout": 30000
  },
  "fallbacks": [
    {
      "provider": "openai",
      "apiKey": "${OPENAI_API_KEY}",
      "model": "gpt-4-turbo"
    }
  ],
  "caching": {
    "enabled": true,
    "ttl": 86400,
    "maxSize": 10000,
    "persistToFile": true
  },
  "rateLimiting": {
    "requestsPerMinute": 60,
    "requestsPerDay": 10000,
    "burstSize": 10
  },
  "costTracking": {
    "enabled": true,
    "budgetLimit": 100.00,
    "alertThreshold": 0.8
  }
}
```

## Fallback Strategy

### Fallback Chain Implementation
```typescript
class FallbackTranslationService implements TranslationService {
  constructor(
    private primary: TranslationService,
    private fallbacks: TranslationService[]
  ) {}
  
  async translateBatch(
    sourceLang: string,
    targetLang: string,
    texts: string[],
    context?: TranslationContext
  ): Promise<Map<string, string>> {
    const providers = [this.primary, ...this.fallbacks];
    
    for (let i = 0; i < providers.length; i++) {
      try {
        const result = await providers[i].translateBatch(
          sourceLang, 
          targetLang, 
          texts, 
          context
        );
        
        if (i > 0) {
          console.warn(`Primary provider failed, used fallback #${i}`);
        }
        
        return result;
      } catch (error) {
        console.warn(`Provider ${i} failed:`, error.message);
        
        if (i === providers.length - 1) {
          throw new Error('All translation providers failed');
        }
      }
    }
    
    throw new Error('No translation providers available');
  }
}
```

### Error Classification
```typescript
enum ErrorType {
  RATE_LIMIT = 'rate_limit',
  AUTH_FAILED = 'auth_failed',
  QUOTA_EXCEEDED = 'quota_exceeded',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  INVALID_REQUEST = 'invalid_request',
  NETWORK_ERROR = 'network_error'
}

class ErrorClassifier {
  static classify(error: any): ErrorType {
    if (error.status === 429) return ErrorType.RATE_LIMIT;
    if (error.status === 401 || error.status === 403) return ErrorType.AUTH_FAILED;
    if (error.status === 402) return ErrorType.QUOTA_EXCEEDED;
    if (error.status >= 500) return ErrorType.SERVICE_UNAVAILABLE;
    if (error.status === 400) return ErrorType.INVALID_REQUEST;
    return ErrorType.NETWORK_ERROR;
  }
  
  static shouldRetry(errorType: ErrorType): boolean {
    return [
      ErrorType.RATE_LIMIT,
      ErrorType.SERVICE_UNAVAILABLE,
      ErrorType.NETWORK_ERROR
    ].includes(errorType);
  }
  
  static shouldFallback(errorType: ErrorType): boolean {
    return [
      ErrorType.AUTH_FAILED,
      ErrorType.QUOTA_EXCEEDED,
      ErrorType.SERVICE_UNAVAILABLE
    ].includes(errorType);
  }
}
```

## Cost Tracking

### Cost Calculator
```typescript
class CostTracker {
  private usage: UsageRecord[] = [];
  
  recordUsage(usage: TokenUsage) {
    const cost = this.calculateCost(usage);
    this.usage.push({
      timestamp: new Date(),
      provider: this.config.provider,
      model: this.config.model,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      cost: cost
    });
  }
  
  private calculateCost(usage: TokenUsage): number {
    const pricing = this.getPricing();
    const promptCost = (usage.prompt_tokens / 1000) * pricing.input;
    const completionCost = (usage.completion_tokens / 1000) * pricing.output;
    return promptCost + completionCost;
  }
  
  getTotalCost(): number {
    return this.usage.reduce((sum, record) => sum + record.cost, 0);
  }
  
  getUsageByTimeframe(hours: number): UsageStats {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentUsage = this.usage.filter(r => r.timestamp > cutoff);
    
    return {
      requests: recentUsage.length,
      totalTokens: recentUsage.reduce((sum, r) => sum + r.totalTokens, 0),
      totalCost: recentUsage.reduce((sum, r) => sum + r.cost, 0),
      averageLatency: this.calculateAverageLatency(recentUsage)
    };
  }
}
```

## Rate Limiting

### Token Bucket Implementation
```typescript
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  
  constructor(
    private maxTokens: number,
    private refillRate: number // tokens per second
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }
  
  async acquire(tokensNeeded: number = 1): Promise<void> {
    this.refill();
    
    if (this.tokens >= tokensNeeded) {
      this.tokens -= tokensNeeded;
      return;
    }
    
    // Wait for tokens to be available
    const waitTime = ((tokensNeeded - this.tokens) / this.refillRate) * 1000;
    await this.sleep(waitTime);
    await this.acquire(tokensNeeded);
  }
  
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = elapsed * this.refillRate;
    
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Caching Strategy

### Multi-Level Cache
```typescript
class TranslationCache {
  private memoryCache = new Map<string, CacheEntry>();
  private persistentCache?: FileSystemCache;
  
  constructor(private config: CacheConfig) {
    if (config.persistToFile) {
      this.persistentCache = new FileSystemCache(config);
    }
  }
  
  async get(
    sourceLang: string,
    targetLang: string,
    text: string
  ): Promise<string | null> {
    const key = this.createKey(sourceLang, targetLang, text);
    
    // Check memory cache first
    const memoryResult = this.memoryCache.get(key);
    if (memoryResult && !this.isExpired(memoryResult)) {
      return memoryResult.translation;
    }
    
    // Check persistent cache
    if (this.persistentCache) {
      const persistentResult = await this.persistentCache.get(key);
      if (persistentResult) {
        // Promote to memory cache
        this.memoryCache.set(key, persistentResult);
        return persistentResult.translation;
      }
    }
    
    return null;
  }
  
  async set(
    sourceLang: string,
    targetLang: string,
    text: string,
    translation: string
  ): Promise<void> {
    const key = this.createKey(sourceLang, targetLang, text);
    const entry: CacheEntry = {
      translation,
      timestamp: Date.now(),
      ttl: this.config.ttl
    };
    
    // Store in memory cache
    this.memoryCache.set(key, entry);
    
    // Store in persistent cache
    if (this.persistentCache) {
      await this.persistentCache.set(key, entry);
    }
    
    // Cleanup if memory cache is too large
    if (this.memoryCache.size > this.config.maxSize) {
      this.evictOldest();
    }
  }
  
  private createKey(sourceLang: string, targetLang: string, text: string): string {
    return `${sourceLang}:${targetLang}:${this.hashText(text)}`;
  }
  
  private hashText(text: string): string {
    // Simple hash for cache key (in production, use crypto hash)
    return Buffer.from(text).toString('base64').substring(0, 32);
  }
}
```

## Quality Validation

### Translation Validator
```typescript
class TranslationValidator {
  validateTranslation(
    source: string,
    translation: string,
    context: TranslationContext
  ): ValidationResult {
    const issues: ValidationIssue[] = [];
    
    // Check variable preservation
    if (context.preserveVariables) {
      issues.push(...this.validateVariables(source, translation));
    }
    
    // Check length constraints
    if (context.maxLength) {
      issues.push(...this.validateLength(translation, context.maxLength));
    }
    
    // Check formatting preservation
    issues.push(...this.validateFormatting(source, translation));
    
    return {
      isValid: issues.length === 0,
      issues,
      score: this.calculateQualityScore(issues)
    };
  }
  
  private validateVariables(source: string, translation: string): ValidationIssue[] {
    const sourceVars = this.extractVariables(source);
    const translationVars = this.extractVariables(translation);
    
    const issues: ValidationIssue[] = [];
    
    for (const variable of sourceVars) {
      if (!translationVars.includes(variable)) {
        issues.push({
          type: 'missing_variable',
          message: `Variable ${variable} missing in translation`,
          severity: 'error'
        });
      }
    }
    
    return issues;
  }
  
  private extractVariables(text: string): string[] {
    const matches = text.match(/\{\$[^}]+\}/g) || [];
    return matches;
  }
}
```

## Integration Example

### Usage in CLI
```typescript
// src/cli/index.ts
async function main() {
  const config = ConfigManager.load();
  const translationService = TranslationServiceFactory.create(config);
  
  // Use the service
  const translations = await translationService.translateBatch(
    'en',
    'es',
    ['Hello, world!', 'Welcome to our app'],
    {
      domain: 'ui',
      tone: 'casual',
      preserveVariables: true
    }
  );
  
  // Monitor usage
  const stats = translationService.getUsageStats();
  console.log(`Cost: $${stats.totalCost.toFixed(4)}`);
  console.log(`Requests: ${stats.requests}`);
}
```

## Benefits of This Architecture

### Flexibility
- Easy to add new providers
- Configuration-driven behavior
- Runtime provider switching

### Reliability
- Automatic fallback on failures
- Retry logic with exponential backoff
- Circuit breaker pattern for failing services

### Cost Control
- Real-time cost tracking
- Budget limits and alerts
- Usage optimization through caching

### Performance
- Intelligent caching strategy
- Batch processing optimization
- Rate limiting to respect API limits

### Maintainability
- Clear separation of concerns
- Comprehensive error handling
- Extensive testing capabilities

## Related Decisions
- [ADR-001: Choose Bun Runtime](001-choose-bun.md) - Runtime for service implementation
- [ADR-002: Fluent Format](002-fluent-format.md) - Translation output format
- [ADR-004: Testing Strategy](004-testing-strategy.md) - Service testing approach

## Implementation Plan
1. **Week 3**: Core interface and OpenAI provider
2. **Week 4**: DeepSeek provider and fallback mechanism
3. **Week 5**: Caching and rate limiting
4. **Week 6**: Cost tracking and monitoring
5. **Week 7**: Quality validation and optimization
6. **Week 8**: Production hardening and documentation