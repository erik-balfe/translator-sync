# Release Automation Guide

This document explains the automated release system for TranslatorSync, providing multiple options to reduce manual work while maintaining high-quality release notes.

## 🎯 System Overview

The release system provides three levels of automation:

1. **Manual with Templates** (Current) - Structured but manual
2. **Script-Assisted** (Recommended) - Helper scripts with automation 
3. **Fully Automated** (Advanced) - GitHub Actions with minimal intervention

## 📁 File Structure

```
docs/releases/
├── README.md                 # Release system documentation
├── templates/               
│   └── release-template.md   # Template for consistent formatting
├── v0.2.0.md               # Release notes for specific versions
├── UNRELEASED.md           # Accumulating changes for next release
└── ...

.github/workflows/
└── release.yml             # GitHub Actions for automated releases

scripts/
└── release-helper.sh       # CLI tool for release management
```

## 🛠️ Option 1: Manual with Templates (Current)

**Best for**: Small teams, full control over release notes

### Process:
1. Edit `docs/releases/UNRELEASED.md` during development
2. Copy content to `docs/releases/vX.Y.Z.md` when ready
3. Use version file for GitHub release creation
4. Clear `UNRELEASED.md` for next cycle

### Pros:
- Complete control over messaging
- Simple and reliable
- No dependencies

### Cons:
- More manual work
- Can forget to update
- Potential inconsistency

## 🚀 Option 2: Script-Assisted (Recommended)

**Best for**: Most projects, good balance of automation and control

### Available Commands:

```bash
# NPM scripts (easier to remember)
bun run release:prepare 0.2.1    # Prepare new release
bun run release:finalize 0.2.1   # Create GitHub release
bun run release:add-change       # Add change interactively
bun run release:preview          # Preview unreleased changes

# Direct script usage
scripts/release-helper.sh prepare 0.2.1
scripts/release-helper.sh finalize 0.2.1
scripts/release-helper.sh add-change
scripts/release-helper.sh preview
```

### Workflow:

#### During Development:
```bash
# Add a bug fix
bun run release:add-change
# Select: 3) 🐛 Bug Fixes
# Enter: Fix Windows path handling issue

# Add a feature
bun run release:add-change  
# Select: 2) ✨ New Features
# Enter: Add support for YAML translation files
```

#### Preparing Release:
```bash
# Preview what will be released
bun run release:preview

# Prepare release (copies UNRELEASED to v0.2.1.md)
bun run release:prepare 0.2.1

# Edit release notes manually if needed
# Update package.json version to 0.2.1

# Create GitHub release
bun run release:finalize 0.2.1
```

### Features:
- ✅ Interactive change addition
- ✅ Automatic version file creation
- ✅ Pre-release validation (tests, security, lint)
- ✅ GitHub release creation
- ✅ Draft release for review
- ✅ UNRELEASED.md cleanup

## 🤖 Option 3: Fully Automated

**Best for**: Mature projects, CI/CD focused teams

### GitHub Actions Triggers:

#### Manual Workflow (Recommended for jj users):
This is the **easiest and safest method**, especially if you use jj:

1. **Merge PR to master** (via GitHub UI)
2. **Go to GitHub Actions** → "Manual Release" workflow
3. **Click "Run workflow"**
4. **Enter version** (e.g., 0.2.2)
5. **Click "Run workflow"** button

The workflow will:
- ✅ Verify you're releasing from master
- ✅ Run all quality checks
- ✅ Create git tag automatically
- ✅ Build and publish to NPM
- ✅ Create GitHub release
- ✅ Use your prepared release notes

#### Tag-based Release:
```bash
# IMPORTANT: Must be on master branch!
# 1. First merge your PR to master
# 2. Switch to master branch
jj edit master  # or: git checkout master && git pull

# 3. Update package.json version
jj commit -m "chore: bump version to 0.2.1"

# 4. Create and push tag FROM MASTER
git tag v0.2.1
git push origin v0.2.1

# GitHub Actions automatically:
# - Verifies release is from master branch
# - Runs all quality checks
# - Builds the project  
# - Creates GitHub release
# - Publishes to NPM
```

#### ⚠️ **Common Mistake to Avoid:**
**Never tag feature branches!** Always merge to master first, then tag master.

```bash
# ❌ WRONG: Tagging feature branch
git checkout feature-branch
git tag v0.2.1  # This will release from feature branch!

# ✅ CORRECT: Tag master branch
git checkout master
git pull origin master
git tag v0.2.1
```

#### Manual Trigger:
1. Go to GitHub Actions tab
2. Select "Release" workflow
3. Click "Run workflow"
4. Enter version number
5. GitHub handles the rest

### What Gets Automated:
- ✅ Security scanning
- ✅ Test execution
- ✅ Type checking
- ✅ Linting
- ✅ Building
- ✅ GitHub release creation
- ✅ NPM publishing
- ✅ Release notes (manual or auto-generated)

### Release Notes Sources:
1. **Manual**: Uses `docs/releases/vX.Y.Z.md` if exists
2. **Auto-generated**: Creates from commit messages if no manual notes

## 🔧 Configuration

### Required GitHub Secrets:
```
NPM_TOKEN        # For NPM publishing
```

### Package.json Scripts:
All scripts are available in `package.json`:
```json
{
  "scripts": {
    "release:prepare": "scripts/release-helper.sh prepare",
    "release:finalize": "scripts/release-helper.sh finalize", 
    "release:add-change": "scripts/release-helper.sh add-change",
    "release:preview": "scripts/release-helper.sh preview"
  }
}
```

## 📋 Release Checklist

### Pre-Release:
- [ ] All features/fixes added to `UNRELEASED.md`
- [ ] Security check passes: `bun run security-check`
- [ ] All tests pass: `bun test`
- [ ] Type check passes: `bun run type-check`
- [ ] Linting passes: `bun run lint`
- [ ] Version updated in `package.json`

### Release:
- [ ] Run `bun run release:prepare X.Y.Z`
- [ ] Review and edit `docs/releases/vX.Y.Z.md`
- [ ] Run `bun run release:finalize X.Y.Z` OR create git tag
- [ ] Verify GitHub release created
- [ ] Verify NPM package published

### Post-Release:
- [ ] Announce release (if needed)
- [ ] Update documentation (if needed)
- [ ] Plan next version features

## 🎨 Customizing Release Notes

### Categories Available:
- 🎯 **Highlights**: Major features or important changes
- ✨ **New Features**: New functionality added
- 🐛 **Bug Fixes**: Issues that were resolved
- 🔧 **Improvements**: Enhancements to existing features
- 🏗️ **Development**: Internal changes (CI, tooling, etc.)
- 📚 **Documentation**: Documentation updates
- 🔐 **Security**: Security-related changes
- 💔 **Breaking Changes**: Changes that break backward compatibility
- 📦 **Dependencies**: Dependency updates

### Writing Guidelines:
- Use present tense ("Add feature" not "Added feature")
- Be specific but concise
- Include context for breaking changes
- Mention contributor credits
- Link to relevant issues/PRs when helpful

## 🔄 Migration Between Options

### From Manual to Script-Assisted:
1. Ensure `UNRELEASED.md` exists with current changes
2. Start using `bun run release:add-change` for new changes
3. Use `bun run release:prepare/finalize` for releases

### From Script-Assisted to Fully Automated:
1. Ensure GitHub secrets are configured
2. Use tag-based releases instead of manual finalize
3. Optionally disable manual release creation

### From Automated back to Manual:
1. Disable the GitHub Actions workflow
2. Continue using version files manually
3. Create GitHub releases through UI

## 🤝 Best Practices

1. **Consistent Updates**: Add changes to `UNRELEASED.md` as you develop
2. **Meaningful Messages**: Write release notes for users, not developers
3. **Security First**: Always run security checks before releases
4. **Test Everything**: Verify all automation on non-production releases first
5. **Review Releases**: Use draft releases for final review
6. **Document Changes**: Keep this guide updated as the process evolves

## 🆘 Troubleshooting

### Common Issues:

**GitHub CLI not authenticated:**
```bash
gh auth login
```

**Release script not executable:**
```bash
chmod +x scripts/release-helper.sh
```

**NPM publish fails:**
- Check `NPM_TOKEN` secret is set
- Verify package name is available
- Ensure version is higher than published version

**GitHub Actions fails:**
- Check all required secrets are configured
- Verify workflow permissions
- Review action logs for specific errors

## 📞 Support

If you encounter issues with the release system:
1. Check this documentation first
2. Review GitHub Actions logs
3. Test scripts locally before pushing
4. Create an issue with specific error details