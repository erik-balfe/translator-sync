#!/usr/bin/env bun
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { isDirectory, listFiles, readFile, writeFile } from "../../../src/utils/fileManager";

describe("fileManager", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "filemanager-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("readFile", () => {
    test("reads existing file content", async () => {
      const filePath = path.join(tempDir, "test.txt");
      const content = "Hello, World!";

      await Bun.write(filePath, content);

      const result = await readFile(filePath);
      expect(result).toBe(content);
    });

    test("reads UTF-8 content correctly", async () => {
      const filePath = path.join(tempDir, "unicode.txt");
      const content = "Hello 世界 🌍 café naïve";

      await Bun.write(filePath, content);

      const result = await readFile(filePath);
      expect(result).toBe(content);
    });

    test("reads empty file", async () => {
      const filePath = path.join(tempDir, "empty.txt");

      await Bun.write(filePath, "");

      const result = await readFile(filePath);
      expect(result).toBe("");
    });

    test("reads multiline content", async () => {
      const filePath = path.join(tempDir, "multiline.txt");
      const content = `Line 1
Line 2
Line 3`;

      await Bun.write(filePath, content);

      const result = await readFile(filePath);
      expect(result).toBe(content);
    });

    test("throws error for non-existent file", async () => {
      const filePath = path.join(tempDir, "nonexistent.txt");

      expect(readFile(filePath)).rejects.toThrow();
    });

    test("reads large file without issues", async () => {
      const filePath = path.join(tempDir, "large.txt");
      const content = "A".repeat(100000); // 100KB of 'A's

      await Bun.write(filePath, content);

      const result = await readFile(filePath);
      expect(result).toBe(content);
      expect(result.length).toBe(100000);
    });
  });

  describe("writeFile", () => {
    test("writes content to new file", async () => {
      const filePath = path.join(tempDir, "new.txt");
      const content = "New file content";

      await writeFile(filePath, content);

      expect(fs.existsSync(filePath)).toBe(true);
      const readContent = await Bun.file(filePath).text();
      expect(readContent).toBe(content);
    });

    test("overwrites existing file", async () => {
      const filePath = path.join(tempDir, "existing.txt");
      const originalContent = "Original content";
      const newContent = "New content";

      await Bun.write(filePath, originalContent);
      await writeFile(filePath, newContent);

      const readContent = await Bun.file(filePath).text();
      expect(readContent).toBe(newContent);
    });

    test("writes UTF-8 content correctly", async () => {
      const filePath = path.join(tempDir, "unicode.txt");
      const content = "Unicode: 世界 🌍 café naïve résumé";

      await writeFile(filePath, content);

      const readContent = await Bun.file(filePath).text();
      expect(readContent).toBe(content);
    });

    test("writes empty content", async () => {
      const filePath = path.join(tempDir, "empty.txt");

      await writeFile(filePath, "");

      expect(fs.existsSync(filePath)).toBe(true);
      const readContent = await Bun.file(filePath).text();
      expect(readContent).toBe("");
    });

    test("writes multiline content", async () => {
      const filePath = path.join(tempDir, "multiline.txt");
      const content = `Line 1
Line 2
Line 3`;

      await writeFile(filePath, content);

      const readContent = await Bun.file(filePath).text();
      expect(readContent).toBe(content);
    });

    test("creates file in nested directory if parent exists", async () => {
      const subDir = path.join(tempDir, "subdir");
      fs.mkdirSync(subDir);
      const filePath = path.join(subDir, "nested.txt");
      const content = "Nested file content";

      await writeFile(filePath, content);

      expect(fs.existsSync(filePath)).toBe(true);
      const readContent = await Bun.file(filePath).text();
      expect(readContent).toBe(content);
    });

    test("creates parent directory if it doesn't exist", async () => {
      // Note: Bun.write automatically creates parent directories
      const filePath = path.join(tempDir, "newdir", "file.txt");
      const content = "content in new directory";

      await writeFile(filePath, content);

      expect(fs.existsSync(filePath)).toBe(true);
      const readContent = await Bun.file(filePath).text();
      expect(readContent).toBe(content);
    });
  });

  describe("listFiles", () => {
    test("lists files in directory", async () => {
      const file1 = path.join(tempDir, "file1.txt");
      const file2 = path.join(tempDir, "file2.txt");

      await Bun.write(file1, "content1");
      await Bun.write(file2, "content2");

      const files = await listFiles(tempDir);

      expect(files).toContain("file1.txt");
      expect(files).toContain("file2.txt");
      expect(files.length).toBe(2);
    });

    test("lists directories and files", async () => {
      const file = path.join(tempDir, "file.txt");
      const subDir = path.join(tempDir, "subdir");

      await Bun.write(file, "content");
      fs.mkdirSync(subDir);

      const items = await listFiles(tempDir);

      expect(items).toContain("file.txt");
      expect(items).toContain("subdir");
      expect(items.length).toBe(2);
    });

    test("returns empty array for empty directory", async () => {
      const files = await listFiles(tempDir);
      expect(files).toEqual([]);
    });

    test("throws error for non-existent directory", async () => {
      const nonExistentDir = path.join(tempDir, "nonexistent");

      expect(listFiles(nonExistentDir)).rejects.toThrow();
    });

    test("throws error when path is a file, not directory", async () => {
      const filePath = path.join(tempDir, "file.txt");
      await Bun.write(filePath, "content");

      expect(listFiles(filePath)).rejects.toThrow();
    });

    test("handles directory with many files", async () => {
      const fileCount = 100;

      for (let i = 0; i < fileCount; i++) {
        await Bun.write(path.join(tempDir, `file${i}.txt`), `content${i}`);
      }

      const files = await listFiles(tempDir);
      expect(files.length).toBe(fileCount);

      // Check a few specific files
      expect(files).toContain("file0.txt");
      expect(files).toContain("file50.txt");
      expect(files).toContain("file99.txt");
    });

    test("handles files with special characters", async () => {
      const specialFiles = [
        "file with spaces.txt",
        "file-with-dashes.txt",
        "file_with_underscores.txt",
        "file.with.dots.txt",
        "UPPERCASE.TXT",
      ];

      for (const filename of specialFiles) {
        await Bun.write(path.join(tempDir, filename), "content");
      }

      const files = await listFiles(tempDir);

      for (const filename of specialFiles) {
        expect(files).toContain(filename);
      }
    });
  });

  describe("isDirectory", () => {
    test("returns true for existing directory", () => {
      const result = isDirectory(tempDir);
      expect(result).toBe(true);
    });

    test("returns false for existing file", async () => {
      const filePath = path.join(tempDir, "file.txt");
      await Bun.write(filePath, "content");

      const result = isDirectory(filePath);
      expect(result).toBe(false);
    });

    test("returns false for non-existent path", () => {
      const nonExistentPath = path.join(tempDir, "nonexistent");

      const result = isDirectory(nonExistentPath);
      expect(result).toBe(false);
    });

    test("returns true for nested directory", () => {
      const subDir = path.join(tempDir, "subdir");
      fs.mkdirSync(subDir);

      const result = isDirectory(subDir);
      expect(result).toBe(true);
    });

    test("handles root directory", () => {
      // Test system root - should be true on Unix systems
      if (process.platform !== "win32") {
        const result = isDirectory("/");
        expect(result).toBe(true);
      }
    });

    test("handles relative paths", () => {
      // Create a subdirectory in temp and change to it
      const subDir = path.join(tempDir, "testdir");
      fs.mkdirSync(subDir);

      // Test that the parent directory ".." is recognized as a directory
      const originalCwd = process.cwd();
      process.chdir(subDir);

      try {
        const result = isDirectory("..");
        expect(result).toBe(true);
      } finally {
        // Always restore the original working directory
        process.chdir(originalCwd);
      }
    });

    test("handles symlinks to directories", () => {
      if (process.platform !== "win32") {
        const targetDir = path.join(tempDir, "target");
        const symlink = path.join(tempDir, "symlink");

        fs.mkdirSync(targetDir);
        fs.symlinkSync(targetDir, symlink);

        const result = isDirectory(symlink);
        expect(result).toBe(true);
      }
    });
  });

  describe("integration tests", () => {
    test("write and read operations work together", async () => {
      const filePath = path.join(tempDir, "integration.txt");
      const content = "Integration test content";

      await writeFile(filePath, content);
      const readContent = await readFile(filePath);

      expect(readContent).toBe(content);
    });

    test("listFiles shows written files", async () => {
      const fileName = "listed.txt";
      const filePath = path.join(tempDir, fileName);
      const content = "Listed file content";

      await writeFile(filePath, content);
      const files = await listFiles(tempDir);

      expect(files).toContain(fileName);
    });

    test("isDirectory works with listFiles results", async () => {
      const subDirName = "subdir";
      const fileName = "file.txt";
      const subDir = path.join(tempDir, subDirName);
      const filePath = path.join(tempDir, fileName);

      fs.mkdirSync(subDir);
      await Bun.write(filePath, "content");

      const items = await listFiles(tempDir);

      for (const item of items) {
        const itemPath = path.join(tempDir, item);
        if (item === subDirName) {
          expect(isDirectory(itemPath)).toBe(true);
        } else if (item === fileName) {
          expect(isDirectory(itemPath)).toBe(false);
        }
      }
    });
  });
});
