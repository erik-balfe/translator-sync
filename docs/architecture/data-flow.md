# Data Flow Architecture

## Overview
This document describes how data flows through TranslatorSync, from initial CLI input through final file output. Understanding these flows is crucial for debugging, optimization, and extending the system.

## Current Data Flow (MVP)

### 1. Initialization Flow
```mermaid
graph TD
    A[CLI Arguments] --> B[Argument Validation]
    B --> C[Directory Path Extraction]
    C --> D[Directory Existence Check]
    D --> E[File Discovery]
    E --> F[FTL File Filtering]
    F --> G[English Reference File Identification]
```

**Data Transformations:**
- `process.argv` → validated directory path
- Directory path → list of all files
- File list → filtered `.ftl` files
- FTL files → English reference + target files

### 2. Translation Processing Flow
```mermaid
graph TD
    A[English FTL File] --> B[Parse English Content]
    B --> C[Extract Key-Value Pairs]
    C --> D[Target Language Processing]
    
    D --> E[Parse Existing Target File]
    E --> F[Compare Key Sets]
    F --> G[Identify Missing Keys]
    F --> H[Identify Extra Keys]
    
    G --> I[Extract Source Texts]
    I --> J[Translation Service Call]
    J --> K[Receive Translations]
    K --> L[Merge with Existing]
    
    H --> M[Remove Extra Keys]
    L --> M
    M --> N[Serialize to FTL]
    N --> O[Write Target File]
```

**Data Types at Each Stage:**
```typescript
// Stage B: Parsed content
Map<string, string> // key → source text

// Stage F: Key comparison
{
  missing: string[],    // keys in EN but not in target
  extra: string[],      // keys in target but not in EN
  existing: string[]    // keys present in both
}

// Stage J: Translation request
{
  sourceLang: 'en',
  targetLang: string,
  texts: string[]       // array of source texts
}

// Stage K: Translation response
Map<string, string>     // source text → translated text
```

### 3. File I/O Flow
```mermaid
graph TD
    A[File Path] --> B[Bun.file API]
    B --> C[UTF-8 Decode]
    C --> D[FTL Parser]
    D --> E[AST Generation]
    E --> F[Message Extraction]
    F --> G[Key-Value Map]
    
    G --> H[Translation Processing]
    H --> I[Updated Map]
    I --> J[FTL Serialization]
    J --> K[UTF-8 Encode]
    K --> L[Bun.write API]
    L --> M[File System]
```

## Planned Data Flow (Production)

### 1. Enhanced Initialization
```mermaid
graph TD
    A[CLI Arguments] --> B[Command Parser]
    B --> C[Configuration Manager]
    C --> D[Environment Variables]
    C --> E[Config Files]
    C --> F[Default Settings]
    
    D --> G[Merged Configuration]
    E --> G
    F --> G
    
    G --> H[Service Provider Selection]
    G --> I[Performance Settings]
    G --> J[Logging Configuration]
```

### 2. Parallel Processing Flow
```mermaid
graph TD
    A[File Discovery] --> B[Dependency Analysis]
    B --> C[Processing Queue]
    C --> D[Worker Pool]
    
    D --> E[Worker 1: Language A]
    D --> F[Worker 2: Language B]
    D --> G[Worker N: Language N]
    
    E --> H[Translation Cache Check]
    F --> H
    G --> H
    
    H --> I[Cache Hit: Skip Translation]
    H --> J[Cache Miss: Request Translation]
    
    J --> K[Translation Service]
    K --> L[Response Validation]
    L --> M[Cache Update]
    M --> N[File Write]
    
    I --> N
```

### 3. Translation Service Flow
```mermaid
graph TD
    A[Translation Request] --> B[Service Router]
    B --> C[Primary Service]
    B --> D[Fallback Service]
    
    C --> E[Rate Limiter]
    E --> F[Request Validator]
    F --> G[API Call]
    G --> H[Response Parser]
    
    H --> I[Success?]
    I -->|Yes| J[Response Validation]
    I -->|No| K[Error Handler]
    
    K --> L[Retry Logic]
    L --> D
    
    J --> M[Cache Storage]
    M --> N[Return Translation]
```

## Error Flow Patterns

### 1. File System Errors
```mermaid
graph TD
    A[File Operation] --> B[Error Occurs]
    B --> C[Error Type Classification]
    
    C --> D[Permission Error]
    C --> E[Not Found Error]
    C --> F[Disk Space Error]
    C --> G[Network Error]
    
    D --> H[User Notification]
    E --> I[Graceful Skip]
    F --> J[Operation Halt]
    G --> K[Retry Logic]
    
    H --> L[Continue with Next File]
    I --> L
    K --> L
    J --> M[Exit with Error]
```

### 2. Translation Service Errors
```mermaid
graph TD
    A[Translation Request] --> B[Service Call]
    B --> C[Error Response]
    C --> D[Error Classification]
    
    D --> E[Rate Limit]
    D --> F[API Key Invalid]
    D --> G[Service Unavailable]
    D --> H[Invalid Request]
    
    E --> I[Exponential Backoff]
    F --> J[Configuration Error]
    G --> K[Fallback Service]
    H --> L[Request Validation]
    
    I --> M[Retry Original Service]
    K --> N[Try Alternative]
    J --> O[User Action Required]
    L --> O
```

## Data Validation Points

### 1. Input Validation
```typescript
// CLI argument validation
validateDirectory(path: string): ValidationResult
validateLanguageCode(lang: string): ValidationResult
validateConfiguration(config: Config): ValidationResult
```

### 2. Content Validation
```typescript
// FTL content validation
validateFTLSyntax(content: string): ParseResult
validateTranslationKeys(keys: string[]): ValidationResult
validateUnicodeContent(text: string): ValidationResult
```

### 3. Output Validation
```typescript
// Translation result validation
validateTranslationResponse(response: APIResponse): ValidationResult
validateFileIntegrity(originalPath: string, backupPath: string): boolean
validateKeyConsistency(source: Map, target: Map): ValidationResult
```

## Performance Optimization Points

### 1. Caching Strategy
```mermaid
graph TD
    A[Translation Request] --> B[Memory Cache Check]
    B -->|Hit| C[Return Cached Result]
    B -->|Miss| D[Persistent Cache Check]
    D -->|Hit| E[Load to Memory Cache]
    D -->|Miss| F[API Translation Request]
    
    E --> C
    F --> G[Store in Persistent Cache]
    G --> H[Store in Memory Cache]
    H --> C
```

### 2. Batching Optimization
```mermaid
graph TD
    A[Individual Translation Requests] --> B[Request Aggregator]
    B --> C[Batch Size Optimization]
    C --> D[Service-Specific Batching]
    
    D --> E[OpenAI Batch: 20 items]
    D --> F[DeepSeek Batch: 50 items]
    D --> G[Local Model: 100 items]
    
    E --> H[Single API Call]
    F --> H
    G --> H
    
    H --> I[Response Distribution]
    I --> J[Individual Responses]
```

## Memory Management

### 1. Large File Handling
```mermaid
graph TD
    A[Large FTL File] --> B[File Size Check]
    B -->|Small| C[Load Entirely]
    B -->|Large| D[Streaming Parser]
    
    D --> E[Chunk Reader]
    E --> F[Process Chunk]
    F --> G[Write Chunk]
    G --> H[Next Chunk?]
    H -->|Yes| E
    H -->|No| I[Complete]
    
    C --> J[In-Memory Processing]
    J --> K[Write Complete File]
```

### 2. Memory Usage Patterns
```typescript
// Memory usage at different stages
interface MemoryProfile {
  initialization: '10-20MB',    // Basic CLI setup
  fileDiscovery: '20-30MB',     // File system scanning
  parsing: '50-100MB',          // FTL parsing per file
  translation: '100-200MB',     // API responses buffering
  writing: '30-50MB',           // File writing operations
  cleanup: '10-20MB'            // Back to baseline
}
```

## Security Considerations

### 1. Data Sanitization Flow
```mermaid
graph TD
    A[User Input] --> B[Input Sanitization]
    B --> C[Path Validation]
    C --> D[Content Validation]
    D --> E[Output Sanitization]
    E --> F[Secure Storage]
```

### 2. API Key Flow
```mermaid
graph TD
    A[API Key Source] --> B[Environment Variable]
    A --> C[Config File]
    A --> D[CLI Argument]
    
    B --> E[In-Memory Storage]
    C --> F[Encrypted Storage]
    D --> G[Immediate Use]
    
    E --> H[Secure Transmission]
    F --> H
    G --> H
    
    H --> I[API Call]
    I --> J[Memory Cleanup]
```

## Monitoring and Observability

### 1. Metrics Collection Points
```typescript
interface MetricsCollectionPoints {
  fileProcessing: {
    filesDiscovered: number,
    filesProcessed: number,
    filesSkipped: number,
    processingTime: number
  },
  translation: {
    requestsSent: number,
    responsesReceived: number,
    cacheHits: number,
    cacheMisses: number,
    errorRate: number
  },
  performance: {
    memoryUsage: number,
    cpuUsage: number,
    diskIO: number,
    networkIO: number
  }
}
```

### 2. Logging Data Flow
```mermaid
graph TD
    A[Operation Events] --> B[Log Formatter]
    B --> C[Log Level Filter]
    C --> D[Structured Logger]
    
    D --> E[Console Output]
    D --> F[File Output]
    D --> G[Metrics Collector]
    
    G --> H[Performance Dashboard]
    G --> I[Error Tracking]
    G --> J[Usage Analytics]
```

## Future Flow Enhancements

### 1. Real-time Processing
```mermaid
graph TD
    A[File Watcher] --> B[Change Detection]
    B --> C[Incremental Processing]
    C --> D[Delta Translation]
    D --> E[Hot Reload]
```

### 2. Distributed Processing
```mermaid
graph TD
    A[Coordinator Node] --> B[Work Distribution]
    B --> C[Worker Node 1]
    B --> D[Worker Node 2]
    B --> E[Worker Node N]
    
    C --> F[Result Aggregation]
    D --> F
    E --> F
    
    F --> G[Final Assembly]
```

## Cross-References

- [System Design](system-design.md) - Architecture overview
- [CLI Interface](../api/cli-interface.md) - Input/output specifications
- [Translation Services](../api/translation-services.md) - Service integration details
- [Performance Guide](../troubleshooting/performance.md) - Optimization strategies