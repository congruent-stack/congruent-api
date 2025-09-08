# congruent-api
Typescript schema-first tooling for agnostic REST APIs.

### Make sure that
- tsconfig.json#compilerOptions.strict is set to true

### How to update version
- pnpm update:versions [patch/minor/major/x.y.z]

### How to update version to release candidate
- pnpm update:versions [prepatch/preminor/premajor]

## Obsolete (kept for reference)

#### Version bump scripts
- pnpm pkgs:version:bump -- [patch/minor/major/x.y.z]
  - don't forget to run the "root:version:bump" script too
- for release candidates you can
  - pnpm pkgs:version:bump -- [prepatch/preminor/premajor]
    - and then
  - pnpm pkgs:version:bump -- prerelease
    - to increase the rc counter
- the git tag is created by the github action instead of "pnpm version" 
  - --no-git-tag-version flag is provided within the script
