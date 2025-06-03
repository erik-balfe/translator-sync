# CI/CD Pipeline

## Overview

TranslatorSync uses GitHub Actions for continuous integration and deployment. The pipeline ensures code quality, test coverage, and reliable releases.

## Workflows

### 1. Continuous Integration (CI)

**File**: `.github/workflows/ci.yml`  
**Triggers**: Push to master/main, Pull requests

#### Jobs:

1. **Lint** - Code quality checks
   - Runs Biome linter
   - Checks code formatting
   - Ensures consistent code style

2. **Test** - Comprehensive testing
   - Runs on multiple OS (Ubuntu, macOS, Windows)
   - Unit tests: `bun test tests/unit/`
   - Integration tests: `bun test tests/integration/`
   - Coverage reporting with Codecov integration

3. **Test Coverage** - Quality gate
   - Enforces minimum 50% code coverage
   - Fails CI if threshold not met
   - Uploads reports to Codecov

4. **Build** - Compilation verification
   - Builds the project
   - Verifies output files exist
   - Ensures distributable package is valid

5. **Type Check** - TypeScript validation
   - Runs `tsc --noEmit`
   - Ensures type safety
   - Catches type errors before runtime

6. **Security Audit** - Vulnerability scanning
   - Checks for known vulnerabilities
   - Scans for hardcoded secrets
   - Uses npm audit

### 2. Publish Pipeline

**File**: `.github/workflows/publish.yml`  
**Triggers**: Git tags (v*.*.*)

#### Jobs:

1. **Test and Build** - Pre-publish validation
2. **Publish to npm** - Public package registry
3. **Publish to JSR** - Deno registry

## Local Development

### Running CI Checks Locally

```bash
# Run all checks
bun run ci

# Individual checks
bun run lint:check      # Lint without fixing
bun run format:check    # Format check without fixing
bun run test:unit       # Unit tests only
bun run test:integration # Integration tests only
bun run test:coverage   # Tests with coverage
bun run type-check      # TypeScript validation
```

### Pre-commit Checklist

Before pushing code:

1. ✅ Run `bun run check` (fixes lint/format issues)
2. ✅ Run `bun test` (all tests pass)
3. ✅ Run `bun run type-check` (no TypeScript errors)
4. ✅ Check test coverage meets threshold

## Coverage Requirements

- **Minimum threshold**: 50%
- **Target**: 70%+ for critical modules
- **Exclusions**: Test files, type definitions

### Coverage Report

```bash
# Generate coverage report
bun test --coverage

# View coverage in browser (if supported)
open coverage/index.html
```

## Best Practices

### Writing Testable Code

1. **Dependency Injection** - Pass dependencies as parameters
2. **Pure Functions** - Minimize side effects
3. **Small Functions** - Single responsibility principle
4. **Mock External Services** - Use test doubles for APIs

### Test Organization

```
tests/
├── unit/           # Fast, isolated tests
│   ├── services/   # Service layer tests
│   └── utils/      # Utility function tests
└── integration/    # End-to-end workflow tests
```

### CI Performance

- Tests run in parallel where possible
- Matrix builds test multiple environments
- Caching for dependencies (when available)

## Troubleshooting

### Common CI Failures

1. **Lint errors**
   ```bash
   # Fix locally
   bun run lint
   ```

2. **Format issues**
   ```bash
   # Fix locally
   bun run format
   ```

3. **Type errors**
   ```bash
   # Check locally
   bun run type-check
   ```

4. **Test failures**
   ```bash
   # Run specific test
   bun test path/to/test.ts
   ```

5. **Coverage below threshold**
   ```bash
   # Check coverage locally
   bun test --coverage
   # Add more tests for uncovered code
   ```

## Security

- API keys and secrets stored in GitHub Secrets
- No credentials in code or config files
- Security audit runs on every CI build
- Dependabot enabled for dependency updates

## Future Enhancements

- [ ] E2E tests with real translation APIs (gated by secrets)
- [ ] Performance benchmarks
- [ ] Bundle size tracking
- [ ] Automated changelog generation
- [ ] Release candidate builds