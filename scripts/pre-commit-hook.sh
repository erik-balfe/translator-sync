#!/bin/bash
# Pre-commit hook to prevent accidental API key commits
# 
# To install:
# cp scripts/pre-commit-hook.sh .git/hooks/pre-commit
# chmod +x .git/hooks/pre-commit

echo "🔍 Running pre-commit security check..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check for API keys in staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|js|json)$' | grep -v node_modules | grep -v dist)

if [ -z "$STAGED_FILES" ]; then
    echo -e "${GREEN}✅ No JavaScript/TypeScript files to check${NC}"
    exit 0
fi

# Search for potential API keys
FOUND_KEYS=0
for FILE in $STAGED_FILES; do
    if grep -E '(sk-[a-zA-Z0-9]{32,}|api[_-]?key[[:space:]]*[:=][[:space:]]*[a-zA-Z0-9_-]{20,}|npm_[a-zA-Z0-9]{36}|glc_[a-zA-Z0-9]{50,})' "$FILE" 2>/dev/null; then
        echo -e "${RED}❌ Potential API key found in: $FILE${NC}"
        FOUND_KEYS=1
    fi
done

if [ $FOUND_KEYS -eq 1 ]; then
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}❌ COMMIT BLOCKED: Potential API keys detected!${NC}"
    echo -e "${YELLOW}Please remove all API keys and use environment variables.${NC}"
    echo -e "${YELLOW}See docs/SECURITY-API-KEYS.md for guidelines.${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    exit 1
fi

# Run the project's security check too
if command -v bun &> /dev/null; then
    bun run security-check
else
    echo -e "${YELLOW}⚠️  Bun not found, skipping full security check${NC}"
fi

echo -e "${GREEN}✅ Security check passed!${NC}"
exit 0