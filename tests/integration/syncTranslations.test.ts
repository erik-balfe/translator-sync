#!/usr/bin/env bun
import { expect, test } from "bun:test";
import fs from "node:fs";
import path from "path";

// Determine the project root directory relative to this test file.
// When this file is at tests/integration/syncTranslations.test.ts, the project root is two directories up.
const projectRoot = new URL("../../", import.meta.url).pathname;
console.log("[TEST DEBUG]", new Date().toISOString(), "Project root directory:", projectRoot);

// The "fixtures" folder is assumed to be at the project root.
const fixturesRoot = path.join(projectRoot, "fixtures");
console.log("[TEST DEBUG]", new Date().toISOString(), "Fixtures root:", fixturesRoot);

// Use a dedicated ".temp" folder inside the project root for test runs.
const tempRoot = path.join(projectRoot, ".temp");
if (!fs.existsSync(tempRoot)) {
  fs.mkdirSync(tempRoot);
  console.log("[TEST DEBUG]", new Date().toISOString(), "Created .temp folder at:", tempRoot);
} else {
  console.log("[TEST DEBUG]", new Date().toISOString(), ".temp folder exists at:", tempRoot);
}

// Helper: Create or clear a fresh test folder in .temp for each test.
function createTestFolder(testName: string): string {
  const folder = path.join(tempRoot, testName);
  if (fs.existsSync(folder)) {
    fs.rmSync(folder, { recursive: true, force: true });
    console.log(
      "[TEST DEBUG]",
      new Date().toISOString(),
      `Cleared folder for test case '${testName}':`,
      folder,
    );
  }
  fs.mkdirSync(folder, { recursive: true });
  console.log(
    "[TEST DEBUG]",
    new Date().toISOString(),
    `Created folder for test case '${testName}':`,
    folder,
  );
  return folder;
}

// Helper: Copy a fixture subfolder to a destination folder.
function copyFixture(fixtureSubfolder: string, destFolder: string): void {
  const src = path.join(fixturesRoot, fixtureSubfolder);
  fs.cpSync(src, destFolder, { recursive: true });
  console.log(
    "[TEST DEBUG]",
    new Date().toISOString(),
    `Copied fixture '${fixtureSubfolder}' to ${destFolder}`,
  );
}

// Helper: Run the CLI script (our sync process) on a target folder.
// Our CLI entry point is at src/cli/index.ts in the project.
async function runSyncScript(
  targetFolder: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const cliScriptPath = path.join(projectRoot, "src", "cli", "index.ts");
  console.log("[TEST DEBUG]", new Date().toISOString(), "Using CLI script at:", cliScriptPath);

  const proc = Bun.spawn({
    cmd: ["bun", "run", cliScriptPath, targetFolder],
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdoutChunks: Uint8Array[] = [];
  const stderrChunks: Uint8Array[] = [];
  const stdoutReader = proc.stdout.getReader();
  const stderrReader = proc.stderr.getReader();

  async function readAll(reader: ReadableStreamDefaultReader<Uint8Array>, chunks: Uint8Array[]) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
  }
  await Promise.all([readAll(stdoutReader, stdoutChunks), readAll(stderrReader, stderrChunks)]);
  const decoder = new TextDecoder();
  const stdoutStr = decoder.decode(Uint8Array.from(stdoutChunks.flat()));
  const stderrStr = decoder.decode(Uint8Array.from(stderrChunks.flat()));
  const exitCode = await proc.exited;

  console.log("[TEST DEBUG]", new Date().toISOString(), "SYNC SCRIPT STDOUT:", stdoutStr);
  console.error("[TEST DEBUG]", new Date().toISOString(), "SYNC SCRIPT STDERR:", stderrStr);
  console.log("[TEST DEBUG]", new Date().toISOString(), "SYNC SCRIPT EXIT CODE:", exitCode);

  return { stdout: stdoutStr, stderr: stderrStr, exitCode };
}

/**********************************************************************
 * Test Cases
 **********************************************************************/

// Test Case 1: Valid Sync
// Fixture "valid" contains a complete en.ftl, an empty es.ftl, and a partial ru.ftl.
// The expected result is that non-English files are updated so for every key,
// the value equals "translated: " + english value.
import { parse } from "@fluent/syntax";
function extractKeyValues(content: string): Map<string, string> {
  const resource = parse(content, {});
  const result = new Map<string, string>();
  for (const entry of resource.body) {
    if (entry.type === "Message" && entry.id && entry.id.name) {
      let value = "";
      if (entry.value) {
        for (const element of entry.value.elements) {
          if (element.type === "TextElement") {
            value += element.value;
          }
        }
      }
      result.set(entry.id.name, value);
    }
  }
  return result;
}

test("Valid sync: updates translation files correctly", async () => {
  const testFolder = createTestFolder("valid-sync");
  copyFixture("valid", testFolder);
  const result = await runSyncScript(testFolder);
  expect(result.exitCode).toBe(0);

  // Read updated english file (should remain unchanged)
  const englishTestPath = path.join(testFolder, "en.ftl");
  const englishTestContent = fs.readFileSync(englishTestPath, "utf8");
  const englishMap = extractKeyValues(englishTestContent);

  // Read updated Spanish file.
  const esFilePath = path.join(testFolder, "es.ftl");
  const esContent = fs.readFileSync(esFilePath, "utf8");
  const spanishMap = extractKeyValues(esContent);

  // Check same number of keys between english and translated Spanish.
  expect(spanishMap.size).toBe(englishMap.size);

  // For each key, check that translated value equals "translated: " + english value.
  for (const [key, enValue] of englishMap.entries()) {
    const esValue = spanishMap.get(key);
    expect(esValue).toBe("translated: " + enValue);
    // For multiline values, verify the number of nonempty lines match.
    if (key === "real_multi_line") {
      const enLines = enValue.split("\n").filter((l) => l.trim().length > 0);
      const esLines = esValue!
        .replace(/^translated:\s*/, "")
        .split("\n")
        .filter((l) => l.trim().length > 0);
      expect(esLines.length).toBe(enLines.length);
    }
  }
  // Additionally, verify some expected substrings.
  expect(esContent).toContain("hello = translated: Hello my friends, how are you?");
  expect(esContent).toContain("greeting = translated: Hello friends!");
});

// Test Case 2: Missing en.ftl
// Fixture "missing-en" does not have an en.ftl file, so the CLI should exit with error.
test("Missing en.ftl: exits with error", async () => {
  const testFolder = createTestFolder("missing-en");
  copyFixture("missing-en", testFolder);
  const result = await runSyncScript(testFolder);
  expect(result.exitCode).not.toBe(0);
});

// Test Case 3: Malformed en.ftl
// Fixture "malformed" contains an invalid en.ftl,
// so the CLI should exit with error.
test("Malformed en.ftl: exits with error", async () => {
  const testFolder = createTestFolder("malformed");
  copyFixture("malformed", testFolder);
  const result = await runSyncScript(testFolder);
  expect(result.exitCode).not.toBe(0);
});

// Test Case 4: Extraneous keys
// Fixture "extraneous" contains extra keys in a non-English file that should be removed.
test("Extraneous keys: extra keys removed", async () => {
  const testFolder = createTestFolder("extraneous");
  copyFixture("extraneous", testFolder);
  const result = await runSyncScript(testFolder);
  expect(result.exitCode).toBe(0);

  const esFilePath = path.join(testFolder, "es.ftl");
  const esContent = fs.readFileSync(esFilePath, "utf8");
  expect(esContent).not.toContain("unused_key");
});

// Test Case 5: Non-FTL files
// Fixture "non-ftl" contains files with other extensions; these should remain unchanged.
test("Non-FTL files: ignored by sync", async () => {
  const testFolder = createTestFolder("non-ftl");
  copyFixture("non-ftl", testFolder);
  const result = await runSyncScript(testFolder);
  expect(result.exitCode).toBe(0);

  const allFiles = fs.readdirSync(testFolder);
  const nonFtlFiles = allFiles.filter((f) => !f.endsWith(".ftl"));
  expect(nonFtlFiles.length).toBeGreaterThan(0);

  const nonFtlFilePath = path.join(testFolder, nonFtlFiles[0]);
  const originalContent = fs.readFileSync(path.join(fixturesRoot, "non-ftl", nonFtlFiles[0]), "utf8");
  const currentContent = fs.readFileSync(nonFtlFilePath, "utf8");
  expect(currentContent).toBe(originalContent);
});

// Test Case 6: Empty directory
// Providing an empty folder should cause the CLI to exit with an error.
test("Empty directory: exits with error", async () => {
  const testFolder = createTestFolder("empty-dir");
  const result = await runSyncScript(testFolder);
  expect(result.exitCode).not.toBe(0);
});

console.log("[TEST DEBUG]", new Date().toISOString(), "All test cases completed.");
// Note: The .temp folder remains for manual inspection.
