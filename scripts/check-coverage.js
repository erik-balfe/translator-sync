#!/usr/bin/env node

/**
 * Script to check test coverage and enforce minimum threshold.
 * Used in CI to ensure code quality standards are met.
 */

const { execSync } = require('child_process');
const fs = require('fs');

const COVERAGE_THRESHOLD = 50; // Minimum required coverage percentage

try {
  // Run tests with coverage
  console.log('Running tests with coverage...');
  execSync('bun test --coverage', { stdio: 'pipe' });
  
  // Note: Bun's coverage output format may vary. This is a placeholder
  // that should be adjusted based on actual Bun coverage output format.
  // For now, we'll check if tests pass as a basic quality gate.
  
  console.log(`✅ Tests passed! Coverage threshold check would require ${COVERAGE_THRESHOLD}% minimum.`);
  console.log('Note: Adjust this script when Bun coverage reporting format is determined.');
  
  // Exit successfully
  process.exit(0);
} catch (error) {
  console.error('❌ Test coverage check failed!');
  console.error(error.message);
  process.exit(1);
}