import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, stat, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateEndpointFolders } from './generate_folders.js';

const fakeEndpoint = { responses: {} };

const definition = {
  somepath: {
    [':myparam']: {
      POST: fakeEndpoint,
    },
  },
  otherpath: {
    GET: fakeEndpoint,
    POST: fakeEndpoint,
  },
};

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

describe('generateEndpointFolders', () => {
  let outDir: string;

  beforeEach(async () => {
    outDir = await mkdtemp(join(tmpdir(), 'congruent-api-cli-test-'));
  });

  afterEach(async () => {
    await rm(outDir, { recursive: true, force: true });
  });

  it('creates method subfolders and a handler.ts per endpoint method', async () => {
    const result = await generateEndpointFolders({ definition, outDir });

    expect(result.createdDirs).toEqual([
      'somepath/+myparam',
      'somepath/+myparam/POST',
      'otherpath',
      'otherpath/GET',
      'otherpath/POST',
    ]);
    expect(result.createdFiles).toEqual([
      'somepath/+myparam/POST/handler.ts',
      'otherpath/GET/handler.ts',
      'otherpath/POST/handler.ts',
    ]);
    expect(result.skippedFiles).toEqual([]);
    expect(await isDirectory(join(outDir, 'somepath', '+myparam', 'POST'))).toBe(true);
    expect(await isDirectory(join(outDir, 'otherpath', 'GET'))).toBe(true);
  });

  it('writes the handler template with the method and generic path', async () => {
    await generateEndpointFolders({ definition, outDir });
    const content = await readFile(join(outDir, 'somepath', '+myparam', 'POST', 'handler.ts'), 'utf8');
    expect(content).toBe(
      `route(apiReg, 'POST /somepath/:myparam')\n`
      + `  .inject(scope => ({\n\n`
      + `  }))\n`
      + `  .register(async (_req) => {\n`
      + `    throw Error('Not implemented')\n`
      + `  });\n`,
    );
  });

  it('generates only the matching endpoint when an endpoint path is given', async () => {
    const result = await generateEndpointFolders({
      definition,
      outDir,
      endpointPath: '/somepath/:myparam',
    });
    expect(result.createdFiles).toEqual(['somepath/+myparam/POST/handler.ts']);
    expect(await isDirectory(join(outDir, 'otherpath'))).toBe(false);
  });

  it('accepts the endpoint path without a leading slash', async () => {
    const result = await generateEndpointFolders({
      definition,
      outDir,
      endpointPath: 'otherpath',
    });
    expect(result.createdFiles).toEqual([
      'otherpath/GET/handler.ts',
      'otherpath/POST/handler.ts',
    ]);
  });

  it('throws when the endpoint path matches nothing, listing known paths', async () => {
    await expect(
      generateEndpointFolders({ definition, outDir, endpointPath: '/nope' }),
    ).rejects.toThrow(/No endpoint matches path "\/nope"[\s\S]*\/somepath\/:myparam[\s\S]*\/otherpath/);
  });

  it('skips existing handler.ts files by default, preserving their contents', async () => {
    await generateEndpointFolders({ definition, outDir });
    const target = join(outDir, 'otherpath', 'GET', 'handler.ts');
    await writeFile(target, '// hand-edited', 'utf8');

    const result = await generateEndpointFolders({ definition, outDir });
    expect(result.skippedFiles).toContain('otherpath/GET/handler.ts');
    expect(result.createdFiles).toEqual([]);
    expect(await readFile(target, 'utf8')).toBe('// hand-edited');
  });

  it('overwrites existing handler.ts files when force is set', async () => {
    await generateEndpointFolders({ definition, outDir });
    const target = join(outDir, 'otherpath', 'GET', 'handler.ts');
    await writeFile(target, '// hand-edited', 'utf8');

    const result = await generateEndpointFolders({ definition, outDir, force: true });
    expect(result.skippedFiles).toEqual([]);
    expect(result.createdFiles).toContain('otherpath/GET/handler.ts');
    expect(await readFile(target, 'utf8')).toContain(`route(apiReg, 'GET /otherpath')`);
  });
});
