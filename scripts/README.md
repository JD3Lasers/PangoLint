# Repository Scripts

The root script folder is grouped by task area so entrypoints and support files
are easy to find.

- `build/`: build entrypoints for generated extension assets and the offline
  reference site.
- `knowledge/`: command knowledge generation, corpus linting, and command gap
  reports.
- `objectTree/`: Object Tree indexes, audits, control-reference projections,
  and evidence validation.
- `package/`: VSIX and MCP package surface policy, package verification, MCP
  asset copying, and VSIX checksum writing.
- `release/`: release version updates, release preflight checks, PR version
  policy, and release asset watching.
- `workflow/`: issue branch and PR readiness helpers.

Repo housekeeping commands:

- `npm run audit:imports`: enforce source import boundaries with
  dependency-cruiser.
- `npm run graph:imports`: emit a Mermaid import graph from dependency-cruiser.
- `npm run audit:unused`: report unused files, exports, and package
  dependencies with knip. The package surface policy CJS module has a narrow
  export exception because its named policy groups are consumed through dynamic
  package verification scripts and repo policy tests. This audit is
  intentionally separate from `npm run check` until its signal stays stable
  across cleanup work.
