#!/usr/bin/env bun
import fs from "node:fs";
import { readdir } from "node:fs/promises";

/**
 * Reads a file as text using Bun's optimized file API.
 * @param filePath The path to the file.
 * @returns Promise resolving to the file's text content.
 */
export async function readFile(filePath: string): Promise<string> {
  // Bun.file returns a BunFile that implements Blob.
  return await Bun.file(filePath).text();
}

/**
 * Writes data (a string) to a file using Bun.write.
 * @param filePath The path to the file.
 * @param data The string content to write.
 */
export async function writeFile(filePath: string, data: string): Promise<void> {
  await Bun.write(filePath, data);
}

/**
 * Lists all items in the given directory.
 * @param dirPath The directory path.
 * @returns Array of file and directory names.
 */
export async function listFiles(dirPath: string): Promise<string[]> {
  return await readdir(dirPath);
}

/**
 * Checks if the given path is a directory.
 * @param filePath The path to check.
 * @returns True if the path exists and is a directory.
 */
export function isDirectory(filePath: string): boolean {
  return fs.existsSync(filePath) && fs.statSync(filePath).isDirectory();
}
