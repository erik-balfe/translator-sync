#!/usr/bin/env bun
import { expect, test } from "bun:test";
import fs from "fs";
import path from "path";

// Determine project/root directory from the location of this test file.
const projectRoot = new URL(".", import.meta.url).pathname;
console.log("[TEST DEBUG]", new Date().toISOString(), "Project root directory:", projectRoot);

// The folder "fixtures" should be a subfolder in your project (committed to VCS).
const fixturesRoot = path.join(projectRoot, "fixtures");
console.log("[TEST DEBUG]", new Date().toISOString(), "Fixtures root:", fixturesRoot);

// Use a dedicated .temp folder (inside project) for test runs.
const tempRoot = path.join(projectRoot, ".temp");
if (!fs.existsSync(tempRoot)) {
  fs.mkdirSync(tempRoot);
  console.log("[TEST DEBUG]", new Date().toISOString(), "Created .temp folder at:", tempRoot);
} else {
  console.log("[TEST DEBUG]", new Date().toISOString(), ".temp folder exists at:", tempRoot);
}

// Helper: Create (or clear) a fresh test folder under .temp for each test.
function createTestFolder(testName: string): string {
  const folder = path.join(tempRoot, testName);
  if (fs.existsSync(folder)) {
    fs.rmSync(folder, { recursive: true, force: true });
    console.log(
      "[TEST DEBUG]",
      new Date().toISOString(),
      `Cleared existing folder for test case '${testName}':`,
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

// Helper: Copy a fixtures subfolder into the test folder.
function copyFixture(fixtureSubfolder: string, destFolder: string): void {
  const src = path.join(fixturesRoot, fixtureSubfolder);
  fs.cpSync(src, destFolder, { recursive: true });
  console.log(
    "[TEST DEBUG]",
    new Date().toISOString(),
    `Copied fixture '${fixtureSubfolder}' to ${destFolder}`,
  );
}

// Helper: Run the syncTranslations.ts script on a given folder.
// It returns an object with stdout, stderr and exitCode.
async function runSyncScript(
  targetFolder: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  // Compute the absolute path to syncTranslations.ts.
  const scriptPath = new URL("./syncTranslations.ts", import.meta.url).pathname;
  console.log("[TEST DEBUG]", new Date().toISOString(), "Using syncTranslations.ts at:", scriptPath);

  // Spawn the process.
  const proc = Bun.spawn({
    cmd: ["bun", "run", scriptPath, "--dev", targetFolder],
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
 * Test Case 1: Valid Sync
 *   • Fixture folder "valid" should contain a correct en.ftl plus additional
 *     locale files (e.g. es.ftl, ru.ftl). The expected behavior is that the
 *     non-English files are updated with keys from en.ftl (missing keys get a
 *     "translated: ..." value, extra keys are removed).
 **********************************************************************/
test("Valid sync: updates translation files correctly", async () => {
  const testFolder = createTestFolder("valid-sync");
  copyFixture("valid", testFolder);
  const result = await runSyncScript(testFolder);
  expect(result.exitCode).toBe(0);

  // Check Spanish file.
  const esFilePath = path.join(testFolder, "es.ftl");
  const esContent = fs.readFileSync(esFilePath, "utf8");
  expect(esContent).toContain("hello = translated: Hello my friends, how are you?");
  expect(esContent).toContain("inquiry = translated: How are you doing?");
  // Verify extra keys are removed by asserting a key known to be extraneous is missing.
  expect(esContent).not.toContain("extra_key");

  // Check Russian file.
  const ruFilePath = path.join(testFolder, "ru.ftl");
  const ruContent = fs.readFileSync(ruFilePath, "utf8");
  expect(ruContent).toContain("hello = Привет, мои друзья, как вы поживаете?");
  expect(ruContent).toContain("inquiry = translated: How are you doing?");
});

/**********************************************************************
 * Test Case 2: Missing en.ftl
 *   • Fixture folder "missing-en" does not contain an en.ftl file.
 *   • The script is expected to log an error and exit with a non-zero code.
 **********************************************************************/
test("Missing en.ftl: exits with error", async () => {
  const testFolder = createTestFolder("missing-en");
  copyFixture("missing-en", testFolder);
  const result = await runSyncScript(testFolder);
  expect(result.exitCode).not.toBe(0);
});

/**********************************************************************
 * Test Case 3: Malformed FTL in en.ftl
 *   • Fixture folder "malformed" contains an en.ftl file with invalid FTL content.
 *   • The script should log a parse error and exit with a non-zero code.
 **********************************************************************/
test("Malformed en.ftl: exits with error", async () => {
  const testFolder = createTestFolder("malformed");
  copyFixture("malformed", testFolder);
  const result = await runSyncScript(testFolder);
  expect(result.exitCode).not.toBe(0);
});

/**********************************************************************
 * Test Case 4: Extra keys in translation file
 *   • Fixture folder "extraneous" has non-English files that include additional keys
 *     not present in en.ftl. Those extra keys should be removed from the updated file.
 **********************************************************************/
test("Extraneous keys: extra keys removed", async () => {
  const testFolder = createTestFolder("extraneous");
  copyFixture("extraneous", testFolder);
  const result = await runSyncScript(testFolder);
  expect(result.exitCode).toBe(0);

  const esFilePath = path.join(testFolder, "es.ftl");
  const esContent = fs.readFileSync(esFilePath, "utf8");
  // Extra key "unused_key" should not be present.
  expect(esContent).not.toContain("unused_key");
});

/**********************************************************************
 * Test Case 5: Non-FTL files present
 *   • Fixture folder "non-ftl" contains some files with other extensions.
 *   • The script should ignore non-FTL files and process only those ending with .ftl.
 **********************************************************************/
test("Non-FTL files: ignored by sync", async () => {
  const testFolder = createTestFolder("non-ftl");
  copyFixture("non-ftl", testFolder);
  const result = await runSyncScript(testFolder);
  expect(result.exitCode).toBe(0);

  // List files in testFolder. Verify that at least one non-ftl file exists,
  // and that it has not been modified (e.g. its content remains unchanged).
  const allFiles = fs.readdirSync(testFolder);
  const nonFtlFiles = allFiles.filter((f) => !f.endsWith(".ftl"));
  expect(nonFtlFiles.length).toBeGreaterThan(0);

  // For example, compare to expected content if you know what it should be.
  const nonFtlFilePath = path.join(testFolder, nonFtlFiles[0]);
  const originalContent = fs.readFileSync(path.join(fixturesRoot, "non-ftl", nonFtlFiles[0]), "utf8");
  const currentContent = fs.readFileSync(nonFtlFilePath, "utf8");
  expect(currentContent).toBe(originalContent);
});

/**********************************************************************
 * Test Case 6: Empty directory
 *   • Provide an empty folder to the script.
 *   • The script should log an error (or perform no action) and exit with a non-zero code.
 **********************************************************************/
test("Empty directory: exits with error", async () => {
  const testFolder = createTestFolder("empty-dir");
  // Create an empty folder; do not copy any fixtures.
  const result = await runSyncScript(testFolder);
  expect(result.exitCode).not.toBe(0);
});

console.log("[TEST DEBUG]", new Date().toISOString(), "All test cases completed.");
// Note: We do not remove the .temp folder so you can inspect the output.
