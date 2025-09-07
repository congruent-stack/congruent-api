# Scripts

This directory contains utility scripts for the monorepo.

## sync-versions.js

Synchronizes the `version` field in all package.json files under `./packages/**` with the version in the root package.json.

### Usage

```bash
# Run directly
node bin/sync-versions.js

# Or via pnpm script
pnpm run pkgs:version:sync
```

### Features

- Finds all package.json files in packages subdirectories
- Ignores node_modules directories
- Provides detailed output showing which packages were updated
- Handles errors gracefully
- Exits with error code if any packages fail to update

### Example Output

```
Root version: 0.3.0-rc.0
Found 3 package(s) to sync:
  packages/api/package.json: 0.2.0 -> 0.3.0-rc.0
    ✓ Updated
  packages/cli/package.json: 0.3.0-rc.0 -> 0.3.0-rc.0
    ✓ Already in sync
  packages/core/package.json: 0.1.0 -> 0.3.0-rc.0
    ✓ Updated

Synchronization complete!
  Updated: 2 package(s)
```

### Dependencies

Requires the `glob` package to be installed as a dev dependency.
