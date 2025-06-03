# API Key Security Guidelines

## 🚨 CRITICAL: Preventing API Key Exposure

This document outlines mandatory rules to prevent API keys and sensitive data from being exposed in the repository.

## The Problem

API keys have been exposed in this repository's history through documentation files. Even though the keys were mentioned as "examples" or "things to fix," they were real keys that got committed to git history.

## Mandatory Rules

### 1. **NEVER Include Real API Keys in Any File**
- ❌ **WRONG**: Including actual API keys in documentation, even as "bad examples"
- ✅ **RIGHT**: Use placeholders like `sk-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`

### 2. **Environment Variables Only**
All API keys MUST be stored in:
- `.env` file (for local development)
- Environment variables (for production)
- NEVER in code, documentation, or config files

### 3. **Gitignore Verification**
Before starting work, verify these files are in `.gitignore`:
```
.env
.env.*
.env.local
.env.development
.env.production
```

### 4. **Pre-Commit Checks**

#### Manual Check Before Every Commit
Run this command to search for potential API keys:
```bash
# Search for common API key patterns
grep -r -E "(api[_-]?key|apikey|api_secret|secret[_-]?key|access[_-]?token|auth[_-]?token|credentials|password)\s*[:=]\s*['\"]?[a-zA-Z0-9_-]{20,}" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git --exclude="*.md" .

# Search for specific patterns
grep -r -E "sk-[a-zA-Z0-9]{32,}" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git .
grep -r -E "npm_[a-zA-Z0-9]{36}" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git .
```

#### Automated Security Scan
Add to your workflow:
```bash
# Run before committing
bun run security-check
```

### 5. **Documentation Guidelines**

When documenting security issues or API key handling:
- ✅ Use placeholder values: `OPENAI_API_KEY="sk-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"`
- ✅ Use generic examples: `API_KEY="your-api-key-here"`
- ✅ Reference environment variables: `process.env.OPENAI_API_KEY`
- ❌ NEVER paste actual API keys, even expired ones

### 6. **Code Review Checklist**

Before approving any PR:
1. Search for hardcoded strings longer than 20 characters
2. Check for new environment variables without `.env.example` updates
3. Verify no `.env` files are being committed
4. Look for base64 encoded strings (potential encoded secrets)

### 7. **If a Key is Exposed**

**Immediate Actions:**
1. **Revoke the key immediately** through the provider's dashboard
2. **Generate a new key**
3. **Update local .env file** with new key
4. **Do NOT attempt to remove from git history** in public repos (it's too late)
5. **Notify team members** who might be using the exposed key

### 8. **Safe Patterns for Code**

```typescript
// ✅ GOOD: Reference environment variables
const apiKey = process.env.DEEPSEEK_API_KEY;
if (!apiKey) {
  throw new Error("DEEPSEEK_API_KEY not configured");
}

// ❌ BAD: Hardcoded keys
const apiKey = "sk-117101243c2b4a83b2f8b2d81c674b04";

// ❌ BAD: Keys in comments
// TODO: Remove this key: sk-117101243c2b4a83b2f8b2d81c674b04

// ✅ GOOD: Example in comments
// Set DEEPSEEK_API_KEY="your-api-key-here" in .env file
```

### 9. **Testing with API Keys**

For tests that need API keys:
```typescript
// ✅ GOOD: Mock the API calls
const mockApiKey = "test-api-key-12345";

// ✅ GOOD: Use environment variable with fallback
const apiKey = process.env.TEST_API_KEY || "test-only-key";

// ❌ BAD: Real API key in tests
const apiKey = "sk-117101243c2b4a83b2f8b2d81c674b04";
```

### 10. **CI/CD Security**

- Store API keys as **GitHub Secrets** or equivalent
- Never echo or log API keys in CI logs
- Use masked variables when possible
- Rotate CI/CD keys regularly

## Automated Tools

### 1. **Git Hooks** (Optional but Recommended)
```bash
# .git/hooks/pre-commit
#!/bin/bash
# Prevent commits with potential API keys

# Check for common key patterns
if git diff --cached --name-only | xargs grep -E "sk-[a-zA-Z0-9]{32,}|api[_-]?key\s*[:=]\s*['\"]?[a-zA-Z0-9]{20,}" 2>/dev/null; then
  echo "❌ Potential API key detected! Please remove before committing."
  exit 1
fi
```

### 2. **GitHub Actions Security Scan**
Already implemented in `.github/workflows/ci.yml`:
```yaml
- name: Run security audit
  run: |
    if grep -r "TRANSLATOR_API_KEY\|api_key\|apiKey" --include="*.ts" --include="*.js" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=tests .; then
      echo "⚠️ Warning: Potential hardcoded API keys found"
    fi
```

## Examples of What NOT to Do

These are real examples of mistakes (with fake keys):

```markdown
❌ BAD: Including real keys in documentation
The system uses the DeepSeek API with key sk-117101243c2b4a83b2f8b2d81c674b04

✅ GOOD: Using placeholders
The system uses the DeepSeek API with key sk-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

```typescript
❌ BAD: Logging keys
console.log(`Using API key: ${apiKey}`);

✅ GOOD: Logging key presence
console.log(`API key configured: ${apiKey ? 'Yes' : 'No'}`);
```

## Summary

1. **Never commit real API keys** - not even in documentation
2. **Always use environment variables**
3. **Check before every commit**
4. **Use placeholders in examples**
5. **Revoke exposed keys immediately**

Remember: Once a key is in git history, it's compromised forever in public repositories!