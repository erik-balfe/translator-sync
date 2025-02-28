# TranslatorSync

TranslatorSync is a CLI tool to synchronize i18n translation files in Fluent (FTL) format. It ensures that non-primary language files match the primary file (default: en.ftl).

## Features

- Reads and writes FTL files with full support for FTL syntax (including variables).
- Syncs missing keys by using a translation service (currently a mock).
- Removes extra keys not in the primary file.
- Planned support for JSON translations.
- Planned single-command execution (e.g. "npx translator-sync").

## Installation & Usage

Requires [Bun](https://bun.sh) (v1.1.34 or later).

1. Install dependencies:
   ```bash
   bun install
   ```
2. Run the tool:
   ```bash
   bun run src/cli/index.ts <path_to_translation_directory>
   ```

## Configuration

The primary config is in [src/config.ts](src/config.ts). Currently available:

- mainLang: Primary language file (default "en").

Planned options:

- Translate only missing keys or all keys.
- Selection among translation services (e.g. OpenAI, OpenRouter).
- Option to support JSON translation files.

## Pipelines & Distribution

Planned features:

- Build a compiled binary using Bun.
- Setup build, test, and deploy pipelines (GitHub Actions).
- Publish the tool as an npm package and on jsdelivr.

For more details on pending tasks and development steps, see [CONTRIBUTING.md](../CONTRIBUTING.md).
