# translator-sync

Fills in the missing keys in your i18n files using any OpenAI-compatible model.
It translates only what is absent and never touches translations you already have.

[![npm](https://img.shields.io/npm/v/translator-sync.svg)](https://www.npmjs.com/package/translator-sync)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## What it does

Point it at a directory of locale files. It compares every target locale against
the primary language, finds keys that exist in one and not the other, and asks a
model for those alone. Existing translations are preserved verbatim, including
their formatting and key order.

- JSON (react-i18next, vue-i18n, next-intl) and Fluent `.ftl`
- Only missing keys are sent to the model, so cost scales with new strings, not with file size
- Plural forms: i18next `_one/_few/_many/_other` keys and ICU `{count, plural, ...}` are handled, and it warns when the target language needs categories your source never defined
- Variables, HTML tags and whitespace survive the round trip
- Any OpenAI-compatible endpoint: OpenAI, DeepSeek, Groq, Nebius, OpenRouter, Ollama, vLLM

## Install

```bash
npx translator-sync init      # interactive setup, writes .translator-sync.json
npx translator-sync           # sync every configured directory
npx translator-sync ./locales # or one directory
```

Requires Node 22 or newer. There is no Bun requirement and no runtime dependency.

## Configuration

`.translator-sync.json` in the project root:

```json
{
  "version": "1.0",
  "provider": "openai",
  "model": "gpt-4.1-nano",
  "primaryLanguage": "en",
  "directories": ["./locales"],
  "filePattern": "translation.json",
  "options": {
    "preserveFormatting": true,
    "costWarningThreshold": 1.0,
    "maxConcurrentRequests": 3
  }
}
```

### Points at a different endpoint

```json
{
  "provider": "openai",
  "baseURL": "https://api.tokenfactory.nebius.com/v1",
  "model": "deepseek-ai/DeepSeek-V3",
  "apiKey": "...",
  "timeout": 30000,
  "maxRetries": 3
}
```

`provider: "openai"` means "the OpenAI wire protocol", not "OpenAI the company".
Anyone speaking `/v1/chat/completions` works. The API key can also come from
`TRANSLATOR_API_KEY`.

### Options

| Key | Type | Meaning |
| --- | --- | --- |
| `provider` | `openai` \| `deepseek` \| `groq` \| `mock` | Wire protocol and defaults to use |
| `model` | string | Model id; defaults per provider |
| `baseURL` | string | Any OpenAI-compatible base URL |
| `timeout` | number | Per-request timeout in ms |
| `maxRetries` | number | Retries for 429 and 5xx only |
| `primaryLanguage` | string | The locale treated as the source of truth |
| `directories` | string[] | Where locale folders live |
| `filePattern` | string | File name to sync, e.g. `translation.json` |
| `options.preserveFormatting` | boolean | Keep indentation and spacing |
| `options.costWarningThreshold` | number | Warn above this USD amount per file |
| `options.enableTelemetry` | boolean | Keep local usage counters for `--verbose` |

## Layout it expects

```
locales/
  en/translation.json   <- primary
  ru/translation.json
  de/translation.json
```

## Plural forms

i18next keys:

```json
{
  "cart.items_one": "One item",
  "cart.items_other": "{{count}} items"
}
```

ICU values:

```json
{ "cart.items": "{count, plural, one {# item} other {# items}}" }
```

Languages do not share plural categories. English needs `one`/`other`; Russian
needs `one`/`few`/`many`/`other`; Arabic needs six. When the target language
requires a category the source does not define, the sync prints:

```
translation.json: ru needs plural categories few, many that the source does not define.
Add <key>_few, <key>_many to en and re-run, or review the generated forms by hand.
```

It does not invent the missing keys, because the English wording for "few" and
"many" is a decision only you can make.

## Exit codes

`0` — nothing to do, or everything synced. `1` — a file could not be read, the
model call failed, or the configuration is invalid.

## Compared to other tools

Several tools fill in i18n keys with a model: `i18n-ai-translate`, `ai-i18n`,
Lingo.dev, and `i18next-cli` with its Locize integration. They are all more
featured on the translation-memory and review side. This one is deliberately
small: one command, one config file, no service to sign up for, and no runtime
dependencies. If you need a translation memory or human review workflow, use one
of those instead.

## Development

Everything runs on Bun. The published package is built for Node.

```bash
bun install
bun run check      # tsc --noEmit, then bun test
bun run build      # dist/cli/translator-sync.js with a node shebang
bun pm pack        # inspect the tarball before publishing
bun run release:minor
```

Test layout:

- `tests/unit` — no network. The providers are exercised against a local `Bun.serve` stub, so 401, 429, timeouts and malformed bodies are deterministic.
- `tests/integration` — hits the real APIs and skips itself when no key is present.

Set `TRANSLATOR_TEST_BASE_URL` to run the integration suite against a local model.

## License

MIT
