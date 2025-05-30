# Release Guide

This guide explains how to release new versions of TranslatorSync to npm and JSR.

## Prerequisites

1. **GitHub Repository Setup**
   - Push your code to GitHub repository
   - Set up GitHub Actions secrets:
     - `NPM_TOKEN` - Your npm authentication token (required for npm publishing)

2. **JSR Setup**
   - JSR uses OIDC authentication - no token needed! ✅
   - The workflow automatically authenticates with JSR using GitHub OIDC

## CI/CD Workflow Overview

The automated release process uses GitHub Actions with 3 jobs that run when you push a version tag (v*.*.*):

1. **test-and-build**: Runs tests and builds the project
2. **publish-npm**: Publishes to npm registry (runs in parallel after tests pass)
3. **publish-jsr**: Publishes to JSR registry (runs in parallel after tests pass)

## Release Process

### 1. Update Version

```bash
# Update version in package.json and deno.json
# Example: 0.1.0 -> 0.2.0
# Make sure both files have the same version!
```

### 2. Commit Changes

```bash
jj describe -m "chore: release v0.2.0"
# Then push your changes to main branch
```

### 3. Create and Push Tag

```bash
# Create a version tag (must match pattern v*.*.*)
git tag v0.2.0

# Push the tag to trigger the release workflow
git push origin v0.2.0
```

### 4. Automated Publishing

Once you push the tag, GitHub Actions will automatically:

1. **Run tests** - Ensures all tests pass before publishing
2. **Build the project** - Creates the distribution files
3. **Publish to npm** - Publishes as `translator-sync` package
4. **Publish to JSR** - Publishes as `@tyr/translator-sync` package

Both publishing jobs run in parallel for faster releases!

## Manual Publishing (if needed)

### Publish to npm
```bash
bun run build
npm publish --access public
```

### Publish to JSR
```bash
npx jsr publish
```

## Version Numbering

Follow semantic versioning:
- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.1.0): New features
- **PATCH** (0.0.1): Bug fixes

## Release Checklist

- [ ] Update version in both `package.json` and `deno.json`
- [ ] Ensure `NPM_TOKEN` is set in GitHub Secrets
- [ ] Verify package.json has correct package name: `translator-sync`
- [ ] Verify deno.json has correct package name: `@tyr/translator-sync`
- [ ] Test build locally: `bun run build`
- [ ] Commit version changes
- [ ] Create and push version tag: `v*.*.*`
- [ ] Monitor GitHub Actions for successful deployment

## Workflow Configuration Details

### Environment and Permissions

- **npm publishing**: 
  - Uses `prod` environment
  - Requires `contents: read` permission
  - Uses `NPM_TOKEN` secret for authentication

- **JSR publishing**:
  - Requires `contents: read` and `id-token: write` permissions
  - Uses OIDC for automatic authentication (no token needed!)

### Job Dependencies

The workflow ensures quality by running tests first:
- `publish-npm` depends on `test-and-build`
- `publish-jsr` depends on `test-and-build`
- Both publishing jobs run in parallel after tests pass

## Package URLs

Once published, your package will be available at:
- **npm**: https://www.npmjs.com/package/translator-sync
- **JSR**: https://jsr.io/@tyr/translator-sync

## Troubleshooting

### NPM Publishing Fails
- Check that `NPM_TOKEN` is correctly set in GitHub Secrets
- Ensure the token has publish permissions
- Verify package name is not already taken

### JSR Publishing Fails
- JSR uses OIDC, so no token issues
- Check that your GitHub account is linked to JSR
- Verify the package scope (@tyr) is available

### Workflow Not Triggering
- Ensure tag follows pattern: `v*.*.*` (e.g., v1.0.0, v0.2.1)
- Check that tag is pushed to the correct repository
- Verify GitHub Actions are enabled for the repository