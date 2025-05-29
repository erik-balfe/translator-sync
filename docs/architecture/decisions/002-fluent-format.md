# ADR-002: Fluent (FTL) as Primary Translation Format

## Status
**Accepted** - 2025-01-XX

## Context
TranslatorSync needs to support internationalization file formats. We evaluated several options for the primary format to support:

1. **JSON** - Simple key-value format
2. **YAML** - Hierarchical, human-readable format  
3. **Gettext (.po)** - Traditional GNU localization format
4. **Fluent (.ftl)** - Mozilla's localization format
5. **Properties** - Java-style properties files

## Decision
We chose **Fluent (FTL)** as the primary translation format for TranslatorSync.

## Rationale

### Technical Advantages
- **Rich feature set**: Supports pluralization, gender, and complex grammar rules
- **Multiline support**: Natural handling of long text blocks
- **Variables and functions**: Dynamic content with formatting
- **Comments and metadata**: Self-documenting translations
- **Formal syntax**: Well-defined grammar with robust parsing

### Ecosystem Benefits
- **Mozilla backing**: Stable, well-maintained specification
- **Growing adoption**: Used by Firefox, Thunderbird, and other major projects
- **Excellent tooling**: `@fluent/syntax` provides robust parsing
- **Localization-first**: Designed specifically for translation workflows
- **Standards compliance**: Follows Unicode and internationalization best practices

### Developer Experience
- **Human readable**: Easy to read and edit manually
- **Version control friendly**: Git-friendly format with meaningful diffs
- **IDE support**: Syntax highlighting and validation available
- **Error handling**: Clear error messages for syntax issues

## Format Examples

### Simple Translations
```fluent
# Comments are supported
hello = Hello, World!
welcome-message = Welcome to our application
```

### Advanced Features
```fluent
# Pluralization
emails = { $count ->
    [0] No emails
    [1] One email
   *[other] { $count } emails
}

# Variables with formatting
welcome-user = Welcome back, { $username }!

# Multiline messages
long-description = 
    This is a long description that spans
    multiple lines and maintains proper
    formatting for readability.
```

## Alternatives Considered

### JSON Format
**Pros**:
- Simple structure
- Universal support
- Easy parsing

**Cons**:
- No multiline support without escaping
- No pluralization features
- No comments allowed
- Not localization-specific

### YAML Format
**Pros**:
- Hierarchical structure
- Human readable
- Comments supported

**Cons**:
- Complex parsing rules
- Indentation sensitivity
- No localization-specific features
- Potential security issues

### Gettext (.po)
**Pros**:
- Mature and widely used
- Good tool support
- Proven in production

**Cons**:
- Complex header format
- Binary compilation step (.mo files)
- Less human-readable
- Dated syntax

## Consequences

### Positive
- **Rich localization features**: Support for complex language requirements
- **Future-proof**: Modern format designed for current i18n needs
- **Quality tooling**: Excellent parsing and validation libraries
- **Maintainable**: Clear syntax encourages good organization
- **Professional**: Used by major open-source projects

### Negative
- **Learning curve**: Developers need to learn FTL syntax
- **Smaller ecosystem**: Fewer tools compared to JSON/gettext
- **Complexity**: More complex than simple key-value formats
- **Tool support**: Some translation tools may not support FTL

### Mitigation Strategies
- **Documentation**: Comprehensive FTL usage guides
- **Validation**: Strong syntax validation and error reporting
- **Migration tools**: Converters from/to other formats
- **Training**: Team education on FTL best practices

## Implementation Details

### Parser Integration
```typescript
import { parse, serialize } from '@fluent/syntax';

// Parse FTL content
const ast = parse(ftlContent);

// Extract messages
const messages = new Map();
for (const entry of ast.body) {
  if (entry.type === 'Message') {
    messages.set(entry.id.name, entry.value);
  }
}
```

### Error Handling
```typescript
// Handle parsing errors gracefully
const parseResult = parse(ftlContent);
if (parseResult.errors.length > 0) {
  console.error('FTL syntax errors:', parseResult.errors);
  // Continue with partial parsing or fail gracefully
}
```

## Future Considerations

### Multi-Format Support
While FTL is our primary format, we plan to support other formats:
- **Phase 2**: JSON and YAML support
- **Phase 3**: Gettext (.po) support
- **Phase 4**: Custom format plugins

### Format Detection
```typescript
// Auto-detect format based on file extension and content
const format = detectFormat(filePath, content);
const parser = getParser(format);
```

### Migration Tools
```typescript
// Convert between formats
await convertFormat(inputFile, 'json', 'ftl', outputFile);
```

## Performance Considerations

### Parsing Performance
- FTL parsing is efficient with `@fluent/syntax`
- Streaming parser available for large files
- AST caching for frequently accessed files

### Memory Usage
- FTL format is more verbose than JSON
- Higher memory usage for large translation files
- Mitigation through streaming and chunked processing

## Quality Assurance

### Validation Rules
- Syntax validation using `@fluent/syntax`
- Variable consistency checking
- Pluralization rule validation
- Character encoding verification

### Testing Strategy
- Parse/serialize round-trip testing
- Edge case handling (Unicode, special characters)
- Performance testing with large files
- Compatibility testing with Mozilla tools

## Review Criteria
This decision should be reviewed when:
- Community adoption of alternative formats significantly increases
- Performance issues with FTL become blocking
- Translation workflow requirements change significantly
- Major changes to the FTL specification occur

## Related Decisions
- [ADR-001: Choose Bun Runtime](001-choose-bun.md) - Runtime for FTL parsing
- [ADR-003: LLM Translation Service](003-llm-translation.md) - Translation output format

## References
- [Fluent Project Homepage](https://projectfluent.org/)
- [Fluent Syntax Guide](https://projectfluent.org/fluent/guide/)
- [@fluent/syntax Documentation](https://github.com/projectfluent/fluent.js/tree/master/fluent-syntax)
- [Mozilla L10n Documentation](https://mozilla-l10n.github.io/localizer-documentation/tools/fluent/)