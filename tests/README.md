# Test Suite Layout

Vitest tests are grouped by the product area they exercise. Keep new tests in
one of these folders instead of adding root-level `*.test.ts` files.

The test suite has its own TypeScript project at `tests/tsconfig.json` so the
editor and `npm run compile` use the same Node, Vitest, and DOM typings.

## Folders

- `knowledge/`: command catalog, Object Tree value, readback, behavior, and
  generated knowledge checks. Large checked-in data assertions are split by
  evidence area. Object Tree value metadata checks live under
  `knowledge/object-value-metadata/`, with shared JSON readers in
  `readKnowledgeTestData.ts`.
- `language/`: parser, formatter, diagnostics, semantic tokens, grammar, and
  editor-language providers.
- `reference/`: offline reference site and reference-bundle behavior.
- `repo/`: package policy, release workflow, source layout, public docs, and
  repository hygiene checks.
- `runtime/`: Talk UDP, OSC, readback, runtime config, script sending, and
  object validation.
- `sidebar/`: sidebar model, tree data, webview state, and sidebar accessibility.
- `workspace/`: workspace roots, user objects, workspace scanning, symbols, and
  watcher view behavior.
- `fixtures/`: shared fixture data. `fixtures/knowledge/` contains named
  Object Tree path groups used by large metadata checks.

## Naming

Use the source module or public behavior name as the file stem:
`workspaceScanner.test.ts`, `runtimeConfig.test.ts`, or
`commandReferenceCoverage.test.ts`. Prefer moving an existing file to the
matching folder over renaming it unless the old name is misleading.
