# CLAUDE.md

## What this repo is

**congruent-api** is a TypeScript, schema-first toolkit for building REST APIs with a shared contract enforced at compile time on both the server and the client. An API contract (routes, methods, request/response schemas — validated with Zod) is defined once and consumed by both ends, so mismatches become type errors instead of runtime surprises.

## Structure

This is a pnpm workspace monorepo (see `pnpm-workspace.yaml`):

- `packages/congruent-api` — core library: contract definition, routing, handler registration/execution chain, middleware, DI container, in-process client.
- `packages/congruent-api-express` — Express 5 server adapter.
- `packages/congruent-api-fetch` — fetch-based HTTP client adapter.
- `packages/congruent-api-cli` — CLI (`congruent-api` bin) that scaffolds a folder tree from a contract's endpoint paths (`:param` segments become `+param` folders).
- `e2e/` — end-to-end tests (Express).
- `testing/` — shared test fixtures (e.g. `pokedex` sample API).
- `bin/` — version bump/sync scripts.

## Conventions & commands

- Package manager: **pnpm** (versions pinned via the workspace catalog).
- Tests: **vitest** (`*.test.ts` colocated with sources).
- `tsconfig.json#compilerOptions.strict` must stay `true` — the type-level contract enforcement depends on it.
- Version bumps: `pnpm update:versions [patch/minor/major/x.y.z]` (git tags are created by the GitHub Action, not locally).
