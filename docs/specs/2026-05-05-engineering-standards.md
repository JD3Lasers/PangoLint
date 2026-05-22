# PangoLint Engineering Standards

Date: 2026-05-05
Status: Governing source of truth for repository structure, file naming, and module responsibility.

## Purpose

This spec defines the engineering standards future feature work and audit work
must follow. It is intentionally concrete: an audit finding should be able to
point at a section here and say exactly which rule is being violated.

When this spec conflicts with older local patterns, follow this spec unless a
higher-priority repository guardrail or the user request says otherwise.
When a rule needs to change, update this spec in the same slice as the code or
documentation change that makes the old rule obsolete.

## Responsibility Model

Every source file must have one primary responsibility. A file may contain
small local helpers for that responsibility, but it must not become a feature
bucket.

Allowed source module roles:

- Pure language logic: parser, diagnostics, formatter, semantic tokens, color
  recognition, command catalog lookups.
- Knowledge loading and validation: command knowledge, property index,
  source-backed data readers.
- Runtime transport: Talk UDP, OSC packet handling, BEYOND readback
  operations.
- VS Code adapter: provider registration, command registration, UI conversion,
  and extension-host integration.
- Workspace state: workspace scanning, user-object registry, watcher state,
  workspace-root selection.
- Reference site: offline reference-site browser bundles, detail rendering,
  search state, Object Tree navigation, and reference styles.
- MCP server adapter: stdio server registration, MCP tool/resource adapters,
  npm tarball packaging, and agent-facing configuration surfaces.
- Sidebar: activity-bar view container backed by VS Code TreeDataProviders.
  Sidebar code is split into a portable `model/` half (data, queries,
  formatting, action wrappers) and a swappable `view/` half (TreeView today,
  webview later if needed). The model must stay free of `vscode.TreeItem`
  construction so a future renderer can reuse it verbatim.

Crossing those roles requires a named module boundary. For example, runtime
commands belong in `runtimeCommands.ts`, while `extension.ts` should register
that module rather than owning all command implementation details.

## File Naming

Use stable, descriptive names. Avoid vague buckets like `utils.ts`,
`helpers.ts`, `common.ts`, `misc.ts`, `shared.ts`, or `types.ts` unless the
file is truly a package-level barrel with no behavior.

### TypeScript Source

- Source files under `src/` use lower camel-case: `propertyPath.ts`,
  `runtimeCommands.ts`, `workspaceRoot.ts`.
- Source files under `mcp/src/` also use lower camel-case:
  `knowledgeBase.ts`, `getServerConfig.ts`, `readBeyondProperty.ts`.
- Test files mirror the source file when possible:
  `src/runtime/vscode/runtimeCommands.ts` has
  `tests/runtime/runtimeCommands.test.ts`.
- Classes and exported types use PascalCase.
- Functions, local variables, and module-level state use lower camel-case.
- Constants that represent fixed policy or protocol values use UPPER_SNAKE or
  clear lower camel-case when they are local implementation details.
- VS Code command IDs use the `pangolint.` prefix and lower camel-case command
  names, for example `pangolint.refreshWatcher`.
- Sidebar action command IDs use the `pangolint.sidebar.` prefix, for example
  `pangolint.sidebar.insertAtCursor`. Sidebar view IDs use the `pangolint.`
  prefix followed by the view name, for example `pangolint.commandsView`.

### Scripts

- Files under `scripts/` use lower camel-case and name the operation:
  `generateKnowledgeBase.ts`, `verifyPackageContents.ts`.
- `scripts/` is public-safe maintainer tooling only: generators, corpus
  linting, packaging checks, and deterministic data-copy helpers.
- `scripts/objectTree/propertyIndex/` owns the Object Tree property index generator
  modules. Keep entry construction, source fact loading, metadata overlays,
  metadata validation, path logic, search text, and generator data contracts in
  named files under that folder.
- One-off live BEYOND investigation scripts belong under ignored local tooling
  paths such as `.local-scripts/`. Do not track them in
  git; summarize durable public-safe findings in `docs/references/` and
  curated command notes.
- Scripts must not become hidden production dependencies unless README and
  package scripts document that dependency.

### Tests

- Unit tests live in `tests/` and end with `.test.ts`.
- MCP workspace tests live in `mcp/tests/` and end with `.test.ts`.
- Extension-host tests stay under `src/test/` because they run through
  `vscode-test`.
- New behavior changes require a focused test before production code changes.
- New modules should get a same-name test file unless they are thin adapters
  covered by an extension-host test.

### Documentation

- Specs live in `docs/specs/`.
- Runbooks live in `docs/runbooks/`.
- Reference material lives in `docs/references/`.
- Markdown files use kebab-case. Dated specs and plans start with
  `YYYY-MM-DD-`.
- Public-safe PangoScript examples may keep operator-facing BEYOND file names
  under `docs/references/beyond/pangoscript/working-examples/<attribution>/`;
  do not rename those only to satisfy code filename conventions.

### Data

- Generated command data lives under `data/pangoscript/`.
- Do not hand-edit generated outputs:
  `commands.generated.json` and `commands.merged.json`.
- Curated command edits go in `commands.overlay.json`.
- Keep private provenance and maintainer-tooling identifiers out of tracked
  command knowledge and shipped artifacts.
- `mcp/data/` and `mcp/docs/` are generated npm-tarball staging copies. Do
  not hand-edit them; update the root `data/` or `docs/` source and run the
  MCP asset copy/package path.

## Language And Naming

Names, comments, docs, issue bodies, PR descriptions, and commit messages
should be understandable to a TypeScript developer who knows BEYOND but has not
read the internal specs.

Use concrete product language:

```text
parse command text
build diagnostic
emit hover text
probe readback
overlay entry
evidence level
knowledge merge
command signature
object path
value range
```

Avoid vague or overused AI and planning terminology. Do not introduce new
general-purpose uses of terms like these:

```text
canonical
vertical slice
agentic
orchestrator
magic
smart wrapper
universal manager
handler
helper
utils
```

Only use those terms when they are literal upstream protocol names, checked-in
schema fields, command names, or quoted examples that cannot be renamed without
changing behavior. Existing public schema fields such as command `canonical`
remain until a planned schema migration.

Prefer names that say what the code actually does:

```text
parseCommandText       not renderCommand
buildDiagnostic        not processMessage
KnowledgeBase          not DataOrchestrator
CommandEntry           not CommandPayload
overlayEntries         not canonicalData
```

Comments should explain protocol facts, safety constraints, evidence
provenance, or non-obvious validation decisions. Do not write comments that
merely narrate the next line of code.

Good comment subjects:

```text
why a range rejects instead of clamps
which BEYOND build proved a property path or boundary
why the parser preserves unknown syntax here
why a property write requires explicit ControlMaster routing
```

Bad comment subjects:

```text
set the variable
call the helper
loop through items
this function handles everything
```

Do not use em dash characters in written content: docs, issue bodies, PR
descriptions, commit messages, or code comments. Use a colon, comma, or rewrite
the sentence.

## Folder Structure

The repository has these durable top-level folders:

- `src/`: extension source. Keep production TypeScript here. `src/extension.ts`
  is the VS Code composition root; other production modules belong in the
  responsibility folders below.
- `src/language/`: parser, diagnostics, formatter, semantic tokens, labels,
  color/property-path helpers, and other PangoScript language behavior.
- `src/knowledge/`: command catalog, curated command knowledge, and
  source-backed property index loading/validation.
- `src/runtime/`: BEYOND runtime code grouped into `talk/`, `osc/`,
  `readback/`, `commandBatch/`, and `vscode/`, plus shared runtime config
  and option mapping.
- `src/workspace/`: workspace-root selection, workspace trust, user-object
  registry, workspace scans/symbols, and watcher state.
- `src/sidebar/`: VS Code activity-bar view container. Split into
  `src/sidebar/model/` (renderer-agnostic data, queries, Markdown formatting,
  action wrappers, with no `vscode.TreeItem` / `vscode.TreeView` imports) and
  `src/sidebar/view/treeview/` (the current TreeView renderer). Future
  alternative renderers go beside `treeview/` (for example `view/webview/`)
  and consume the same model.
- `src/reference/`: offline reference-site browser source. Keep browser app
  code under `src/reference/bundle/`, detail rendering under
  `src/reference/bundle/detail/`, and reference styles in
  `src/reference/styles.css`. Generated HTML belongs under `media/reference/`.
- `mcp/`: separate npm workspace for `pangolint-mcp`. Keep MCP source under
  `mcp/src/`, MCP tests under `mcp/tests/`, package metadata in
  `mcp/package.json`, and generated tarball assets under ignored
  `mcp/data/` and `mcp/docs/`.
- `tests/`: Vitest tests for pure modules and source-backed data.
- `src/test/`: VS Code extension-host tests only.
- `scripts/`: public-safe maintainer tools only; no one-off live BEYOND
  investigation scripts.
- `data/pangoscript/`: command and property knowledge consumed by the
  extension.
- `docs/references/`: public-safe reference analysis and diagnostic docs.
- `docs/runbooks/`: operational procedures for runtime checks, VSIX smoke
  tests, and release work.
- `docs/specs/`: governing specs.
Do not create new top-level folders, new `src/` responsibility folders, or new
`mcp/src/` responsibility folders without adding the folder and ownership rules
to this spec.

## Module Size And Split Rules

Line count is not the only measure of quality, but it is a useful audit trigger.

- Below 300 lines: usually acceptable if the file has one responsibility.
- 300 to 450 lines: review for emerging mixed responsibilities.
- 450 to 600 lines: split unless there is a clear reason to keep the file
  together.
- Above 600 lines: normally a standards violation unless the file is generated,
  a declarative data fixture, or a deliberately thin adapter with documented
  submodule boundaries.

`extension.ts` is a VS Code composition root. It may register providers and
commands, but feature implementation should move into named modules as soon as
the behavior becomes testable outside extension activation.

## Dependency Direction

Keep dependency direction simple:

- Pure modules must not import `vscode`.
- Runtime transport modules must not import `vscode`.
- VS Code adapter modules may import pure and runtime modules.
- Sidebar model modules may import pure language, knowledge, runtime, and
  workspace modules. They must not import `vscode.TreeItem`, `vscode.TreeView`,
  or `vscode.WebviewView` types so renderer choice stays swappable. Sidebar
  view modules may import VS Code adapter APIs and the sidebar model, but the
  model must not import sidebar view modules.
- Scripts may import source modules, but source modules must not import scripts.
- Tests may import production modules; production modules must not import tests.
- Generated data builders must read checked-in source data and overlays.
- MCP modules may import pure language, knowledge, and runtime transport
  modules from `src/`; they must not import VS Code adapter modules or rely on
  VS Code workspace trust APIs.

When a module needs environment-specific behavior, use dependency injection
rather than importing the environment directly into pure logic.

## Runtime Safety Boundary

Talk UDP and OSC behavior crosses the BEYOND runtime safety boundary.

- Runtime commands must stay in dedicated runtime modules, not mixed into
  parser, diagnostics, formatter, or property-index modules.
- VS Code extension write/playback/output commands must use workspace trust,
  explicit settings, and operator confirmation.
- MCP runtime tools have no VS Code workspace or modal UI surface. They must
  stay disabled by default, require explicit startup opt-in
  (`PANGOLINT_MCP_RUNTIME=enabled` or an equivalent documented flag), expose
  the fixed startup host/port through `getServerConfig`, and run the
  lint-before-run gate before any full-script send. The agent must not be able
  to override the runtime target per call.
- Readback checks must bind listeners before sending Talk UDP.
- Multiple readback checks that share an OSC listen port must serialize or use
  a shared listener. Do not bind the same UDP port in parallel.
- New T2+ runtime behavior requires source evidence, safety-tier notes, and a
  focused test boundary before implementation.

## Workspace And Filesystem Boundaries

Workspace behavior must be explicit about local file-backed assumptions.

- Use a named workspace-root helper instead of ad hoc
  `workspaceFolders?.[0]` logic.
- Support virtual workspaces only for language features that do not require
  local filesystem scans or writes.
- Registry writes belong under `.pangolint/` in a file-backed workspace.
- Workspace scans must skip heavy directories such as `node_modules`, `.git`,
  `.vscode-test`, and `.trash`.
- Long or repeated scans should be debounced, cached, cancellable, or moved to
  async workspace APIs.

## Test And Verification Rules

Required gates:

- Before claiming a production or docs slice is complete, run the repository
  verification gate: `npm run check`.
- Public-clone release work must also keep `npm run check:public` clean.
- Extension activation or command-registration changes require
  `npm run test:extension-host`.
- VSIX packaging changes require `npm run package:vsix` or the checked package
  contents verification path.
- MCP package changes require `npm --workspace mcp run verify:tarball`; the
  root `npm run check` should include the MCP verification before any MCP
  release.

Test posture:

- Behavior changes get a failing test first.
- Refactors get characterization coverage before moving code when the moved
  behavior is non-trivial.
- Tests should exercise public module behavior, not private implementation
  trivia.
- Use mocks only at environment boundaries such as VS Code APIs, UDP sockets,
  or filesystem state.

## Audit Checklist

Future engineering audits must check this list:

- Does each changed file have one clear responsibility?
- Do new files follow the naming rules for their folder?
- Does a new folder have ownership and structure documented here?
- Are pure modules free of `vscode` imports?
- Are runtime safety behaviors isolated and explicitly gated?
- Are generated files regenerated rather than hand-edited?
- Are tests placed beside the module responsibility they cover?
- Does MCP work keep `mcp/package.json#files`, copied assets, and license
  packaging in sync?
- Do sidebar changes preserve the model/view split? Specifically: no
  `TreeItem` / `TreeView` / `WebviewView` imports inside `src/sidebar/model/`,
  and all sidebar actions registered as `pangolint.sidebar.*` commands rather
  than inline TreeItem callbacks.
- Does the slice avoid vague AI or planning terminology and em dash characters
  in names, comments, docs, issue bodies, PR descriptions, and commit messages?
- Did the slice run the required verification gate before commit or publish?

If an audit finds drift, prefer a narrow standards-alignment slice before
feature work.
