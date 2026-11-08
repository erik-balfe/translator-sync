#!/usr/bin/env bun

/**
 * Bumps the version in package.json, commits it and creates the git tag.
 * Bun-only: no standard-version, no conventional-changelog, no extra packages.
 *
 * Usage: bun scripts/release.ts <major|minor|patch>
 */

import { $ } from "bun";

const kind = process.argv[2];
if (kind !== "major" && kind !== "minor" && kind !== "patch") {
  console.error("usage: bun scripts/release.ts <major|minor|patch>");
  process.exit(1);
}

const pkgPath = new URL("../package.json", import.meta.url).pathname;
const pkg = (await Bun.file(pkgPath).json()) as { name: string; version: string };

const [major, minor, patch] = pkg.version.split(".").map((part) => Number.parseInt(part, 10));

const next =
  kind === "major"
    ? `${major + 1}.0.0`
    : kind === "minor"
      ? `${major}.${minor + 1}.0`
      : `${major}.${minor}.${patch + 1}`;

pkg.version = next;
await Bun.write(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

const leftover = Bun.spawnSync(["git", "status", "--porcelain"], { stdout: "pipe" });
if (leftover.stdout.toString().trim() !== "") {
  console.error("release: working tree is not clean, commit or stash first");
  process.exit(1);
}

await $`git add package.json`;
await $`git commit -m ${`chore: release ${next}`}`;
await $`git tag -a ${`v${next}`} -m ${`v${next}`}`;

console.log(`release: ${pkg.version} tagged. Push with:`);
console.log("  git push && git push --tags");
