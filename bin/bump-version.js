#!/usr/bin/env node
import { execa } from "execa";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const args = process.argv.slice(2);

function printUsage() {
  console.error(`
Argument: <version|bump>
Examples:
  1.2.3       # set exact version
  patch       # 1.0.0      -> 1.0.1
  minor       # 1.0.0      -> 1.1.0
  major       # 1.0.0      -> 2.0.0
  prepatch    # 1.0.0      -> 1.0.1-rc.0
  preminor    # 1.0.0      -> 1.1.0-rc.0
  premajor    # 1.0.0      -> 2.0.0-rc.0
  prerelease  # 1.0.0      -> 1.0.1-rc.0
  prerelease  # 1.0.1-rc.0 -> 1.0.1-rc.1
`);
}

if (args.length === 0) {
  console.error("❌ Missing version value/bump argument.");
  printUsage();
  process.exit(1);
}

if (args.length > 1) {
  console.error("❌ Too many arguments. Provide exactly one.");
  printUsage();
  process.exit(1);
}

console.log(`🔖 Updating versions with argument: ${args[0]}`);

try {
  await execa("pnpm", ["version", "--no-git-tag-version", "--preid", "rc", ...args], { stdio: "inherit" });
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const syncPath = join(__dirname, "sync-versions.js");
  await execa("node", [syncPath], { stdio: "inherit" });
  console.log("\n✅ Version bump and synchronization complete!\n");
} catch (err) {
  process.exit(err.exitCode || 1);
}
