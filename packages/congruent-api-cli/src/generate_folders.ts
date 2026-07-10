import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { collectEndpointPaths } from './contract_walker.js';
import { segmentToFolderName } from './segment_folder_name.js';
import { renderHandler } from './handler_template.js';

export interface GenerateEndpointFoldersOptions {
  /** The api contract definition object (ApiContract#definition). */
  definition: Record<string, unknown>;
  /** Directory the endpoint folder tree is generated into. */
  outDir: string;
  /**
   * Optional full generic endpoint path, e.g. '/somepath/:myparam'.
   * When provided, folders are generated only for that endpoint.
   */
  endpointPath?: string;
  /** Overwrite existing handler.ts files instead of skipping them. Default: false. */
  force?: boolean;
}

export interface GenerateEndpointFoldersResult {
  /** Folder paths relative to outDir, using '/' separators (endpoint + method dirs). */
  createdDirs: string[];
  /** handler.ts paths that were written, relative to outDir. */
  createdFiles: string[];
  /** handler.ts paths that already existed and were left untouched, relative to outDir. */
  skippedFiles: string[];
}

export function endpointPathToSegments(endpointPath: string): string[] {
  return endpointPath.split('/').filter(segment => segment.length > 0);
}

export async function generateEndpointFolders(
  options: GenerateEndpointFoldersOptions,
): Promise<GenerateEndpointFoldersResult> {
  let entries = collectEndpointPaths(options.definition);

  if (options.endpointPath !== undefined) {
    const wanted = endpointPathToSegments(options.endpointPath).join('/');
    const filtered = entries.filter(entry => entry.segments.join('/') === wanted);
    if (filtered.length === 0) {
      throw new Error(
        `No endpoint matches path "/${wanted}". Endpoint paths found in the contract:\n`
        + entries.map(entry => `  /${entry.segments.join('/')}`).join('\n'),
      );
    }
    entries = filtered;
  }

  await mkdir(options.outDir, { recursive: true });

  const createdDirs: string[] = [];
  const createdFiles: string[] = [];
  const skippedFiles: string[] = [];

  for (const entry of entries) {
    const folderNames = entry.segments.map(segmentToFolderName);
    const genericPath = `/${entry.segments.join('/')}`;

    if (folderNames.length > 0) {
      await mkdir(join(options.outDir, ...folderNames), { recursive: true });
      createdDirs.push(folderNames.join('/'));
    }

    for (const method of entry.methods) {
      const methodDirParts = [...folderNames, method];
      await mkdir(join(options.outDir, ...methodDirParts), { recursive: true });
      createdDirs.push(methodDirParts.join('/'));

      const relFile = [...methodDirParts, 'handler.ts'].join('/');
      const absFile = join(options.outDir, ...methodDirParts, 'handler.ts');
      if (!options.force && existsSync(absFile)) {
        skippedFiles.push(relFile);
        continue;
      }
      await writeFile(absFile, renderHandler(method, genericPath), 'utf8');
      createdFiles.push(relFile);
    }
  }

  return { createdDirs, createdFiles, skippedFiles };
}
