# Contributing to PangoLint

PangoLint welcomes small, reviewable contributions from a normal public
checkout. End-user documentation lives in [`README.md`](README.md) and
[`docs/manual.html`](docs/manual.html).

## Public Development

Install dependencies and run the public gate:

```bash
npm ci
npm run check:public
```

`npm run check:public` compiles the extension, runs lint, runs Vitest, lints the
checked-in example corpus, and verifies VSIX package contents. It does not
require maintainer-only source exports or generated-data refresh inputs.

Good public contribution shapes:

- focused bug fixes with tests
- documentation corrections
- small diagnostic, formatter, sidebar, or MCP fixes
- curated command metadata updates in `data/pangoscript/commands.overlay.json`
- focused Object Tree metadata corrections backed by public-safe evidence notes

Avoid broad generated-data refreshes in public PRs unless a maintainer has
opened an issue for that work. Large BEYOND export refreshes and live BEYOND
evidence files are maintainer workflows.

Launch the extension in VS Code by opening this repo, pressing `F5`, and using
the Extension Development Host window with a `.BeyondCode` file.

## Repository Layout

- `src/README.md` describes the source folder layout.
- `src/extension.ts` is the VS Code composition root.
- `src/language/` contains parser, diagnostics, formatter, hover, completion,
  signature help, semantic token, and code action behavior.
- `src/knowledge/` loads command, function, and Object Tree knowledge.
- `src/runtime/` contains Talk UDP, OSC, and BEYOND readback code.
- `src/sidebar/` contains the sidebar model and VS Code views.
- `mcp/` contains the standalone `pangolint-mcp` server.
- `docs/runbooks/` contains operational notes for package checks, runtime
  testing, release steps, and data layout.

## Knowledge Data

The bundled command catalog and Object Tree data live in `data/pangoscript/`:

- `commands.generated.json` is generated from a BEYOND command export and is
  checked in for public builds.
- `commands.overlay.json` is the curated enrichment layer for syntax forms,
  parameters, safety tiers, and public-safe notes.
- `commands.merged.json` is generated from the generated data plus overlay and
  consumed by the extension and MCP server.
- Object Tree source facts and runtime indexes live under
  `data/pangoscript/object-tree/`.
- Known expression functions such as `ExtValue`, `int`, `intstr`, and `max`
  live in `src/knowledge/expressionFunctions.ts`.

After changing command metadata, run:

```bash
npm run build:knowledge
npm run check:public
```

In a public checkout, `npm run build:knowledge` uses the checked-in
`commands.generated.json` when the optional maintainer BEYOND command export is
absent.

## Maintainer Data Refreshes

Large generated-data refreshes are maintainer-owned and are not part of normal
public contribution work. Public contributors should prefer checked-in overlay,
documentation, test, and source edits unless a maintainer issue explicitly asks
for a generated-data refresh.

Maintainer-only source inputs are gitignored and must not be required for normal
public development, package verification, or MCP package verification.

Maintainers preparing release work should run the stricter gate:

```bash
npm run check
```

That gate refreshes generated knowledge where optional maintainer inputs exist,
runs the public gate, and verifies the `pangolint-mcp` tarball.

## Reference And Regression Files

Reference files tracked in this repository:

- `docs/references/beyond/pangoscript/object-model.md`: empirical
  destination-model, silent-0, and Object Tree analysis assembled from runtime
  observations.
- `docs/references/beyond/pangoscript/master-object-tree.md`: Object Tree root
  notes assembled during investigation.
- `docs/references/beyond/pangoscript/working-examples/`: real-world
  PangoScript snippets used as parser regression input, organized by
  attribution (`jd3/`, `jvyduna/`).
- `docs/references/beyond/pangoscript/linter-regressions/`: small pass/fail
  `.BeyondCode` fixtures verifying that known-good scripts stay
  diagnostic-free and known-bad scripts keep emitting expected diagnostics.
- `docs/runbooks/beyond-runtime-command-runbook.md`: readback-first runtime
  workflow.

`.BeyondCode` files intentionally check out with CRLF line endings. BEYOND's
PangoScript editor paste path treats LF-only clipboard text as one logical
line, which can collapse a multi-line script into one line.

## Packaging

Create a clean source archive from tracked files only:

```bash
npm run archive:source
```

Do not share ad hoc ZIPs that include `node_modules/`, `dist/`, `.git/`,
`.DS_Store`, or `__MACOSX/`. A clean archive consumer should run `npm ci`
after unpacking the archive.

Verify runtime package contents with:

```bash
npm run verify:package
```

Build the bundled offline PangoScript reference site with:

```bash
npm run build:reference
```

The generator reads checked-in public-safe catalog files under
`data/pangoscript/` and writes `media/reference/pangoscript-reference.html`.
That output is ignored by git, included in the VSIX, and verified by the
package-content gate.

Build a VSIX with:

```bash
npm run package:vsix
```

The package-content check requires these runtime files to be present:

- `dist/extension.js`
- `dist/sidebar-commands-webview.js`
- `dist/sidebar-objects-webview.js`
- `data/pangoscript/beyond-category-tree.json`
- `data/pangoscript/commands.merged.json`
- `data/pangoscript/object-tree/runtime-indexes/known-properties.json`
- `data/pangoscript/object-tree/runtime-indexes/object-property-index.json`
- `language-configuration.json`
- `syntaxes/pangoscript.tmLanguage.json`
- `snippets/pangoscript.json`
- `media/icon.png`
- `media/icon-activity-bar.svg`
- `media/reference/pangoscript-reference.html`
- `media/sidebar/commands.html`
- `media/sidebar/commands.css`
- `media/sidebar/objects.html`
- `media/sidebar/objects.css`
- `docs/references/diagnostics/README.md`
- `package.json`
- `README.md`
- `CHANGELOG.md`
- `LICENSE`
- `NOTICE.md`

VSIX contents are constrained by `.vscodeignore` and verified with
`vsce ls --no-dependencies`. `scripts/verifyPackageContents.ts` asserts the
exact runtime file set and rejects unexpected source, test, script, docs, CI,
internal data, or local artifact files. Add new runtime files to
`.vscodeignore` and the `expectedPaths` list in
`scripts/verifyPackageContents.ts`. Do not add `package.json#files`; VSCE does
not support combining that allow-list with `.vscodeignore`.

Verify the MCP npm package tarball with:

```bash
npm run check:mcp
```

That command compiles `mcp/src/server.ts`, copies package data, docs, and
license staging files, then runs `npm pack --dry-run` for `pangolint-mcp`.

## Sidebar Architecture

The sidebar reads only bundled data. It does not use network access or mutate
workspace files. See [`docs/runbooks/sidebar.md`](docs/runbooks/sidebar.md) for
the architecture and how to add a view.

## Reporting Issues

<https://github.com/JD3Lasers/PangoLint/issues>
