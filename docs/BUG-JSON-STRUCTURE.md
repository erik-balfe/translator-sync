# BUG: JSON Structure Preservation Issue

## Date Discovered: 2025-05-31

## Problem Description

The JSON parser incorrectly converts flat JSON structures to nested ones when keys contain dots (periods).

### Example:
**Input (English source):**
```json
{
  "Ask anything. Type \"/\" for prompts, \"@\" for files, and \"#\" for tools.": "Ask anything. Type \"/\" for prompts, \"@\" for files, and \"#\" for tools."
}
```

**Current Output (Wrong):**
```json
{
  "Ask anything": {
    " Type \"/\" for prompts, \"@\" for files, and \"#\" for tools": {
      "": "translated: Ask anything. Type \"/\" for prompts, \"@\" for files, and \"#\" for tools."
    }
  }
}
```

**Expected Output:**
```json
{
  "Ask anything. Type \"/\" for prompts, \"@\" for files, and \"#\" for tools.": "Pregunta lo que quieras. Escribe \"/\" para prompts, \"@\" para archivos y \"#\" para herramientas."
}
```

## Root Cause

In `src/utils/jsonParser.ts`, the `unflattenJson` function (line 45) splits keys by dots:
```typescript
const parts = key.split(".");
```

This assumes dots always indicate object nesting, but many i18n systems use flat JSON where dots are part of the key itself.

## Impact

- **Severity**: CRITICAL
- **Affected Users**: Anyone using flat JSON structure for translations
- **Projects Affected**: Most React i18next projects, Next.js i18n, and others

## Proposed Solution

### Option 1: Structure Detection (Recommended)
1. Analyze the source JSON to determine if it's flat or nested
2. Preserve the original structure when serializing translations
3. Add a configuration option to force flat/nested structure

### Option 2: Never Unflatten
1. Keep all JSON flat internally
2. Only serialize to nested if explicitly configured
3. Safer but less flexible

### Implementation Plan

1. **Add structure detection to JSON parser:**
   ```typescript
   function detectJsonStructure(obj: JsonTranslation): 'flat' | 'nested' {
     for (const value of Object.values(obj)) {
       if (typeof value === 'object' && value !== null) {
         return 'nested';
       }
     }
     return 'flat';
   }
   ```

2. **Store original structure metadata:**
   - Track whether source file was flat or nested
   - Apply same structure to target files

3. **Add configuration option:**
   ```json
   {
     "options": {
       "jsonStructure": "preserve" | "flat" | "nested"
     }
   }
   ```

4. **Update serializer logic:**
   - If structure is "flat", don't unflatten
   - If structure is "nested", use current logic
   - If structure is "preserve", match source file

## Test Cases Needed

1. Flat JSON with dots in keys
2. Nested JSON structures
3. Mixed structures (some flat, some nested)
4. Empty objects
5. Arrays in JSON (for future support)

## Timeline

- Priority: P0 (Critical)
- Estimated effort: 2-4 hours
- Should be fixed before any production use