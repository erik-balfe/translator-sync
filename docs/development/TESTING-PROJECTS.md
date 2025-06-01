# Testing Projects Location

## Important Note

Test projects have been moved outside the main repository to prevent interference with version control.

### Current Location
```
../translator-test-projects/
├── chatbot-ui/       # React + Next.js + react-i18next test project
├── mastra/           # AI framework with complex i18n needs
└── open-webui/       # Another real-world test project
```

### Why Moved?
- Test projects are large (100MB+) and would bloat the repository
- They contain their own git history which conflicts with our repository
- Better separation of concerns - test data vs source code
- Already excluded in `.gitignore` anyway

### How to Test

1. **Clone test projects** (if needed):
```bash
cd ..
mkdir translator-test-projects
cd translator-test-projects
git clone https://github.com/mckaywrigley/chatbot-ui.git
```

2. **Run translator-sync** from test project:
```bash
cd chatbot-ui
bunx translator-sync init
bunx translator-sync
```

3. **Or test from main project**:
```bash
cd /path/to/translations
bunx translator-sync init
bunx translator-sync ../translator-test-projects/chatbot-ui/public/locales
```

### Test Results
All test results and reports from these projects are documented in:
- `docs/REAL-WORLD-TEST-RESULTS.md`
- `docs/CHATBOT-UI-TEST-SUCCESS.md`
- Various other test reports in `docs/`

### Development Testing
For development, you can:
1. Use the mock provider for quick tests
2. Test on small sample files in `fixtures/`
3. Use the full test projects when needed for real-world validation