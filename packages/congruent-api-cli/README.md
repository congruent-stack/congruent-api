# @congruent-stack/congruent-api-cli

CLI for [congruent-api](https://github.com/congruent-stack/congruent-api): scaffolds a handler folder tree from an API contract.

Given a contract module, it generates one folder per path segment for every endpoint, an HTTP-method subfolder (`GET`, `POST`, ...) under each, and a `handler.ts` stub inside.

## Usage

```
congruent-api <contract-path> <out-dir> [endpoint-path] [--force]
```

Without installing:

```sh
pnpm dlx @congruent-stack/congruent-api-cli ./src/contract.ts ./src/handlers
# or: npx @congruent-stack/congruent-api-cli ./src/contract.ts ./src/handlers
```

## ⚡ Use it from `package.json` scripts

Install it as a devDependency:

```sh
pnpm add -D @congruent-stack/congruent-api-cli
```

then wire the `congruent-api` bin into your scripts:

```jsonc
{
  "scripts": {
    // generate handler stubs for every endpoint in the contract
    "gen:handlers": "congruent-api ./src/contract.ts ./src/handlers",

    // regenerate everything from scratch (overwrites existing handler.ts files!)
    "gen:handlers:force": "congruent-api ./src/contract.ts ./src/handlers --force"
  }
}
```

```sh
pnpm gen:handlers

# scaffold just one new endpoint:
pnpm gen:handlers -- /somepath/:myparam
```

Extra arguments after `--` are appended to the script, so `pnpm gen:handlers -- /somepath/:myparam` scaffolds only that endpoint. Re-running is always safe by default — existing `handler.ts` files are skipped, only newly added endpoints get scaffolded.

### Arguments

| Argument | Description |
| --- | --- |
| `contract-path` | Path to the module exporting the api contract (`.ts` or `.js`). TypeScript is loaded directly via [tsx](https://tsx.is) — no build step needed. The first `ApiContract`-like export is used (`contract` and `default` take precedence). |
| `out-dir` | Directory the folder tree is generated into (created if missing). |
| `endpoint-path` | Optional full generic endpoint path (e.g. `/somepath/:myparam`, leading slash optional). When given, folders are generated only for that endpoint. An unknown path fails and lists the contract's endpoint paths. |

### Options

| Option | Description |
| --- | --- |
| `--force` | Overwrite existing `handler.ts` files. By default existing files are skipped, so re-running after adding endpoints never clobbers implemented handlers. |

## Example

For this contract:

```ts
import { apiContract, endpoint } from '@congruent-stack/congruent-api';

export const contract = apiContract({
  somepath: {
    [':myparam']: {
      POST: endpoint({ /* ... */ }),
    },
  },
  otherpath: {
    GET: endpoint({ /* ... */ }),
    POST: endpoint({ /* ... */ }),
  },
});
```

running

```sh
congruent-api ./src/contract.ts ./src/handlers
```

generates:

```
handlers/
├── somepath/
│   └── +myparam/           ← ':myparam' path parameter
│       └── POST/
│           └── handler.ts
└── otherpath/
    ├── GET/
    │   └── handler.ts
    └── POST/
        └── handler.ts
```

Path parameter segments (`:myparam`) become `+myparam` folders — `:` is not a valid character in Windows folder names.

Each `handler.ts` contains a registration stub with the method and generic path filled in:

```ts
route(apiReg, 'POST /somepath/:myparam')
  .inject(scope => ({

  }))
  .register(async (_req) => {
    throw Error('Not implemented')
  });
```

## Programmatic API

The same functionality is exported from the package:

```ts
import { loadContractDefinition, generateEndpointFolders } from '@congruent-stack/congruent-api-cli';

const definition = await loadContractDefinition('./src/contract.ts');
const { createdDirs, createdFiles, skippedFiles } = await generateEndpointFolders({
  definition,
  outDir: './src/handlers',
  endpointPath: '/somepath/:myparam', // optional
  force: false,                       // optional
});
```

Also exported: `collectEndpointPaths(definition)` (walks a contract definition and returns every endpoint path with its methods), `segmentToFolderName(segment)`, `endpointPathToSegments(path)`, and `renderHandler(method, genericPath)`.
