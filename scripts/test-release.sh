#!/bin/bash

# Test Release Script
# Tests the deployment process without actually publishing

set -e

VERSION="0.2.10-test"
echo "🧪 Testing release process for version $VERSION"

echo ""
echo "=== 1. Pre-flight Checks ==="

# Check if we're on master
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "detached")
echo "Current branch: $CURRENT_BRANCH"

# Check working directory status
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  Working directory has uncommitted changes"
    git status --short
else
    echo "✅ Working directory is clean"
fi

echo ""
echo "=== 2. Version Updates ==="

# Update package.json version
echo "📦 Updating package.json to version $VERSION"
sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package.json

# Update deno.json version
echo "📦 Updating deno.json to version $VERSION"
sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" deno.json

echo "✅ Version numbers updated"

echo ""
echo "=== 3. Quality Checks ==="

# Security check
echo "🔍 Running security check..."
if bun run security-check; then
    echo "✅ Security check passed"
else
    echo "❌ Security check failed"
    exit 1
fi

# Type check
echo "🔍 Running type check..."
if bun run type-check; then
    echo "✅ Type check passed"
else
    echo "❌ Type check failed"
    exit 1
fi

# Linting
echo "🧹 Running linter..."
if bun run lint; then
    echo "✅ Linter passed"
else
    echo "❌ Linter failed"
    exit 1
fi

# JSR validation
echo "🔍 Validating JSR compatibility..."
if bun run jsr-check; then
    echo "✅ JSR validation passed"
else
    echo "❌ JSR validation failed"
    exit 1
fi

echo ""
echo "=== 4. Build Test ==="

echo "🏗️ Testing build..."
if bun run build; then
    echo "✅ Build successful"
else
    echo "❌ Build failed"
    exit 1
fi

echo ""
echo "=== 5. Tests ==="

echo "🧪 Running unit tests..."
if bun test tests/unit/; then
    echo "✅ All tests passed"
else
    echo "❌ Tests failed"
    exit 1
fi

echo ""
echo "=== 6. Package Checks ==="

# Check NPM registry for existing version
echo "🔍 Checking NPM registry for version conflicts..."
if npm view translator-sync@$VERSION version 2>/dev/null; then
    echo "⚠️  Version $VERSION already exists on NPM"
else
    echo "✅ Version $VERSION is available on NPM"
fi

# Check JSR registry for existing version
echo "🔍 Checking JSR registry for version conflicts..."
if npx jsr show @tyr/translator-sync@$VERSION 2>/dev/null | grep -q "$VERSION"; then
    echo "⚠️  Version $VERSION already exists on JSR"
else
    echo "✅ Version $VERSION is available on JSR"
fi

echo ""
echo "=== 7. Dry Run Tests ==="

# Test JSR dry run
echo "📦 Testing JSR dry run..."
if npx jsr publish --dry-run --allow-dirty; then
    echo "✅ JSR dry run successful"
else
    echo "❌ JSR dry run failed"
    exit 1
fi

echo ""
echo "=== 8. Cleanup ==="

# Restore original versions
echo "🔄 Restoring original versions..."
git checkout -- package.json deno.json 2>/dev/null || echo "Could not restore versions (not in git)"

echo ""
echo "🎉 All tests passed! Release process is ready."
echo ""
echo "To create an actual release:"
echo "1. Manual release: gh workflow run manual-release.yml -f version=0.2.10"
echo "2. Tag-based release: git tag v0.2.10 && git push origin v0.2.10"
echo ""
echo "To check status: gh run list"