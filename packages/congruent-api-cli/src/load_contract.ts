import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tsImport } from 'tsx/esm/api';

interface ContractLike {
  definition: Record<string, unknown>;
}

function isContractLike(value: unknown): value is ContractLike {
  return typeof value === 'object' && value !== null
    && 'definition' in value
    && typeof (value as ContractLike).definition === 'object'
    && (value as ContractLike).definition !== null;
}

/**
 * Imports a contract module (.ts or .js) and returns the definition of the
 * first ApiContract-like export ('contract' and 'default' take precedence).
 */
export async function loadContractDefinition(contractPath: string): Promise<Record<string, unknown>> {
  const absPath = resolve(contractPath);
  if (!existsSync(absPath)) {
    throw new Error(`Contract file not found: ${absPath}`);
  }

  const mod: Record<string, unknown> = await tsImport(pathToFileURL(absPath).href, import.meta.url);

  const exportNames = ['contract', 'default', ...Object.keys(mod)];
  for (const name of exportNames) {
    const value = mod[name];
    if (isContractLike(value)) {
      return value.definition;
    }
  }
  throw new Error(
    `No API contract export found in ${absPath}. `
    + `Export the result of apiContract(...), e.g. "export const contract = apiContract({ ... });".`,
  );
}
