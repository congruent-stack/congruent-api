import { describe, it, expect } from 'vitest';
import { collectEndpointPaths } from './contract_walker.js';

const fakeEndpoint = { responses: {} };

describe('collectEndpointPaths', () => {
  it('collects a path per endpoint-holding node', () => {
    const definition = {
      somepath: {
        [':myparam']: {
          POST: fakeEndpoint,
        },
      },
      otherpath: {
        POST: fakeEndpoint,
      },
    };
    const entries = collectEndpointPaths(definition);
    expect(entries.map(e => e.segments)).toEqual([
      ['somepath', ':myparam'],
      ['otherpath'],
    ]);
  });

  it('groups multiple methods on the same path into one entry', () => {
    const definition = {
      pokemon: {
        GET: fakeEndpoint,
        POST: fakeEndpoint,
        [':id']: {
          GET: fakeEndpoint,
          DELETE: fakeEndpoint,
        },
      },
    };
    const entries = collectEndpointPaths(definition);
    expect(entries).toEqual([
      { segments: ['pokemon'], methods: ['GET', 'POST'] },
      { segments: ['pokemon', ':id'], methods: ['GET', 'DELETE'] },
    ]);
  });

  it('ignores subtrees without endpoints', () => {
    const definition = {
      empty: {},
      deeper: { alsoEmpty: {} },
      real: { GET: fakeEndpoint },
    };
    const entries = collectEndpointPaths(definition);
    expect(entries).toEqual([
      { segments: ['real'], methods: ['GET'] },
    ]);
  });

  it('collects endpoints at the contract root as an empty path', () => {
    const definition = {
      GET: fakeEndpoint,
    };
    const entries = collectEndpointPaths(definition);
    expect(entries).toEqual([
      { segments: [], methods: ['GET'] },
    ]);
  });
});
