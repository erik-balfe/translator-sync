# Release Notes System

This directory contains organized release notes for TranslatorSync, structured by version for easy maintenance and automation.

## Structure

```
docs/releases/
├── README.md                 # This file
├── templates/               # Release note templates
├── v0.2.0.md               # Release notes for v0.2.0
├── v0.3.0.md               # Release notes for v0.3.0 (when ready)
└── UNRELEASED.md           # Accumulating changes for next release
```

## Workflow

1. **During Development**: Add changes to `UNRELEASED.md`
2. **Before Release**: Copy content from `UNRELEASED.md` to `vX.Y.Z.md`
3. **Create Release**: Use the version-specific file for GitHub releases
4. **Reset**: Clear `UNRELEASED.md` for next cycle

## Automation Options

### Option 1: Manual with Templates (Current)
- Use templates for consistent formatting
- Copy-paste from version files to GitHub releases
- Simple and reliable

### Option 2: GitHub Actions Automation
- Auto-generate releases from git tags
- Parse commit messages and group changes
- Requires conventional commit format

### Option 3: Changesets (Recommended)
- Popular tool for version management
- Adds changeset files during development
- Auto-generates changelogs and handles versioning

## Usage

### Adding a Change
Edit `UNRELEASED.md` to add your change in the appropriate category:

```markdown
## Bug Fixes
- Fix Windows-specific test failure in fileManager
- Fix formatting issues in fileManager test
```

### Creating a Release
1. Copy content from `UNRELEASED.md` to new `vX.Y.Z.md` file
2. Clear `UNRELEASED.md` 
3. Use version file content for GitHub release
4. Update package.json version
5. Commit and tag