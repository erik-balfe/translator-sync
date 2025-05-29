# TranslatorSync

AI-powered i18n translation file synchronization. Keep all your translation files in sync across multiple languages using OpenAI, DeepSeek, or Groq.

[![npm version](https://badge.fury.io/js/%40tyr%2Ftranslator-sync.svg)](https://www.npmjs.com/package/@tyr/translator-sync)
[![JSR](https://jsr.io/badges/@tyr/translator-sync)](https://jsr.io/@tyr/translator-sync)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 🌐 **Universal Format Support** - JSON (React/Vue/Angular) and Fluent (.ftl)
- 🤖 **Multiple AI Providers** - OpenAI GPT, DeepSeek, Groq
- 🔄 **Smart Sync** - Only translates missing keys
- 💰 **Cost Tracking** - Monitor API usage and costs
- 🎯 **Variable Preservation** - Maintains `{{variables}}`, `{variables}`, and more
- 📁 **Flexible Structure** - Works with any directory layout
- ⚡ **Fast & Reliable** - Built with Bun, includes retry logic
- 🔒 **Production Ready** - Comprehensive error handling and security

## 🚀 Quick Start

### Install from npm
```bash
# Run without installation
npx @tyr/translator-sync init

# Or install globally
npm install -g @tyr/translator-sync
translator-sync init
```

### Install from JSR
```bash
deno install -Agf jsr:@tyr/translator-sync
translator-sync init
```

## 📖 Usage

### 1. Initialize (First Time)

```bash
translator-sync init

🌐 TranslatorSync Setup

Select translation provider:
1. OpenAI (GPT-4.1-nano) - Best quality ✅
2. DeepSeek (DeepSeek-v3) - Budget-friendly
3. Other (see docs for more options)

? Enter choice (1-3): 1
? Enter your OPENAI API key: ***
? Primary language code (default: en): en
? Where are your translation files? ./locales

✅ Configuration saved to .translator-sync.json
```

### 2. Sync Translations

```bash
# Sync all configured directories
translator-sync

# Sync specific directory
translator-sync ./public/locales

# Preview changes without writing
translator-sync --dry-run --verbose
```

## 📁 Supported Directory Structures

### React i18next (Subdirectories)

```
locales/
├── en/
│   └── translation.json
├── es/
│   └── translation.json
└── fr/
    └── translation.json
```

### Flat Structure

```
locales/
├── en.json
├── es.json
└── fr.json
```

### Namespaced Files

```
locales/
├── en/
│   ├── common.json
│   ├── dashboard.json
│   └── auth.json
└── es/
    ├── common.json
    ├── dashboard.json
    └── auth.json
```

### Fluent (.ftl) Files

```
locales/
├── en.ftl
├── es.ftl
└── fr.ftl
```

## 🔧 Configuration

TranslatorSync uses a `.translator-sync.json` file:

```json
{
  "version": "1.0",
  "provider": "openai",
  "model": "gpt-4.1-nano",
  "primaryLanguage": "en",
  "directories": ["./locales", "./public/locales"],
  "options": {
    "preserveFormatting": true,
    "costWarningThreshold": 1.0,
    "maxConcurrentRequests": 3
  }
}
```

### Environment Variables

```bash
# Required
TRANSLATOR_API_KEY=your-api-key-here

# Optional overrides
TRANSLATOR_SERVICE=openai        # Override provider
TRANSLATOR_MODEL=gpt-4.1-nano   # Override model
LOG_LEVEL=info                   # debug, info, warn, error
NODE_ENV=production              # Environment
```

## 🤖 AI Providers & Models

### Recommended Models (2024)

| Provider     | Model            | Quality    | Cost/1M tokens | Best For            |
| ------------ | ---------------- | ---------- | -------------- | ------------------- |
| **OpenAI**   | **gpt-4.1-nano** | ⭐⭐⭐⭐⭐ | $0.15/$0.60    | **Production** ✅   |
| **DeepSeek** | **deepseek-v3**  | ⭐⭐⭐⭐   | $0.14/$0.28    | **Budget-friendly** |

_Default: **gpt-4.1-nano** - Best balance of quality and cost for professional translations_

For development/testing, see our [pricing guide](docs/reference/llm-pricing.md) for additional options.

### Provider Setup

**OpenAI:**

```bash
# Get API key from: https://platform.openai.com/api-keys
export TRANSLATOR_API_KEY=sk-...
export TRANSLATOR_SERVICE=openai
export TRANSLATOR_MODEL=gpt-4.1-nano
```

**DeepSeek:**

```bash
# Get API key from: https://platform.deepseek.com/api-keys
export TRANSLATOR_API_KEY=sk-...
export TRANSLATOR_SERVICE=deepseek
export TRANSLATOR_MODEL=deepseek-v3
```

## 🎯 Variable Support

Automatically preserves all variable formats:

- **React i18next**: `{{name}}`, `{{count}}`
- **Vue i18n**: `{name}`, `{count}`
- **React Intl**: `{name}`
- **Ruby i18n**: `%{name}`
- **Fluent**: `{$name}`

## 📝 Example Translation

**English (en/translation.json):**

```json
{
  "welcome": "Welcome, {{name}}!",
  "items": "You have {{count}} items",
  "auth": {
    "login": "Please log in to continue",
    "error": "Invalid credentials"
  }
}
```

**Auto-translated Spanish (es/translation.json):**

```json
{
  "welcome": "¡Bienvenido, {{name}}!",
  "items": "Tienes {{count}} artículos",
  "auth": {
    "login": "Por favor inicia sesión para continuar",
    "error": "Credenciales inválidas"
  }
}
```

## 💰 Cost Estimation

### Typical Usage

- **Initial setup (1000 keys)**: ~$0.05-$0.10
- **Regular sync (20 keys)**: ~$0.001-$0.005
- **Monthly usage (100 keys)**: ~$0.01-$0.05

### Real Example

```bash
translator-sync

📁 locales/
   Primary: en.json (1045 keys)
   🔄 es.json - 20 missing keys
   ✅ Updated es.json

📊 Summary:
   Translations: 20
   Cost: $0.0006
   Mode: Production
```

## 🔄 CI/CD Integration

### GitHub Actions

```yaml
name: Sync Translations
on:
  push:
    paths: ["locales/en/**"]

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Sync Translations
        env:
          TRANSLATOR_API_KEY: ${{ secrets.TRANSLATOR_API_KEY }}
          TRANSLATOR_SERVICE: openai
          TRANSLATOR_MODEL: gpt-4.1-nano
        run: |
          npx translator-sync

      - name: Commit Changes
        run: |
          git config --local user.email "bot@company.com"
          git config --local user.name "Translation Bot"
          git add locales/
          git diff --staged --quiet || git commit -m "chore: sync translations [skip ci]"
          git push
```

## 🏗️ Development

### Requirements

- [Bun](https://bun.sh) v1.2+ (primary runtime)
- Node.js 18+ (npm compatibility)
- TypeScript 5+

### Local Development

```bash
# Clone repository
git clone https://github.com/your-org/translator-sync.git
cd translator-sync

# Install dependencies
bun install

# Run tests
bun test

# Run linting
bun run check

# Build for production
bun run build
```

### Testing

```bash
# Run all tests
bun test

# Run integration tests only
bun test tests/integration/

# Run with real API (requires API key)
TRANSLATOR_API_KEY=sk-... bun test tests/integration/llm/
```

## 🔧 Advanced Usage

### Custom Context

```bash
# Technical documentation
translator-sync --context="technical"

# Marketing content
translator-sync --context="marketing"

# Specific tone
translator-sync --context="formal"
```

### Batch Processing

```bash
# Process multiple directories
translator-sync ./web/locales ./mobile/locales ./api/locales

# Large projects with rate limiting
translator-sync --max-concurrent=1 --delay=1000
```

### Quality Control

```bash
# Review mode (manual approval)
translator-sync --review

# Quality scoring
translator-sync --quality-check

# Translation memory
translator-sync --use-memory
```

## 🚀 Roadmap

### v1.0 (Current)

- ✅ JSON & Fluent support
- ✅ OpenAI, DeepSeek, Groq providers
- ✅ Variable preservation
- ✅ Cost tracking

### v1.1 (Next)

- 🚧 Anthropic Claude support
- 🚧 Google Gemini support
- 🚧 Translation memory
- 🚧 Quality scoring

### v1.2 (Future)

- 📋 Pluralization rules
- 📋 Context-aware translation
- 📋 Translation review workflow
- 📋 Custom translation models

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md).

### Quick Contribution

```bash
# Fork and clone
git clone https://github.com/your-username/translator-sync.git

# Create feature branch
git checkout -b feature/amazing-feature

# Make changes and test
bun test

# Commit with conventional commits
git commit -m "feat: add amazing feature"

# Push and create PR
git push origin feature/amazing-feature
```

## 🚀 Roadmap

### Coming Soon
- [ ] **Privacy-First Telemetry** - Anonymous usage analytics and automatic feedback gathering to improve the tool

## 📚 Documentation

- [Production Deployment Guide](docs/PRODUCTION-GUIDE.md)
- [API Reference](docs/api/)
- [Architecture Overview](docs/architecture/system-design.md)
- [Troubleshooting](docs/troubleshooting/)

## 📄 License

MIT © TranslatorSync Contributors

## 🙏 Acknowledgments

- Built with [Bun](https://bun.sh) - Fast JavaScript runtime
- Powered by [OpenAI](https://openai.com), [DeepSeek](https://deepseek.com), [Groq](https://groq.com)
- Inspired by the i18n community

---

**Made with ❤️ for the internationalization community**

[⭐ Star us on GitHub](https://github.com/erik-balfe/translator-sync) • [📦 npm](https://npmjs.com/package/@tyr/translator-sync) • [📦 JSR](https://jsr.io/@tyr/translator-sync) • [🐛 Report Issues](https://github.com/erik-balfe/translator-sync/issues)
