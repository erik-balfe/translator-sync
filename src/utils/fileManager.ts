import fs from "node:fs";
import { readdir, readFile as readFileNode, writeFile as writeFileNode } from "node:fs/promises";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Reads a file as UTF-8 text.
 * @param filePath The path to the file.
 * @returns Promise resolving to the file's text content.
 */
export async function readFile(filePath: string): Promise<string> {
  return await readFileNode(filePath, "utf8");
}

/**
 * Writes a string to a file, creating parent directories when missing.
 * @param filePath The path to the file.
 * @param data The string content to write.
 */
export async function writeFile(filePath: string, data: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFileNode(filePath, data, "utf8");
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
