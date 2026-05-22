# PangoLint Repo Architecture Baseline

Date: 2026-05-17
Status: Governing source of truth for repo folder roles, file naming, and future data cleanup.

## Purpose

This spec is the baseline architecture map for PangoLint. Future work should
use it when adding folders, adding data groups, moving files, or deciding
whether a file belongs in tracked source data, generated runtime data, package
projection data, evidence, ignored maintainer input, or local generated output.

This spec documents the current tree and the desired responsibilities. It does
not move files by itself. If this spec conflicts with older local patterns,
follow this spec unless a higher-priority instruction or a more recent
governing spec says otherwise.

## Architecture Rules

- New top-level folders require an update to this spec in the same PR.
- New tracked data groups must declare role, active consumer, package surface,
  generator or edit path, and retirement policy.
- New file and folder names should describe product facts: command catalog,
  Object Tree path, property controls, OSC route, value range, readback, or
  behavior classification.
- Do not use issue history, temporary cleanup state, or local probe names as
  the final name for product data.
- Generated outputs must be rebuilt from their source inputs. Do not hand-edit
  generated command, reference, package, or Object Tree indexes.
- Ignored local inputs can help maintainers refresh data, but normal public
  development and package verification must run from tracked files only.
- Retired tracked paths can be removed only after replacement data exists,
  consumers use the replacement path, and validation proves the old path is
  unused.

## Top-Level Folder Map

| Path | Role | Contents | Naming and cleanup notes |
| --- | --- | --- | --- |
| `src/` | VS Code extension source | Extension composition root plus extension-host IDs, language, knowledge, runtime, sidebar, reference, workspace, and extension-host test modules | Production TypeScript belongs in responsibility folders. `src/extension.ts` remains the VS Code composition root. |
| `mcp/` | MCP npm workspace | MCP server source, tests, package metadata, executable entrypoint, and ignored tarball staging copies | Source lives under `mcp/src/`. `mcp/data/`, `mcp/docs/`, and `mcp/LICENSE` are generated package staging paths. |
| `data/pangoscript/` | Tracked PangoScript knowledge data | Command catalog data, Object Tree indexes, control-reference data, value metadata, readback metadata, behavior metadata, evidence, and audits | This is the main cleanup target. Future work should separate source facts, generated runtime indexes, package projections, evidence, audit outputs, and optional maintainer input. |
| `docs/specs/` | Governing specs | Architecture, engineering standards, behavior classification, and other source-of-truth decisions | Specs are binding for future PRs unless superseded by a later spec. |
| `docs/runbooks/` | Operational procedures | Runtime probing, package checks, release steps, sidebar notes, and data layout policy | Runbooks explain how to operate or verify the repo. They should not override specs. |
| `docs/references/` | Public-safe reference material | PangoScript docs, OSC references, diagnostics docs, syntax notes, examples, and generated command-reference markdown | Reference material can feed docs, sidebar, MCP resources, and the offline reference site. |
| `scripts/` | Public-safe maintainer tools | Deterministic generators, package verifiers, release checks, corpus linting, and data reports | Scripts must be documented through package scripts or runbooks when they become part of normal workflows. |
| `tests/` | Vitest coverage | Pure module tests, data validation tests, package policy tests, docs policy tests, and regression coverage | Tests should validate source-backed data contracts and future architecture rules. |
| `src/test/` | VS Code extension-host tests | `vscode-test` runner and extension-host suite | Keep extension-host tests here because they need VS Code integration. |
| `media/` | VSIX static assets and generated reference output | Icons, sidebar assets, and generated offline reference HTML | Generated reference output must be rebuilt through `npm run build:reference`. |
| `snippets/` | VS Code snippets | PangoScript snippet JSON | Snippets are extension package inputs. |
| `syntaxes/` | TextMate grammar | PangoScript grammar JSON | Grammar files are extension package inputs. |
| `.github/` | GitHub automation | Hosted public gate and extension-host smoke workflows | Workflow changes need hosted verification after push. |
| `.vscode/` | Local editor settings | Recommended extensions and workspace settings | Do not put product behavior here. |

## Root File Map

| Path | Role | Notes |
| --- | --- | --- |
| `README.md` | Public project overview | Keep user-facing install, feature, and support information here. |
| `CONTRIBUTING.md` | Contributor workflow | Keep public contribution guidance here. |
| `CHANGELOG.md` | Release notes | Update for released behavior changes. |
| `LICENSE` | License text | Required package file. |
| `package.json` | Extension package manifest and repo scripts | Owns VS Code contributions, package scripts, and workspace script entrypoints. |
| `package-lock.json` | npm dependency lockfile | Update only through npm install flows. |
| `tsconfig.json`, `tsconfig.test.json` | TypeScript compile configuration | Keep runtime and test compile coverage explicit. |
| `vitest.config.ts` | Vitest configuration | Unit and data tests use this config. |
| `biome.json` | Lint and formatting policy | Do not run write-mode formatting unless the task calls for it. |
| `.vscodeignore` | VSIX package exclusions | Must keep ignored maintainer input, full evidence trees, and unapproved data out of the VSIX. |
| `.gitignore` | Local and generated artifact exclusions | Must keep package staging and local artifacts out of normal tracking. |
| `.gitattributes` | Git file handling | Preserves BEYOND-facing line-ending rules. |
| `.markdownlint.json`, `.markdownlint-cli2.jsonc` | Markdown lint policy | Keep docs lint behavior stable. |
| `.vscode-test.mjs` | Extension-host test configuration | Used by `npm run test:extension-host`. |
| `language-configuration.json` | VS Code language configuration | Extension package input for PangoScript language behavior. |

## VS Code Extension Source Map

| Path | Role | Contents | Rules |
| --- | --- | --- | --- |
| `src/extension.ts` | VS Code composition root | Provider registration, command registration, view setup, runtime wiring, and workspace setup | Keep behavior delegated to responsibility modules. |
| `src/extensionHost/` | VS Code host identifiers and packaged-file paths | Command IDs, view IDs, configuration section names, settings keys, output channel names, workspace-state keys, and package-relative asset paths | Keep behavior out of this folder. Use it when values need to match `package.json`, VS Code contribution points, or package contents. |
| `src/language/` | PangoScript editor language logic | Parser, diagnostics, formatter, semantic tokens, label and variable providers, property path parsing, color decorations, and validation reports | Keep pure language behavior free of runtime side effects. |
| `src/knowledge/` | Source-backed knowledge readers | Command catalog loading, category resolution, Object Tree property index loading, MCP control-reference projection types, and metadata readers | Load tracked data and expose typed lookup surfaces for extension features. |
| `src/runtime/` | BEYOND communication and runtime commands | Talk UDP, OSC, script send, readback, runtime configuration, object value assignment, and validation commands | Keep runtime safety explicit and readback-first by default. |
| `src/sidebar/model/` | Renderer-independent sidebar data | Command, object, diagnostic, and menu models plus formatting and action wrappers | Must not depend on VS Code TreeView classes. |
| `src/sidebar/view/treeview/` | Current TreeView renderer | Diagnostics tree view registration and item rendering | Renderer code may use VS Code UI classes. |
| `src/sidebar/view/webview/` | Commands and Objects webview renderer | Webview panels, messages, browser bundles, filters, detail views, and state | Webview bundles compile through package scripts. |
| `src/reference/` | Offline reference-site source | Browser bundle, detail renderers, Object Tree navigation, search state, and styles for the packaged PangoScript reference site | Generated HTML belongs under `media/reference/`. `src/reference/README.md` owns local folder rules and `tests/repo/sourceLayout.test.ts` guards the source files. |
| `src/workspace/` | Workspace state | User objects, watcher view, workspace root selection, workspace scanning, trust checks, and workspace symbols | Keep file system scanning separate from editor language parsing. |
| `src/test/` | Extension-host tests | VS Code test runner and integration tests | Do not mix Vitest-only tests into this folder. `src/test/README.md` owns local folder rules and `tests/repo/sourceLayout.test.ts` guards the extension-host test layout. |

## MCP Workspace Source Map

| Path | Role | Contents | Rules |
| --- | --- | --- | --- |
| `mcp/package.json` | MCP npm package manifest | Package scripts, package file list, and executable mapping | Package verification must use the manifest file list. |
| `mcp/bin/` | MCP executable entrypoint | Published command-line shim for `pangolint-mcp` | Keep executable behavior minimal and delegate to built server output. |
| `mcp/src/server.ts` | MCP server composition root | Server startup, tool registration, resource registration, and runtime config | Keep individual tool behavior in `mcp/src/tools/`. |
| `mcp/src/configEnv.ts` | MCP environment variable parsing | Environment variable names, boolean parsing, port parsing, timeout parsing, and Talk transport validation | Keep startup configuration parsing separate from tool response types. |
| `mcp/src/toolResult.ts` | MCP tool result shape | Shared `ok` and `fail` result wrappers used by tool implementations | Keep response shape independent from environment configuration. |
| `mcp/src/bundledResourcePaths.ts` | MCP bundled resource paths | MCP resource URIs, command-reference doc directory, and markdown or JSON reference paths | Use approved package data and docs only. |
| `mcp/src/tools/` | Agent-facing MCP tools | Command lookup, Object Tree lookup, property control lookup, linter diagnostics, readback, script run, and config tools | Tool responses must stay compact by default and expose explicit detail expansion. |
| `mcp/src/resources/` | MCP resources | Documentation and reference resources exposed to clients | Resources should use approved package data and docs. |
| `mcp/src/knowledgeBase.ts` | MCP data loading | Loads command, Object Tree, and control-reference package data | Must load approved package surfaces, not full maintainer-only trees. |
| `mcp/tests/` | MCP workspace tests | Tool behavior, package assets, config, resources, and response-size tests | Tests must protect package surface and response caps. |
| `mcp/data/`, `mcp/docs/`, `mcp/LICENSE` | Generated tarball staging | Copied from root source by `scripts/copyMcpData.cjs` | Ignored. Never edit directly. |
| `mcp/dist/` | Generated bundled server | Built by MCP compile script | Ignored build output. |

## PangoScript Data Map

The long-term data model should keep these roles separate:

| Data role | Current paths | Contents | Package surface | Cleanup direction |
| --- | --- | --- | --- | --- |
| Command catalog source facts | `commands.overlay.json`, `docs/references/beyond/pangoscript/command-reference/` | Curated command notes, command docs, and public-safe command facts | Overlay is not packaged. Selected generated command data is packaged. | Keep curated command edits in overlay and docs, then regenerate merged command data. |
| Generated command runtime indexes | `commands.generated.json`, `commands.merged.json`, `command-property-coverage.json`, `beyond-category-tree.json` | Generated command list, merged command knowledge, coverage reports, and category tree | VSIX and MCP ship selected runtime indexes. | Do not hand-edit. Rebuild with `npm run build:knowledge`. |
| Object schema runtime index | `object-tree/runtime-indexes/known-properties.json` | Object roots, paths, and schema-derived properties | VSIX and MCP ship it. | Rebuild with `npm run build:known-properties`. |
| Object Tree property runtime index | `object-tree/runtime-indexes/object-property-index.json` | Search and lookup index for extension, sidebar, reference site, and MCP object tools | VSIX and MCP ship it. | Rebuild with `npm run build:object-properties`. |
| Object Tree architecture contract | `object-tree/README.md`, `object-tree/data-groups.json` | Data group roles, target folders, consumers, package surfaces, and retirement policy for future Object Tree moves | Not packaged | Use as the baseline contract before moving Object Tree source facts, runtime indexes, evidence, or audits. |
| Object value metadata | `object-tree/source-facts/value-metadata/root.json`, `object-tree/source-facts/value-metadata/` | Value range, accepted value, and write-domain metadata grouped by Object Tree area and issue-era batches | Excluded from VSIX and MCP after #518. | Active source facts. Rename remaining issue-era filenames by product fact after consumers stay green on the new path. |
| Object readback metadata | `object-tree/source-facts/readback-metadata/` | Readback behavior and readable property observations | Excluded from VSIX and MCP after #518. | Active source facts. Keep separate from value metadata and behavior classification. |
| Object behavior metadata | `object-tree/source-facts/behavior-metadata/root.json`, `object-tree/source-facts/behavior-metadata/` | Read-only, read-write, flag-state, momentary-action, and write-only classifications | Excluded from VSIX and MCP after #518. | Active source facts. Keep separate from value and readback metadata. |
| Evidence | `object-tree/evidence/value/`, `object-tree/evidence/readback/`, `object-tree/evidence/behavior/` | Runtime proof, probe summaries, and issue-era observations | Excluded from VSIX and MCP after #518. | Keep as evidence until facts are represented in source facts and tests prove direct evidence files are not active inputs. |
| Audit outputs | `object-tree/audits/behavior/`, `object-tree/audits/readback/`, `object-tree/audits/data-quality/` | Generated audit reports used for Object Tree review and data-quality checks | Not packaged after #518. | Regenerate with audit scripts. Do not ship audit outputs in VSIX or MCP packages. |
| Control-reference source facts | `control-reference/object-control-reference/`, `control-reference/osc-control-reference/`, `control-reference/command-control-reference/`, `control-reference/control-crosswalk/` | Object control, OSC route, command route, and property-control crosswalk data | Not packaged directly after #518. | Keep as tracked source for reference UI planning, reference site generation, and compact MCP projection generation. |
| Package projections | `control-reference/mcp-control-reference/` | Compact property-control data for MCP lookup tools | MCP ships this projection. VSIX does not ship it. | Rebuild with `npm run build:mcp-control-reference`. |
| Package policy | `control-reference/package-policy.json` | Machine-readable consumer and package-surface policy for control-reference data | MCP ships it. VSIX verifier reads tracked source. | Keep with the control-reference group. |
| Optional maintainer input | Outside the public repository | Maintainer-only source material and BEYOND command exports | Must not ship. | Normal public gates must not require these paths. |

## Docs, Scripts, Tests, Media, And Package Files

| Area | Role | Rules |
| --- | --- | --- |
| `docs/references/beyond/pangoscript/` | Public-safe PangoScript reference material, working examples, command-reference markdown, and regression corpus | Keep BEYOND-facing examples public-safe and preserve line-ending rules for `.BeyondCode` files. |
| `docs/references/beyond/osc/` | OSC reference material | Use this for public-safe OSC facts and source notes. |
| `docs/references/diagnostics/` | Diagnostic rule documentation | Diagnostic docs should explain why a warning or hint exists. |
| `scripts/generateKnowledgeBase.ts` | Command knowledge generator | Reads command source and overlay data, writes generated command files. |
| `scripts/generateObjectPropertyIndex.ts` | Object Tree property index generator | Reads source facts, range, readback, and behavior metadata to write `object-tree/runtime-indexes/object-property-index.json`. |
| `scripts/generateMcpControlReference.ts` | MCP control-reference projection generator | Reads tracked control-reference source and writes compact MCP projection data. |
| `scripts/buildReferenceSite.ts` | Offline reference-site builder | Writes packaged HTML under `media/reference/`. |
| `scripts/packageSurfacePolicy.cjs` | Public package path policy | Shared VSIX and MCP package path lists plus maintainer-only path checks. |
| `scripts/copyMcpData.cjs` | MCP asset copier | Copies approved root data and docs into ignored MCP package staging. |
| `scripts/verifyPackageContents.ts` | VSIX package verifier | Fails when required package files are missing or unapproved data surfaces ship. |
| `tests/knowledgeBaseData.test.ts` | Broad checked-in data contract | Protects many Object Tree metadata and evidence paths until a cleanup PR replaces them. |
| `tests/publicPackagePolicy.test.ts`, `tests/mcpPackageAssets.test.ts` | Package-surface policy tests | Protect VSIX and MCP package boundaries. |
| `media/reference/` | Generated offline reference site | Generated package asset. Do not hand-edit. |
| `media/sidebar/` | Sidebar webview static assets | Package input for sidebar UI. |
| `artifacts/`, `*.vsix`, `*.tgz` | Local build outputs | Ignored. Do not treat as source. |

## Ignored Local Input And Generated Artifact Policy

| Path | Role | Tracking rule | Public gate rule |
| --- | --- | --- | --- |
| Maintainer-only research material | Outside the public repository | Not tracked | Normal gates must not require it. |
| `.local-scripts/` | One-off local investigation scripts | Ignored | Durable findings belong in tracked docs or data, not here. |
| `.trash/` | Local discarded material | Ignored | No public gate may read it. |
| `.vscode-test/` | Downloaded VS Code test runtime | Ignored | Created by extension-host test tooling. |
| `dist/` | Build output | Ignored | Rebuilt by compile and generator scripts. |
| `mcp/data/`, `mcp/docs/`, `mcp/LICENSE` | MCP tarball staging | Ignored | Rebuilt by `npm --workspace mcp run copy:assets`. |
| `mcp/dist/` | MCP bundled server output | Ignored | Rebuilt by MCP compile script. |
| `node_modules/`, `mcp/node_modules/` | Installed npm dependencies | Ignored | Rebuilt by `npm ci`. |

## Nonconforming Path Register

These paths are active today but should not be copied as naming patterns for
new work. They need replacement paths before they can move or retire.

| Current path or pattern | Current status | Why it is non-final | Target role or name direction | Blocking consumers |
| --- | --- | --- | --- | --- |
| `data/pangoscript/object-tree/source-facts/value-metadata/**/leftover*.json` | Active but non-final | Names describe unfinished batches instead of data meaning. | Property-family value metadata with clear root and behavior scope. | Object Tree index generation and tests. |
| `data/pangoscript/object-tree/source-facts/value-metadata/**/readback-retest-*.json` | Active but non-final | Names describe verification history, not the property facts now stored. | Value metadata or readback metadata based on final behavior. | Object Tree index generation and behavior tests. |
| `data/pangoscript/object-tree/source-facts/readback-metadata/**/*leftover*.json` | Active but non-final | Names describe cleanup state rather than readback facts. | Readback metadata grouped by Object Tree root and property family. | Object behavior audit, readback audit, and tests. |
| `data/pangoscript/object-tree/source-facts/behavior-metadata/issue-*.json` | Active but non-final | Names preserve issue provenance as the primary filename. | Behavior classification data grouped by Object Tree root or behavior family, with issue evidence in notes. | Object Tree index generation, behavior tests, and data quality audit. |
| `data/pangoscript/object-tree/evidence/**/issue-*.json` | Active evidence | Issue provenance is useful for evidence but too noisy as direct product input. | Evidence can remain issue-named until source facts no longer read it directly. | Data tests and evidence validation. |
| `data/pangoscript/control-reference/*-control-reference/` | Active source facts | Folder names are clear enough for source data, but full groups are too large for direct package use. | Keep as source facts and generate package projections for MCP and VSIX consumers. | Reference site generation, MCP control projection, future #212 reference UI decisions. |

Short path example: `object-tree/source-facts/value-metadata/zone/visualization-id-range.json`
is product-shaped source metadata under `data/pangoscript/`.

Do not move remaining Object Tree metadata again until a cleanup PR adds the
replacement path, moves the generator and tests to that replacement path,
updates package verification if needed, and tests prove old paths are unused.

## Future Conformance Rules

- Add data docs before adding a new tracked data group.
- Name data by product meaning, not by issue number, when the file is a source
  fact or generated runtime input.
- Keep issue numbers in evidence notes when provenance matters.
- Keep package projections compact and consumer-specific.
- Keep full evidence and maintainer-only input out of VSIX and MCP packages.
- Update this spec when a cleanup PR changes a folder role, creates a new
  durable folder, or retires a nonconforming path.

## Validation

Architecture and data-layout changes should run the narrow relevant tests, then
the full gate before merge:

```bash
npm test -- tests/repo/sourceLayout.test.ts tests/dataLayoutPolicy.test.ts tests/repo/publicPackagePolicy.test.ts
npm run check
```
