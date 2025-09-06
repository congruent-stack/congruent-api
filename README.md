# congruent-api
Typescript schema-first tooling for agnostic REST APIs.

### Version bump script
- pnpm pkgs:version:bump -- [patch/minor/major/x.y.z]
  - don't forget to run the "root:version:bump" script too
- for release candidates you can
  - pnpm pkgs:version:bump -- [prepatch/preminor/premajor]
    - and then
  - pnpm pkgs:version:bump -- prerelease
    - to increase the rc counter
- the git tag is created by the github action instead of "pnpm version" 
  - --no-git-tag-version flag is provided within the script
