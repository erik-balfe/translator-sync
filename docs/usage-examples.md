# TranslatorSync Usage Examples

## Quick Start

### 1. Basic Usage (Mock Service)
```bash
# Default behavior - uses mock translation service
bun run src/cli/index.ts path/to/translations/

# Explicitly use mock service
TRANSLATOR_SERVICE=mock bun run src/cli/index.ts path/to/translations/
```

### 2. OpenAI Integration
```bash
# Set your OpenAI API key
export OPENAI_API_KEY="your-api-key-here"

# Use OpenAI service
TRANSLATOR_SERVICE=openai bun run src/cli/index.ts path/to/translations/

# Use specific model
TRANSLATOR_SERVICE=openai TRANSLATOR_MODEL=gpt-4 bun run src/cli/index.ts path/to/translations/
```

### 3. DeepSeek Integration
```bash
# Set your DeepSeek API key
export DEEPSEEK_API_KEY="your-api-key-here"

# Use DeepSeek service (uses OpenAI-compatible API)
TRANSLATOR_SERVICE=deepseek TRANSLATOR_API_KEY=$DEEPSEEK_API_KEY bun run src/cli/index.ts path/to/translations/
```

## Environment Variables

### Translation Service Configuration
```bash
# Service provider selection
TRANSLATOR_SERVICE=openai|deepseek|mock

# API authentication
TRANSLATOR_API_KEY=your-api-key

# Model selection (optional)
TRANSLATOR_MODEL=gpt-4o-mini|gpt-4|deepseek-chat

# Advanced configuration (optional)
TRANSLATOR_BASE_URL=https://api.custom-provider.com/v1
TRANSLATOR_TIMEOUT=30000
TRANSLATOR_MAX_RETRIES=3
```

## Real-World Examples

### Example 1: UI Translation Project
```bash
# Project structure
translations/
├── en.ftl          # Source (English)
├── es.ftl          # Target (Spanish)
├── fr.ftl          # Target (French)
└── de.ftl          # Target (German)

# Sync all translations using OpenAI
OPENAI_API_KEY="sk-..." TRANSLATOR_SERVICE=openai bun run src/cli/index.ts translations/
```

**Sample en.ftl:**
```fluent
welcome = Welcome to our app!
login-button = Log In
user-greeting = Hello, {$username}!
item-count = You have {$count} items
```

**Generated es.ftl (by OpenAI):**
```fluent
welcome = ¡Bienvenido a nuestra aplicación!
login-button = Iniciar Sesión
user-greeting = ¡Hola, {$username}!
item-count = Tienes {$count} elementos
```

### Example 2: Technical Documentation
```bash
# For technical content, you can specify domain context in the future
# Currently handled automatically by the OpenAI provider
OPENAI_API_KEY="sk-..." TRANSLATOR_SERVICE=openai bun run src/cli/index.ts docs/translations/
```

### Example 3: Marketing Content
```bash
# DeepSeek for cost-effective marketing translations
DEEPSEEK_API_KEY="sk-..." TRANSLATOR_SERVICE=deepseek bun run src/cli/index.ts marketing/translations/
```

## Testing the Integration

### 1. Test with Mock Service
```bash
# No API key required
bun test

# Or explicitly
TRANSLATOR_SERVICE=mock bun test tests/integration/syncTranslations.test.ts
```

### 2. Test with Real LLM Services
```bash
# Test OpenAI integration (requires API key)
OPENAI_API_KEY="your-key" bun test tests/integration/llm/openai.test.ts

# Test specific functionality
OPENAI_API_KEY="your-key" bun test tests/integration/llm/openai.test.ts -t "preserves FTL variables"
```

## Advanced Usage

### Custom Translation Context (Future)
```typescript
// When using the service programmatically
import { OpenAIProvider } from './src/services/openaiProvider';

const provider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY!
});

const result = await provider.translateBatch("en", "es", [
  "Welcome to our technical documentation"
], {
  domain: "technical",
  tone: "professional",
  preserveVariables: true
});
```

### Error Handling
```bash
# The CLI provides clear error messages for common issues:

# Missing API key
$ TRANSLATOR_SERVICE=openai bun run src/cli/index.ts translations/
# Error: OpenAI API key is required

# Invalid API key
$ TRANSLATOR_SERVICE=openai TRANSLATOR_API_KEY=invalid bun run src/cli/index.ts translations/
# Error: OpenAI API authentication failed. Please check your API key.

# Rate limiting
$ TRANSLATOR_SERVICE=openai TRANSLATOR_API_KEY=your-key bun run src/cli/index.ts large-project/
# Error: OpenAI API rate limit exceeded. Please try again later.
```

## Performance Considerations

### Cost Management
- **gpt-4o-mini**: Most cost-effective for general translations (~$0.15/1M tokens)
- **gpt-4**: Higher quality but more expensive (~$30/1M tokens)
- **deepseek-chat**: Very cost-effective alternative (~$0.14/1M tokens)

### Speed Optimization
- Use batch processing (automatically handled)
- Smaller files process faster
- Consider using gpt-4o-mini for development/testing

### Quality vs Cost Trade-offs
```bash
# Development/testing (fast, cheap)
TRANSLATOR_SERVICE=deepseek TRANSLATOR_MODEL=deepseek-chat

# Production (balanced)
TRANSLATOR_SERVICE=openai TRANSLATOR_MODEL=gpt-4o-mini

# High-quality marketing content
TRANSLATOR_SERVICE=openai TRANSLATOR_MODEL=gpt-4
```

## Troubleshooting

### Common Issues

1. **API Key Problems**
   ```bash
   # Check if key is set
   echo $OPENAI_API_KEY
   
   # Test with a simple request
   TRANSLATOR_SERVICE=openai bun run src/cli/index.ts fixtures/valid/
   ```

2. **Network Issues**
   ```bash
   # Increase timeout for slow connections
   TRANSLATOR_TIMEOUT=60000 TRANSLATOR_SERVICE=openai bun run src/cli/index.ts translations/
   ```

3. **Rate Limiting**
   ```bash
   # Reduce batch size or add delays (future feature)
   TRANSLATOR_MAX_RETRIES=5 TRANSLATOR_SERVICE=openai bun run src/cli/index.ts translations/
   ```

## Development Workflow

### 1. Local Development
```bash
# Use mock service for fast iteration
bun run src/cli/index.ts fixtures/valid/

# Quick test with real service
TRANSLATOR_SERVICE=openai OPENAI_API_KEY="sk-..." bun run src/cli/index.ts fixtures/valid/
```

### 2. Testing Changes
```bash
# Run all tests
bun test

# Test specific functionality
bun test tests/unit/services/translator.test.ts
bun test tests/integration/syncTranslations.test.ts
```

### 3. Production Deployment
```bash
# Set production environment variables
export TRANSLATOR_SERVICE=openai
export TRANSLATOR_API_KEY="your-production-api-key"
export TRANSLATOR_MODEL=gpt-4o-mini

# Run with production settings
bun run src/cli/index.ts production/translations/
```

## Next Steps

Ready for the following enhancements:
1. **Configuration files**: JSON/YAML config support
2. **CLI flags**: `--service`, `--model`, `--dry-run`, `--verbose`
3. **Caching**: Avoid re-translating unchanged content
4. **Progress indicators**: Real-time translation progress
5. **Batch optimization**: Smart batching for better performance