# Unreleased Changes

> **Next Version**: v0.2.8 (tentative)
> 
> **CRITICAL**: After completing ANY change, add it to the appropriate section below immediately!

## 🎯 Highlights

- 

## ✨ New Features

- 

## 🐛 Bug Fixes

- Fix release workflow using template UNRELEASED.md instead of actual changes
- Create proper release notes for v0.2.7 retroactively
- Fix manual release workflow missing JSR publishing step

## 🔧 Improvements

- Improve release workflow to detect and warn when UNRELEASED.md contains only template content
- Add JSR publishing to manual release workflow with OIDC authentication
- Update deno.json version to match current package.json version (0.2.7)
- Improve release workflow to detect and warn when UNRELEASED.md contains only template content
- Add JSR publishing to manual release workflow with OIDC authentication
- Update deno.json version to match current package.json version (0.2.7)
- Add explicit return type to enhancedTranslator.refineDescription for JSR compatibility

## 🏗️ Development

- Improve UNRELEASED.md template with clearer instructions and examples
- Improve UNRELEASED.md template with clearer instructions and examples
- Add JSR TypeScript validation to CI pipeline to catch publishing issues early
- Add JSR compatibility check to manual release workflow pre-checks
- Add local JSR validation script: `bun run jsr-check`

## 📚 Documentation

- Add detailed instructions for maintaining release changelog in UNRELEASED.md

## 🔐 Security

- 

## 💔 Breaking Changes

- None

## 📦 Dependencies

- 

## 🙏 Contributors

- 

---

**Instructions for Developers (including Claude)**:
1. **IMMEDIATELY** after completing any change, add it to the appropriate section above
2. Use present tense: "Add feature" not "Added feature"  
3. Be specific: "Fix Windows path handling in fileManager" not "Fix bug"
4. When ready for release, this content will become the release notes
5. After release, this file gets reset for the next cycle

**Example good entries**:
- Add YAML translation file support with comprehensive error handling
- Fix memory leak in translation caching system
- Update README with new provider configuration examples
- Add integration tests for DeepSeek API provider