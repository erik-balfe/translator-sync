# Contributing & Roadmap

This document serves as the roadmap and guide for further development. Use it as a checklist to track progress and new ideas.

## Completed

- [x] Integration tests (using Bun's test runner).
- [x] Reading and writing FTL files with full FTL syntax support.
- [x] Primary configuration (mainLang).
- [x] Basic mock translation service.

## Tasks & Roadmap

### Translation Service Integration

- [ ] **Translation Service Implementation**

  - [ ] Create a new class (e.g. `LLMTranslationService`) implementing the `TranslationService` interface.
  - [ ] Add configuration for API keys, models, and options.
  - [ ] Implement support for requests to popular LLM providers.

    - Create a reference list of LLM models from various providers.

      - Include details such as:
        - **Model Name**
        - **Max Context Size**
        - **Pricing** (with input, output, and cache hit prices)
      - For example:
        ```js
        const llmModels = [
          {
            modelName: "OpenAI GPT-3.5",
            maxContextSize: 4096,
            pricing: {
              inputPrice: "$0.002 per token",
              outputPrice: "$0.003 per token",
              cacheHitPrice: "$0.001 per token",
            },
          },
          {
            modelName: "OpenAI GPT-4",
            maxContextSize: 8192,
            pricing: {
              inputPrice: "$0.03 per token",
              outputPrice: "$0.04 per token",
              cacheHitPrice: "$0.02 per token",
            },
          },
          {
            modelName: "Other Provider Model",
            maxContextSize: 2048,
            pricing: {
              inputPrice: "$0.001 per token",
              outputPrice: "$0.0015 per token",
              cacheHitPrice: "$0.0005 per token",
            },
          },
        ];
        ```

  - [ ] Track usage information from each API request (usage stats, cost, token count) and print it to the console.
  - [ ] Build fine-grained prompts that include:
    - The keys to translate.
    - Additional context (other available translation files, project-specific details).
    - An ordered format to ensure no keys are missing, extra, or shuffled.
  - [ ] Ensure the prompt handles edge cases:
    - When the provided text exceeds a model's max context size, batch or segment requests appropriately.
    - Handle scenarios where the model returns partial results, extra keys, or incorrect order.
  - [ ] Define robust fallback and error handling:
    - Validate API responses.
    - Prompt the user with clear error messages if key mismatches occur.
    - Retry or split the request if the context size is exceeded.

### File Format Support

- [ ] Add support for JSON translation files.
  - Option to auto-detect file type.
  - Use similar key-sync logic as for FTL.
  - Ensure compatibility with existing i18n setups.

### Configuration Enhancements

- [ ] Expand configuration options:
  - [ ] Option to translate only missing keys vs. all keys.
  - [ ] Define logging levels (minimal, verbose, debug).
  - [ ] Set custom file patterns or directories.
  - [ ] Select between different translation services via config (e.g. "mock", "openai", "openrouter").

### CLI & Packaging Enhancements

- [ ] Add advanced CLI flags:
  - [ ] `--dry-run`: simulate changes without writing files.
  - [ ] `--verbose`: enable detailed logging.
  - [ ] `--config <path>`: specify custom configuration paths.
- [ ] Enable single-command execution (e.g. via `npx translator-sync`).
- [ ] Compile the project into a standalone binary using Bun’s build features.

### Pipelines & Deployment

- [ ] Setup GitHub Actions for:
  - [ ] Build validation.
  - [ ] Running tests.
  - [ ] Deployment/publishing pipelines.
- [ ] Automate versioning and releases.
- [ ] Publish the package to npm and consider registry features on platforms like jsdelivr.

### Additional User-Focused Enhancements

- [ ] Ensure full FTL compliance:
  - [ ] Test with FTL features such as variables and placeholders.
  - [ ] Validate prompt translations with context-sensitive variables.
- [ ] Provide clear usage outputs for each translation run:
  - [ ] Print usage metrics from LLM providers (tokens, estimated costs).
- [ ] Maintain a detailed error log for troubleshooting translation failures.

## Advanced LLM Translation Service Development Guide

For implementing a real translation service using LLMs:

1. **Research and Model Selection:**
   - Compile a list of popular LLM models with their max context sizes and pricing.
   - Decide on default models for production (e.g. OpenAI GPT-3.5 or GPT-4).
2. **Service Integration:**
   - Build the API client with proper request batching if total text tokens exceed the chosen model’s max context size.
   - Design prompts that include additional context from other language files to improve translation accuracy.
   - Ensure the response parser checks that all required keys are present and in the proper order.
3. **Error Handling & Usage Stats:**
   - Log token usage and cost details from API responses.
   - Implement retries and graceful error messages if the LLM returns partial or invalid responses.
4. **Testing:**
   - Update integration tests to simulate realistic scenarios, including oversized translation requests.
   - Validate output consistency with preset expected outputs.
5. **Documentation:**
   - Document configuration options, prompt format, and known limitations.
   - Provide examples on how to switch between different translation providers using config.

Keep this document updated as new features are added.
