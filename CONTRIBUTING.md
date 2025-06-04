# Contributing to TranslatorSync

Welcome to TranslatorSync! We're excited to have you contribute to making i18n automation better for everyone. 🌍

## 🚀 Quick Start

### First-Time Setup
```bash
# 1. Fork the repo on GitHub, then clone your fork
jj git clone https://github.com/YOUR-USERNAME/translator-sync.git
cd translator-sync

# 2. Install dependencies
bun install

# 3. Run tests to verify setup
bun test

# 4. You're ready to contribute!
```

### Development Workflow
We use **Jujutsu (jj)** for version control with a changelist-based workflow:

```bash
# Start a new feature
jj new master -m "feat: add yaml translation support"

# Make your changes, then describe them
jj describe -m "feat: add YAML format support

- Add yamlParser utility with error handling
- Integrate with universalParser  
- Add comprehensive tests
- Update CLI to support .yaml/.yml extensions"

# Create bookmark and push for PR
jj bookmark create feat-yaml-support -r @
jj git push --bookmark feat-yaml-support --allow-new
```

**New to Jujutsu?** See our [complete workflow guide](docs/development/contributing-workflow.md) with step-by-step examples.

## 📋 Development Standards

### Code Quality Requirements
- **Tests required**: Every feature needs comprehensive tests
- **Code coverage**: Maintain our 92%+ coverage standard
- **Type safety**: Strict TypeScript, no `any` types
- **Documentation**: Update relevant docs with your changes

### Pre-commit Checklist
```bash
bun run check        # Format and lint code
bun test            # Run all tests  
bun run type-check  # TypeScript validation
bun run security-check  # Scan for API keys
```

## 🔐 Security First

**CRITICAL**: Read [Security Guidelines](docs/SECURITY-API-KEYS.md) before contributing.

- Never commit real API keys
- Use placeholders in examples: `sk-XXXXXXXXXXXXXXXX`
- Run `bun run security-check` before every commit
- Set up the pre-commit hook: `cp scripts/pre-commit-hook.sh .git/hooks/pre-commit`

## 🎯 What to Contribute

### High-Impact Areas
- **New translation formats**: YAML, gettext (.po), XLIFF
- **Translation providers**: Anthropic Claude, Google Gemini, Azure
- **Framework integrations**: Better React/Vue/Angular support
- **Performance optimizations**: Faster parsing, smarter caching
- **Developer experience**: VS Code extension, better error messages

### Good First Issues
- Documentation improvements and examples
- Error message enhancements
- Test coverage for edge cases
- Bug fixes (check [issues](https://github.com/erik-balfe/translator-sync/issues))

## 📚 Project Documentation

Before contributing, familiarize yourself with our architecture and guidelines:

### Core Documentation
- **[System Architecture](docs/architecture/system-design.md)** - High-level project structure
- **[Data Flow](docs/architecture/data-flow.md)** - How translation data moves through the system
- **[Development Setup](docs/development/)** - Local development environment

### Technical Guides  
- **[Jujutsu Workflow](docs/development/jujutsu-workflow.md)** - Complete version control guide
- **[Testing Strategy](docs/development/)** - How we test and what coverage we expect
- **[Release Process](docs/RELEASE-AUTOMATION.md)** - How releases are created and published

### API & Configuration
- **[CLI Interface](docs/api/)** - Command-line usage and options
- **[Configuration](docs/api/)** - Config files and environment variables  
- **[Translation Services](docs/api/)** - LLM provider integration

### Quality Assurance
- **[Code Quality Review](docs/CODE-QUALITY-REVIEW.md)** - Standards and best practices
- **[Translation Quality](docs/TRANSLATION-QUALITY-REPORT.md)** - How we measure translation quality
- **[Competitive Analysis](docs/COMPETITIVE-ANALYSIS.md)** - How we compare to alternatives

## 🏗️ Architecture Overview

TranslatorSync follows a modular architecture:

```
src/
├── cli/              # Command-line interface
├── services/         # Translation providers and core logic
├── utils/            # File parsing, format detection, utilities
└── config/           # Configuration management

docs/
├── architecture/     # System design and decisions
├── development/      # Developer guides and workflows  
├── api/             # Usage documentation
└── releases/        # Release notes and changelog
```

**Key Principles:**
- **Interface-driven design**: All services implement clear interfaces
- **Single responsibility**: Each module has one clear purpose
- **Dependency injection**: Services are testable and swappable
- **Error handling**: Graceful degradation with helpful messages

## 🔄 Contribution Workflow

### 1. Planning Phase
- Check [existing issues](https://github.com/erik-balfe/translator-sync/issues) and [discussions](https://github.com/erik-balfe/translator-sync/discussions)
- For large features, create a discussion to gather feedback
- Review relevant documentation to understand the system

### 2. Development Phase  
- Create focused changes using Jujutsu changelists
- Follow our [development standards](docs/development/)
- Write tests alongside your code (TDD encouraged)
- Update documentation as you go

### 3. Review Phase
- Ensure all checks pass (`bun run check && bun test`)
- Create detailed PR description with examples
- Link to relevant issues or discussions
- Be responsive to feedback and iterate quickly

### 4. Merge & Follow-up
- Celebrate your contribution! 🎉
- Consider updating related documentation
- Monitor for any issues in the next release

## 🤝 Community Guidelines

### Communication
- **Be respectful and inclusive** - We welcome contributors from all backgrounds
- **Ask questions early** - Use discussions for design questions
- **Share context** - Help reviewers understand your changes
- **Be patient** - We aim to review PRs within 48 hours

### Code Reviews
- **Focus on code quality** - Suggest improvements, not just problems
- **Be specific** - Point to exact lines and suggest alternatives
- **Acknowledge good work** - Celebrate clever solutions and clean code
- **Learn together** - Code review is a learning opportunity for everyone

## 🆘 Getting Help

### Development Questions
- **Architecture/Design**: Use [GitHub Discussions](https://github.com/erik-balfe/translator-sync/discussions)
- **Bug Reports**: Create [GitHub Issues](https://github.com/erik-balfe/translator-sync/issues) with detailed reproduction steps
- **Jujutsu Help**: See our [workflow guide](docs/development/jujutsu-workflow.md) or [official docs](https://github.com/martinvonz/jj)

### Quick References
- **Commands**: `bun run` for all scripts, `jj help` for version control
- **Testing**: `bun test tests/unit/` for fast iteration
- **Debugging**: Set `LOG_LEVEL=debug` for verbose output

## 🎯 Recognition

We value every contribution! Contributors get:
- Recognition in release notes
- Listing in project contributors
- Maintainer status for sustained contributions
- Our eternal gratitude for making i18n better! 🙏

---

## 📞 Need Support?

- 💬 **Questions**: [GitHub Discussions](https://github.com/erik-balfe/translator-sync/discussions)
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/erik-balfe/translator-sync/issues)  
- 📖 **Documentation**: Browse the [docs/](docs/) folder
- 🔗 **Community**: Join our growing community of i18n automation enthusiasts

**Ready to contribute?** Start with `jj new master -m "your awesome feature"` and let's build something amazing together! 🚀