# Quick Contributing Guide

Welcome! Contributing to TranslatorSync is easy with our Jujutsu (jj) workflow. Here's everything you need to know.

## 🚀 Quick Setup

```bash
# 1. Fork the repo on GitHub, then clone your fork
jj git clone https://github.com/YOUR-USERNAME/translator-sync.git
cd translator-sync

# 2. Install dependencies
bun install

# 3. Run tests to verify setup
bun test
```

## 🔄 Feature Development Workflow

### 1. Start a New Feature

```bash
# Always start from master branch
jj new master -m "feat: add yaml translation support"

# This creates a new changelist - you're now working on your feature
```

### 2. Work on Your Feature

```bash
# Make your changes
vim src/utils/yamlParser.ts

# Check what changed
jj status
jj diff

# Jujutsu automatically tracks all changes - no need to "stage" files
```

### 3. Update Your Change Description

```bash
# Add a detailed description of your work
jj describe -m "feat: add YAML format support for translation files

- Add yamlParser utility with comprehensive error handling
- Integrate with universalParser for automatic format detection  
- Add unit tests covering edge cases and malformed files
- Update CLI to support .yaml and .yml extensions

Closes #123"
```

### 4. Working on Multiple Features (Changelists)

TranslatorSync's superpower is working on multiple features simultaneously:

```bash
# While working on YAML support, start another feature
jj new master -m "fix: handle empty translation files gracefully"

# Switch between your changes
jj edit @-    # Go back to YAML feature
jj edit @     # Return to empty files fix

# View your work tree
jj log        # See all your changes
```

### 5. Keep Your Changes Updated

```bash
# Regularly sync with upstream changes
jj git fetch

# Rebase your changes onto latest master
jj rebase -d master

# Jujutsu handles conflicts gracefully
```

### 6. Preparing for Pull Request

```bash
# If you have multiple related changes, combine them
jj squash --from @- --into @

# Create a bookmark for GitHub PR
jj bookmark create feat-yaml-support -r @

# Push to your fork
jj git push --bookmark feat-yaml-support --allow-new
```

### 7. Create Pull Request

1. Go to GitHub and create PR from your bookmark
2. Include in your PR description:
   - What the feature does
   - Why it's needed
   - How to test it
   - Reference any issues it closes

### 8. After PR is Merged

```bash
# Fetch the merged changes
jj git fetch

# Start next feature (bookmarks auto-cleanup!)
jj new master -m "next amazing feature"
```

## 🎯 What Makes a Great Contribution

### Code Quality
- **Run checks before pushing**: `bun run check && bun test`
- **Follow existing patterns**: Look at similar code first
- **Add tests**: Every new feature needs tests
- **Update docs**: Keep documentation current

### Change Descriptions
```bash
# ✅ Good
jj describe -m "feat: add support for nested JSON translation keys

- Parse nested objects recursively in jsonParser
- Maintain full key paths for flat output structure
- Handle edge cases for empty objects and arrays
- Add comprehensive tests for all nesting scenarios

Performance: ~2x faster than previous flat key approach
Closes #45"

# ❌ Bad  
jj describe -m "update parser"
```

### Focus Your Changes
- **One feature per changelist**: Easy to review and test
- **Related changes together**: Group logical modifications
- **Small, focused PRs**: Easier to review and merge quickly

## 🛠️ Development Commands

```bash
# Code quality
bun run check           # Format and lint
bun run lint           # Lint only
bun run format         # Format only

# Testing
bun test               # All tests
bun test tests/unit/   # Unit tests only
bun run test:coverage  # Coverage report

# Building
bun run build          # Production build
bun run type-check     # TypeScript validation
```

## 🤝 Collaboration Tips

### Multiple Contributors on Same Feature
```bash
# Work on different aspects of the same feature
jj new master -m "feat: yaml support - parser"
# ... implement parser ...

jj new master -m "feat: yaml support - cli integration"  
# ... implement CLI parts ...

# Combine when ready for PR
jj squash --from <cli-change> --into <parser-change>
```

### Review & Iteration
```bash
# After PR feedback, update your change
jj describe  # Update description
# Make code changes
# Push updates (same bookmark automatically updates PR)
jj git push --bookmark feat-yaml-support
```

## 💡 Pro Tips

1. **Use `jj log` frequently** - Visualize your work
2. **Describe early and often** - Good descriptions help reviewers
3. **Test on real projects** - Try your changes on actual translation files
4. **Ask questions** - Use GitHub Discussions for design questions

## 🚫 Common Mistakes to Avoid

- **Don't work directly on master**: Always use `jj new master`
- **Don't forget to push bookmarks**: Use `--allow-new` for new bookmarks
- **Don't make huge changes**: Keep PRs focused and reviewable
- **Don't skip tests**: Every change needs appropriate tests

## 🆘 Need Help?

- **Jujutsu workflow**: See [detailed workflow guide](development/jujutsu-workflow.md)
- **Architecture**: Check [system design docs](architecture/system-design.md)
- **Questions**: Use [GitHub Discussions](https://github.com/erik-balfe/translator-sync/discussions)
- **Bugs**: Report via [GitHub Issues](https://github.com/erik-balfe/translator-sync/issues)

## 📚 What to Contribute

### High-Impact Areas
- **New format support**: YAML, gettext (.po), etc.
- **Translation providers**: Anthropic Claude, Google Gemini
- **Performance optimizations**: Faster parsing, better caching
- **Real-world testing**: Try on your projects, report issues

### Easy Wins
- **Documentation improvements**: Examples, clarifications
- **Error messages**: Make them more helpful
- **Test coverage**: Add tests for edge cases
- **Bug fixes**: Check the issues list

---

**Ready to contribute?** Start with `jj new master -m "your feature"` and dive in!

The TranslatorSync community appreciates every contribution, from typo fixes to major features. Let's make i18n easier for everyone! 🌍