#!/usr/bin/env node
import { generateEndpointFolders } from './generate_folders.js';
import { loadContractDefinition } from './load_contract.js';

const USAGE = `Usage: congruent-api <contract-path> <out-dir> [endpoint-path] [--force]

Generates a folder per path segment for every endpoint in the contract, an
HTTP-method subfolder (GET, POST, ...) under each, and a handler.ts stub inside.
Path parameter segments (':myparam') become '+myparam' folders.

Arguments:
  contract-path   Path to the module exporting the api contract (.ts or .js)
  out-dir         Directory the folder tree is generated into
  endpoint-path   Optional full endpoint path (e.g. /somepath/:myparam);
                  when given, folders are generated only for that endpoint

Options:
  --force         Overwrite existing handler.ts files (default: skip them)`;

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    console.log(USAGE);
    return;
  }
  const force = rawArgs.includes('--force');
  const args = rawArgs.filter(arg => arg !== '--force');
  if (args.length < 2 || args.length > 3) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }
  const [contractPath, outDir, endpointPath] = args;

  const definition = await loadContractDefinition(contractPath);
  const result = await generateEndpointFolders({ definition, outDir, endpointPath, force });

  for (const file of result.createdFiles) {
    console.log(`+ ${file}`);
  }
  for (const file of result.skippedFiles) {
    console.log(`= ${file} (exists, skipped)`);
  }

  if (result.createdDirs.length === 0) {
    console.log(`No endpoint folders to generate.`);
    return;
  }
  const summary = [`Generated ${result.createdFiles.length} handler(s) in ${outDir}`];
  if (result.skippedFiles.length > 0) {
    summary.push(`${result.skippedFiles.length} skipped (use --force to overwrite)`);
  }
  console.log(summary.join('; '));
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
