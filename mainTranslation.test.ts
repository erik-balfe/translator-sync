#!/usr/bin/env bun
import { test, expect, afterAll } from "bun:test";
import fs from "fs";
import path from "path";
import os from "os";

// Determine the current directory of this test file.
const currentDir = new URL(".", import.meta.url).pathname;

// Define the path to the fixtures folder (which is under project root).
const fixturesDir = path.join(currentDir, "fixtures");

// Create a temporary directory for testing.
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ftl-test-"));

// Copy the fixtures folder to a temporary location named ".temp".
// fs.cpSync is available in Bun; we use { recursive: true }.
const tempFilesDir = path.join(tempDir, ".temp");
fs.cpSync(fixturesDir, tempFilesDir, { recursive: true });

// Now, tempFilesDir holds our test FTL files which we will use for syncing.
// (The fixtures folder is left untouched.)

test("syncTranslations script updates translation files from fixtures", async () => {
  // Use import.meta.url to compute the absolute path to syncTranslations.ts.
  const scriptPath = new URL("./syncTranslations.ts", import.meta.url).pathname;

  // Spawn the syncTranslations.ts script with the tempFilesDir as the target.
  const proc = Bun.spawn({
    cmd: ["bun", "run", scriptPath, "--dev", tempFilesDir],
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  // Collect stdout and stderr from the spawned process.
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

  // Log outputs for debugging.
  console.log("SYNC SCRIPT STDOUT:", stdoutStr);
  console.error("SYNC SCRIPT STDERR:", stderrStr);
  console.log("SYNC SCRIPT EXIT CODE:", exitCode);

  // Ensure the script exited successfully.
  expect(exitCode).toBe(0);

  // Now verify that each translated file in tempFilesDir has been updated.
  // We assume that in the fixtures, the complete English file is named "en.ftl".
  // And the other locales (e.g., "es.ftl", "ru.ftl") are also there.

  // Spanish file should get all keys with "translated: ..." values.
  const esFilePath = path.join(tempFilesDir, "es.ftl");
  const esContent = fs.readFileSync(esFilePath, "utf8");
  expect(esContent).toContain("hello = translated: Hello my friends, how are you?");
  expect(esContent).toContain("greeting = translated: Hello friends!");
  expect(esContent).toContain("farewell = translated: Goodbye and see you soon!");
  expect(esContent).toContain("inquiry = translated: How are you doing?");
  expect(esContent).toContain("statement = translated: Indeed, it is a great day.");
  expect(esContent).toContain("numeric = translated: 42");
  expect(esContent).toContain("path_example = translated: /usr/local/bin");
  expect(esContent).toContain("multi_line = translated: This is line one.\\nThis is line two.");
  expect(esContent).toContain("with_punctuation = translated: Testing, punctuation; and: symbols.");
  expect(esContent).toContain("emoji = translated: 😊");
  expect(esContent).toContain("complex_entry = translated: A mix of numbers 123, symbols #$% and words.");
  expect(esContent).toContain("real_multi_line = translated: This is start");

  // Russian file should retain its original keys and have missing ones added.
  const ruFilePath = path.join(tempFilesDir, "ru.ftl");
  const ruContent = fs.readFileSync(ruFilePath, "utf8");
  expect(ruContent).toContain("hello = Привет, мои друзья, как вы поживаете?");
  expect(ruContent).toContain("greeting = Привет, друзья!");
  expect(ruContent).toContain("farewell = До свидания и до скорой встречи!");
  expect(ruContent).toContain("statement = Действительно, прекрасный день.");
  expect(ruContent).toContain("numeric = 42");
  expect(ruContent).toContain("path_example = /usr/local/bin");
  expect(ruContent).toContain("with_punctuation = Тестирование, пунктуация; и: символы.");
  expect(ruContent).toContain("emoji = 😊");
  expect(ruContent).toContain("inquiry = translated: How are you doing?");
  expect(ruContent).toContain("multi_line = translated: This is line one.\\nThis is line two.");
  expect(ruContent).toContain("complex_entry = translated: A mix of numbers 123, symbols #$% and words.");
  expect(ruContent).toContain("real_multi_line = translated: This is start");
});

afterAll(() => {
  // Clean up: remove the temporary directory.
  fs.rmSync(tempDir, { recursive: true, force: true });
});
