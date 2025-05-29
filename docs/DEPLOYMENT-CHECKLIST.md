# Production Deployment Checklist

This checklist ensures TranslatorSync is properly configured and secure for production use.

## Pre-Deployment

### 🔐 Security
- [ ] API keys are stored in environment variables, not in code
- [ ] `.translator-sync.json` is added to `.gitignore`
- [ ] No sensitive data in logs (use `LOG_LEVEL=info` or higher)
- [ ] Review all error messages for information leakage

### 🔧 Configuration
- [ ] Primary language is correctly set
- [ ] Translation provider is configured (not "mock")
- [ ] Appropriate model selected based on quality/cost needs
- [ ] Cost warning threshold set appropriately
- [ ] All translation directories are correctly configured

### 📁 Project Structure
- [ ] Translation files follow consistent naming convention
- [ ] Directory structure is clearly organized
- [ ] All language codes are standardized (ISO 639-1)

## Deployment Steps

### 1. Initial Setup
```bash
# Install globally or use npx
npm install -g translator-sync

# Run interactive setup
translator-sync init
```

### 2. Environment Configuration
```bash
# Production environment variables
export NODE_ENV=production
export TRANSLATOR_API_KEY=your-api-key
export LOG_LEVEL=info
```

### 3. Test Run
```bash
# Dry run first to verify configuration
translator-sync --dry-run

# Check specific directories
translator-sync ./locales --dry-run --verbose
```

### 4. Production Run
```bash
# Run with cost monitoring
translator-sync

# For CI/CD pipelines
TRANSLATOR_SERVICE=openai TRANSLATOR_API_KEY=$API_KEY translator-sync
```

## Monitoring

### 📊 Cost Tracking
- Monitor API usage after each run
- Set up alerts for costs exceeding threshold
- Review monthly usage trends

### 🚨 Error Monitoring
- Check logs for translation failures
- Monitor retry attempts
- Track rate limit errors

### 📈 Performance
- Monitor translation times
- Track number of keys translated
- Measure cache hit rates (if applicable)

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Sync Translations
on:
  push:
    paths:
      - 'locales/en/**'
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: oven-sh/setup-bun@v1
      
      - name: Install translator-sync
        run: npm install -g translator-sync
      
      - name: Sync translations
        env:
          TRANSLATOR_SERVICE: openai
          TRANSLATOR_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: translator-sync
      
      - name: Commit changes
        uses: stefanzweifel/git-auto-commit-action@v4
        with:
          commit_message: "chore: sync translations"
          file_pattern: locales/**/*.json
```

## Best Practices

### 🎯 Optimization
1. **Batch Processing**: Process all files in one run to minimize API calls
2. **Selective Sync**: Only sync changed files in CI/CD
3. **Cost Control**: Use cheaper models for development, better models for production

### 🔄 Workflow
1. **Development**: Use mock service or cheapest model
2. **Staging**: Test with production model but limited scope
3. **Production**: Full sync with appropriate model

### 📝 Documentation
1. Document your translation key naming conventions
2. Keep a glossary of domain-specific terms
3. Note any special translation requirements

## Troubleshooting

### Common Issues

#### API Key Not Working
```bash
# Verify environment variable
echo $TRANSLATOR_API_KEY

# Test with explicit service
TRANSLATOR_SERVICE=openai translator-sync --dry-run
```

#### High Costs
- Review model selection (use gpt-4o-mini for most cases)
- Check for unnecessary retranslations
- Consider implementing incremental updates

#### Translation Quality
- Add context to your keys (e.g., `button.save` vs just `save`)
- Use structured key names that provide context
- Consider using translation memory for consistency

## Security Checklist

- [ ] API keys rotated regularly
- [ ] Access logs reviewed
- [ ] No credentials in version control
- [ ] Production logs don't contain sensitive data
- [ ] Error messages are generic for users

## Final Verification

Before going live:
1. ✅ All tests pass
2. ✅ Dry run successful
3. ✅ Cost estimates acceptable
4. ✅ Backup of existing translations
5. ✅ Rollback plan in place

---

For support: https://github.com/your-org/translator-sync/issues