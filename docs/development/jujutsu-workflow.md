# Jujutsu (jj) Development Workflow

This document describes the version control workflow for TranslatorSync using Jujutsu (jj), our chosen VCS.

## 🔧 Why Jujutsu?

Jujutsu is a modern version control system that provides:

- **Better conflict resolution** - Automatic rebasing and intelligent merging
- **Changelist-based workflow** - Work on multiple features simultaneously
- **Git compatibility** - Seamlessly works with GitHub
- **Immutable history** - Safe experimentation without fear of losing work

## 📋 Prerequisites

1. Install Jujutsu: https://github.com/martinvonz/jj#installation
2. Clone the repository:
   ```bash
   jj git clone https://github.com/erik-balfe/translator-sync.git
   cd translator-sync
   ```

## 🚀 Basic Workflow

### 1. Starting Work on a New Feature

```bash
# Start from master branch
jj new master -m "feat: add yaml support"

# This creates a new change (changelist) on top of master
# You're now working in a new change, not directly on master
```

### 2. Making Changes

```bash
# Edit files as normal
vim src/utils/yamlParser.ts

# Check status
jj status

# Jujutsu automatically tracks all changes - no need to "add" files
```

### 3. Describing Your Change

```bash
# Set/update the description for current change
jj describe -m "feat: add YAML format support for translation files

- Add yamlParser utility
- Integrate with universalParser
- Add comprehensive tests"
```

### 4. Working with Multiple Changes (Changelists)

```bash
# Create another change on top of current one
jj new -m "test: add yaml parser edge cases"

# Switch between changes
jj edit @-  # Go to previous change
jj edit @-- # Go two changes back

# View your change tree
jj log
```

### 5. Updating Your Branch

```bash
# Fetch latest changes from GitHub
jj git fetch

# Rebase your changes onto latest master
jj rebase -d master
```

### 6. Preparing for Pull Request

```bash
# Squash multiple changes into one (if needed)
jj squash --from @- --into @

# Create a branch (bookmark) for GitHub
jj branch create feat-yaml-support

# Push to GitHub
jj git push --branch feat-yaml-support
```

### 7. After PR is Merged

```bash
# Fetch the merged changes
jj git fetch

# Clean up your local branch
jj branch delete feat-yaml-support

# Start new work from updated master
jj new master -m "next feature"
```

## 🎯 Advanced Workflows

### Working on Multiple Features Simultaneously

```bash
# Create first feature
jj new master -m "feat: add json5 support"
# ... make changes ...

# Create second feature (also from master, not from json5 feature)
jj new master -m "fix: handle empty translation files"
# ... make changes ...

# View parallel changes
jj log --revisions 'master..'

# Push different features to different branches
jj branch create feat-json5 -r <change-id-1>
jj branch create fix-empty-files -r <change-id-2>
```

### Splitting a Large Change

```bash
# If you've made too many changes in one changelist
jj split

# This opens an interactive editor to select which changes
# go into the first commit and which stay for the second
```

### Combining Changes

```bash
# Squash current change into parent
jj squash

# Squash specific change into another
jj squash --from <source> --into <destination>
```

## 📝 Best Practices

### 1. Descriptive Change Messages

```bash
# Good
jj describe -m "feat: add support for nested JSON translation keys

- Parse nested objects recursively
- Maintain key paths for flat output
- Handle edge cases for empty objects"

# Bad
jj describe -m "update code"
```

### 2. Keep Changes Focused

- One feature/fix per change
- Use `jj split` if change gets too large
- Logical grouping makes review easier

### 3. Regular Rebasing

```bash
# Keep your changes up to date
jj git fetch
jj rebase -d master

# This prevents conflicts from accumulating
```

### 4. Branch Naming Convention

```bash
# Features
jj branch create feat-<description>

# Fixes
jj branch create fix-<description>

# Chores
jj branch create chore-<description>
```

## 🚫 Common Pitfalls

### 1. Don't Work Directly on Master

```bash
# ❌ Wrong
jj edit master
# Make changes directly

# ✅ Correct
jj new master -m "description"
# Make changes in new changelist
```

### 2. Don't Forget to Push Branches

```bash
# After creating branch, push it
jj branch create my-feature
jj git push --branch my-feature

# Without --branch, jj won't know what to push
```

### 3. Don't Panic About "Conflicts"

```bash
# Jujutsu handles conflicts gracefully
jj rebase -d master

# If conflicts occur, they're marked in files
# Fix them and continue working - jj tracks the resolution
```

## 🔄 Typical Development Session

```bash
# 1. Start your day
jj git fetch                    # Get latest changes

# 2. Create new feature
jj new master -m "feat: add translation caching"

# 3. Work on feature
# ... edit files ...
jj status                       # Check what changed
jj diff                        # Review changes

# 4. Update description with details
jj describe                    # Opens editor for full description

# 5. Create more changes if needed
jj new -m "test: add cache tests"
# ... add tests ...

# 6. Squash if appropriate
jj squash --from @- --into @-- # Combine test with feature

# 7. Push for review
jj branch create feat-caching
jj git push --branch feat-caching

# 8. Create PR on GitHub
# Go to https://github.com/erik-balfe/translator-sync/pulls
```

## 🆘 Troubleshooting

### "No current operation"

```bash
# This means you're not in a change
jj new master -m "new work"
```

### "Conflict in file"

```bash
# Open the file and look for conflict markers
# Fix the conflict and save
# Jujutsu automatically resolves when you save
```

### "Cannot push without branch"

```bash
# Create a branch first
jj branch create my-feature
jj git push --branch my-feature
```

### Undoing Mistakes

```bash
# Jujutsu keeps history of all operations
jj undo  # Undo last operation
jj op log  # See all operations
jj op restore <operation-id>  # Restore to specific point
```

## 📚 Resources

- [Jujutsu Documentation](https://github.com/martinvonz/jj/blob/main/docs/tutorial.md)
- [Jujutsu vs Git Comparison](https://github.com/martinvonz/jj/blob/main/docs/git-comparison.md)
- [TranslatorSync Contributing Guide](../../CONTRIBUTING.md)

## 💡 Tips

1. **Use `jj log` frequently** - Visualize your change tree
2. **Embrace changelists** - Work on multiple things without branches
3. **Don't fear rebasing** - Jujutsu makes it safe and easy
4. **Describe early and often** - Good descriptions help reviewers

Remember: Jujutsu is designed to make version control less painful. If something feels difficult, there's probably an easier way!
