import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadContractDefinition } from './load_contract.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'test-fixtures');

describe('loadContractDefinition', () => {
  it('loads the definition from a .ts module exporting a contract', async () => {
    const definition = await loadContractDefinition(join(fixturesDir, 'fake_contract.ts'));
    expect(Object.keys(definition)).toEqual(['somepath', 'otherpath']);
  });

  it('throws for a missing file', async () => {
    await expect(loadContractDefinition(join(fixturesDir, 'does_not_exist.ts')))
      .rejects.toThrow(/Contract file not found/);
  });

  it('throws when the module has no contract-like export', async () => {
    await expect(loadContractDefinition(join(fixturesDir, 'no_contract.ts')))
      .rejects.toThrow(/No API contract export found/);
  });
});
