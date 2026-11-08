#!/usr/bin/env bun

/**
 * Builds the CLI and the library, then fixes the CLI up for npm:
 * adds a `#!/usr/bin/env node` shebang and marks the file executable.
 *
 * Bun does not emit a shebang when the source has none, so it has to be added
 * here. Without it `npx translator-sync` fails on machines without Bun.
 */

import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cliOut = join(root, "dist", "cli", "translator-sync.js");

function run(cmd: string[]): void {
  const result = Bun.spawnSync(cmd, { cwd: root, stdout: "inherit", stderr: "inherit" });
  if (result.exitCode !== 0) {
    console.error(`build: ${cmd.join(" ")} failed with ${result.exitCode}`);
    process.exit(1);
  }
}

run([
  "bun",
  "build",
  "src/cli/translator-sync.ts",
  "--target=node",
  "--format=esm",
  "--outdir=dist/cli",
]);

run(["bun", "build", "src/index.ts", "--target=node", "--format=esm", "--outdir=dist"]);

const body = readFileSync(cliOut, "utf8").replace(/^#![^\n]*\n/, "");
writeFileSync(cliOut, `#!/usr/bin/env node\n${body}`);
chmodSync(cliOut, 0o755);

console.log("build: dist/cli/translator-sync.js (node shebang, executable)");
