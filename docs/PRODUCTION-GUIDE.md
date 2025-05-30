# Production Deployment Guide

This guide covers deploying TranslatorSync in production environments with best practices for security, performance, and reliability.

## Table of Contents
- [Requirements](#requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [Security](#security)
- [Performance Optimization](#performance-optimization)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## Requirements

- Node.js 18+ or Bun 1.0+
- API key for translation service (OpenAI, DeepSeek, or Groq)
- Write access to translation files
- Git (for version control of translations)

## Installation

### Global Installation
```bash
npm install -g translator-sync
# or
yarn global add translator-sync
# or
bun install -g translator-sync
```

### Project Installation
```bash
npm install --save-dev translator-sync
# Add to package.json scripts:
# "sync-translations": "translator-sync"
```

### Zero Installation (npx)
```bash
npx translator-sync init
npx translator-sync
```

## Configuration

### Initial Setup
```bash
translator-sync init
```

This creates `.translator-sync.json`:
```json
{
  "version": "1.0",
  "provider": "openai",
  "model": "gpt-4o-mini",
  "primaryLanguage": "en",
  "directories": ["./locales"],
  "options": {
    "preserveFormatting": true,
    "costWarningThreshold": 1.00,
    "maxConcurrentRequests": 3
  }
}
```

### Environment Variables

Create `.env` file (for local development):
```bash
TRANSLATOR_API_KEY=your-api-key-here
TRANSLATOR_SERVICE=openai
NODE_ENV=production
LOG_LEVEL=info
```

For production, set these in your environment:
```bash
export TRANSLATOR_API_KEY=$SECRET_API_KEY
export NODE_ENV=production
export LOG_LEVEL=info
```

## Security

### API Key Management

1. **Never commit API keys**
   ```bash
   # .gitignore
   .env
   .env.*
   .translator-sync.json
   ```

2. **Use environment variables in CI/CD**
   ```yaml
   # GitHub Actions
   env:
     TRANSLATOR_API_KEY: ${{ secrets.TRANSLATOR_API_KEY }}
   ```

3. **Rotate keys regularly**
   - Set up key rotation schedule
   - Use separate keys for dev/staging/production

### Access Control

1. **Limit file permissions**
   ```bash
   chmod 600 .env
   chmod 644 .translator-sync.json
   ```

2. **Use read-only tokens where possible**
   - For monitoring and reporting
   - In CI/CD environments

## Performance Optimization

### 1. Model Selection

| Use Case | Recommended Model | Cost/1M tokens | Speed |
|----------|------------------|----------------|--------|
| Development | gpt-4o-mini | $0.15/$0.60 | Fast |
| Production | gpt-4o-mini | $0.15/$0.60 | Fast |
| High Quality | gpt-4o | $2.50/$10 | Slower |
| Budget | deepseek-chat | $0.14/$0.28 | Fast |

### 2. Batch Optimization

Configure batch sizes based on model limits:
```json
{
  "options": {
    "maxConcurrentRequests": 3,
    "batchSize": 50
  }
}
```

### 3. Caching Strategy

TranslatorSync automatically caches by only translating missing keys. For additional caching:

```bash
# Use git to track changes
git add locales/
git commit -m "Baseline translations"

# Only sync when source changes
git diff --name-only locales/en/ && translator-sync
```

### 4. Incremental Updates

In CI/CD, only process changed files:
```bash
# Get changed English files
CHANGED=$(git diff --name-only HEAD~1 locales/en/)
if [ ! -z "$CHANGED" ]; then
  translator-sync
fi
```

## Monitoring

### Cost Tracking

1. **Built-in cost reporting**
   ```bash
   translator-sync
   # Output: Cost: $0.0234
   ```

2. **Set cost alerts**
   ```json
   {
     "options": {
       "costWarningThreshold": 5.00
     }
   }
   ```

3. **Monthly tracking script**
   ```bash
   #!/bin/bash
   # track-costs.sh
   translator-sync | grep "Cost:" >> monthly-costs.log
   ```

### Error Monitoring

1. **Enable detailed logging**
   ```bash
   LOG_LEVEL=debug translator-sync > sync.log 2>&1
   ```

2. **Parse logs for errors**
   ```bash
   grep -E "ERROR|WARN" sync.log
   ```

3. **Set up alerts**
   ```bash
   # Send email on failure
   translator-sync || mail -s "Translation sync failed" admin@company.com
   ```

### Performance Metrics

Track key metrics:
- Translation time per file
- Number of keys translated
- API response times
- Retry attempts

```bash
# Simple metrics collection
time translator-sync --verbose | tee metrics.log
grep "missing keys" metrics.log | wc -l
```

## CI/CD Integration

### GitHub Actions
```yaml
name: Sync Translations
on:
  push:
    branches: [master]
    paths:
      - 'locales/en/**'
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install TranslatorSync
        run: npm install -g translator-sync
      
      - name: Sync Translations
        env:
          TRANSLATOR_API_KEY: ${{ secrets.TRANSLATOR_API_KEY }}
          TRANSLATOR_SERVICE: openai
          LOG_LEVEL: info
        run: |
          translator-sync
          
      - name: Commit Changes
        run: |
          git config --local user.email "bot@company.com"
          git config --local user.name "Translation Bot"
          git add locales/
          git diff --staged --quiet || git commit -m "chore: sync translations [skip ci]"
          git push
```

### GitLab CI
```yaml
sync-translations:
  stage: deploy
  only:
    changes:
      - locales/en/**
  script:
    - npm install -g translator-sync
    - translator-sync
    - |
      if [ -n "$(git status --porcelain)" ]; then
        git add locales/
        git commit -m "chore: sync translations [skip ci]"
        git push origin HEAD:$CI_COMMIT_REF_NAME
      fi
  variables:
    TRANSLATOR_API_KEY: $TRANSLATOR_API_KEY
```

## Troubleshooting

### Common Issues

#### 1. Rate Limiting
**Symptoms**: 429 errors, "rate limit exceeded"

**Solutions**:
- Reduce `maxConcurrentRequests`
- Add delays between batches
- Use different API keys for parallel jobs

#### 2. Timeout Errors
**Symptoms**: Network timeouts, incomplete translations

**Solutions**:
```json
{
  "options": {
    "timeout": 60000,
    "maxRetries": 5
  }
}
```

#### 3. High Costs
**Symptoms**: Unexpected API charges

**Solutions**:
- Use cheaper models (gpt-4o-mini)
- Reduce batch sizes
- Implement change detection
- Cache translations

#### 4. Translation Quality Issues
**Symptoms**: Incorrect or inconsistent translations

**Solutions**:
- Use better models for production
- Provide context in key names
- Create glossary of terms
- Review translations regularly

### Debug Mode

Enable comprehensive debugging:
```bash
LOG_LEVEL=debug \
TRANSLATOR_SERVICE=openai \
TRANSLATOR_API_KEY=$KEY \
translator-sync --verbose --dry-run
```

### Health Checks

Create a health check script:
```bash
#!/bin/bash
# health-check.sh

# Check config exists
if [ ! -f ".translator-sync.json" ]; then
  echo "ERROR: No configuration file"
  exit 1
fi

# Check API key
if [ -z "$TRANSLATOR_API_KEY" ]; then
  echo "ERROR: No API key set"
  exit 1
fi

# Test dry run
translator-sync --dry-run || exit 1

echo "Health check passed"
```

## Best Practices

### 1. Version Control
- Commit translation files after each sync
- Use meaningful commit messages
- Tag releases with translation versions

### 2. Review Process
- Set up PR/MR for translation changes
- Have native speakers review
- Use staging environment for testing

### 3. Backup Strategy
- Backup translations before major syncs
- Keep history of all changes
- Have rollback procedure ready

### 4. Documentation
- Document custom translation rules
- Maintain glossary of terms
- Note any exceptions or special cases

## Support

- GitHub Issues: https://github.com/your-org/translator-sync/issues
- Documentation: https://github.com/your-org/translator-sync/docs
- Community Discord: https://discord.gg/translator-sync