# Release Guide

This guide explains how to release new versions of TranslatorSync to npm and JSR.

## Prerequisites

1. **GitHub Repository Setup**
   - Push your code to GitHub repository
   - Set up GitHub Actions secrets:
     - `NMP_TOKEN` - Your npm authentication token (already in your .env)

2. **JSR Setup**
   - Your GitHub account is already linked to JSR ✅
   - The workflow will automatically publish to JSR

## Release Process

### 1. Update Version

```bash
# Update version in package.json and deno.json
# Example: 0.1.0 -> 0.2.0
```

### 2. Commit Changes

```bash
jj describe -m "chore: release v0.2.0"
```

### 3. Create and Push Tag

```bash
# Create a version tag
git tag v0.2.0

# Push the tag to trigger the release workflow
git push origin v0.2.0
```

### 4. Automated Publishing

Once you push the tag, GitHub Actions will:
1. Run tests
2. Build the project
3. Publish to npm as `@tyr/translator-sync`
4. Publish to JSR automatically

## Manual Publishing (if needed)

### Publish to npm
```bash
bun run build
npm publish --access public
```

### Publish to JSR
```bash
deno publish
```

## Version Numbering

Follow semantic versioning:
- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.1.0): New features
- **PATCH** (0.0.1): Bug fixes

## First Release Checklist

- [ ] Add `NMP_TOKEN` to GitHub Secrets
- [ ] Verify package.json is correct
- [ ] Verify deno.json is correct
- [ ] Test build locally: `bun run build`
- [ ] Create first tag: `v0.1.0`
- [ ] Push tag to trigger release

## Package URLs

Once published, your package will be available at:
- **npm**: https://www.npmjs.com/package/@tyr/translator-sync
- **JSR**: https://jsr.io/@tyr/translator-sync