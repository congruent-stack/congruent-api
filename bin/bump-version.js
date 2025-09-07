#!/usr/bin/env node
import { execa } from "execa";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const args = process.argv.slice(2);
// ...same validation as before...

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
