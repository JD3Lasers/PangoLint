# Changelog

Notable public changes to PangoLint. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.7.30] - 2026-05-22

### Added

- Add an opt-in live BEYOND smoke script and manual self-hosted workflow for
  operator-supervised Talk TCP, OSC readback, property readback, and Talk UDP
  callback checks.

## [0.7.29] - 2026-05-22

### Fixed

- Update the transitive `qs` dependency to the patched release for
  GHSA-q8mj-m7cp-5q26 / CVE-2026-8723.

## [0.7.28] - 2026-05-22

### Changed

- Refresh the user manual for the current release line, including MCP install
  examples, diagnostic coverage, settings, and BEYOND Talk transport wording.

## [0.7.27] - 2026-05-22

### Changed

- Split validation and user-object command registration out of the VS Code
  activation entry point, keeping behavior in language and workspace modules.
- Update release comparison links so the published artifact set passes
  release preflight from a clean checkout.

## [0.7.25] - 2026-05-22

### Added

- Add repo policy coverage for TypeScript file-size drift across source,
  script, MCP, and test folders, with documented exemptions for existing large
  files.
- Add repo policy coverage for readable folder names across source, script,
  MCP, and test folders.

## [0.7.24] - 2026-05-22

### Changed

- Split cue property knowledge into focused modules for common properties,
  cue types, Parametric Image shapes, shared types, and Object Tree path
  builders.
- Remove the old root `src/knowledge/cueProperties.ts` file and the sidebar
  cue-menu re-export alias so consumers import concrete knowledge modules.

## [0.7.23] - 2026-05-22

### Changed

- Split reference-site Object Tree browser code into focused modules for tree
  rows, reference search, list rows, navigation counts, detail lookup, and
  cue-type, FX effect, and Universe component reference data.
- Remove the old broad `src/reference/bundle/objectTree.ts` module so reference
  bundle imports point at the files that own the behavior.

## [0.7.22] - 2026-05-22

### Changed

- Split BEYOND readback runtime code into focused modules for request IDs,
  property path validation, script line building, Talk send status, OSC
  callback matching, node transport, and runtime workflows.
- Move BEYOND readback runtime tests into `tests/runtime/readback/` and add
  source-layout policy coverage so the old broad test filenames do not return.

## [0.7.21] - 2026-05-22

### Changed

- Move Object Tree value metadata tests into a dedicated
  `tests/knowledge/object-value-metadata/` folder and add source-layout policy
  coverage so the old oversized test filenames do not return.

## [0.7.20] - 2026-05-22

### Fixed

- Keep VS Code Watcher and runtime readback commands on the full configured
  BEYOND Talk target, including TCP, UDP fallback, password, OSC listener, and
  timeout settings.
- Use transport-neutral BEYOND Talk wording for control-flow refusals, live
  hover readback, and replay status text.

### Changed

- Add GitHub Actions publishing workflows for the VS Code Marketplace and npm,
  and document Marketplace plus npm as the primary install channels.
- Organize VSIX and MCP source identifiers, bundled data paths, tool result
  shapes, resource paths, runtime modules, MCP tool registration, reference-site
  build scripts, repository scripts, checked-in tests, and package path policy
  into named product areas.
- Add source constants for package manifest IDs and BEYOND runtime defaults, then
  cover those values with repository policy tests.
- Add dependency-cruiser and Knip audit commands for import boundaries, graphs,
  unused files, exports, types, and package dependencies.
- Move script-addressed audit configuration into `config/` and add root file
  policy coverage so new tracked root files require an explicit policy update.
- Remove unnecessary public TypeScript exports from MCP tools, knowledge
  helpers, runtime modules, reference bundle modules, sidebar modules, and test
  data helpers.

## [0.7.6] - 2026-05-21

### Changed

- Add the GitHub Actions trusted publishing workflow for the `pangolint-mcp`
  npm package and document the active npm install channel.

## [0.7.5] - 2026-05-21

### Changed

- Publish the VS Code extension under the JD3 Lasers LLC Marketplace publisher
  identity and refresh install examples for `jd3lasersllc.pangolint`.

## [0.7.4] - 2026-05-21

### Fixed

- Preserve Talk TCP command send accounting when BEYOND receives a command but
  its reply times out, so auto UDP fallback and write-verify restore decisions
  do not treat the command as unsent.
- Restore browser back and forward navigation in the offline reference site
  when moving between command and Object Tree detail hashes.
- Reject malformed Commands webview action messages that omit required string
  payloads.

## [0.7.3] - 2026-05-20

### Fixed

- Stabilize repository line-ending policy across Windows and macOS so JSONL,
  HTML, and other text files keep LF checkouts while `.BeyondCode` fixtures
  keep CRLF for BEYOND paste behavior.
- Add shared EditorConfig settings matching the Git attributes line-ending
  policy.

## [0.7.2] - 2026-05-20

### Fixed

- Preserve the BEYOND underscore separator when redacting FB3 and FB4 hardware
  Object Tree roots, so public reference data shows `FB3_XXXXX` and
  `FB4_XXXXX` instead of dashed placeholders.

## [0.7.1] - 2026-05-20

### Changed

- Standardize Object Tree reference detail property rows so Schemas, Universe
  Components, Cue Types, and FX Effects all show one full Object Tree path chip
  with the OSC path below.

## [0.7.0] - 2026-05-20

### Added

- Suggest current-file labels after `Goto` and `If ... Goto` in the VS Code
  editor while preserving declared variable goto-target behavior.

## [0.6.4] - 2026-05-20

### Fixed

- Update changelog comparison links so release preflight can package the
  current GitHub Release artifact set.

## [0.6.3] - 2026-05-19

### Added

- Add a repo-policy test for maintained written content so long dash
  characters and blocked planning wording do not drift back into docs,
  comments, public strings, issue guidance, or PR guidance.

### Changed

- Normalize maintained docs and code comments to the written-content naming
  policy, with attributed examples and generated package staging left outside
  the enforced surface.

## [0.6.2] - 2026-05-19

### Fixed

- Focus command deep links in the offline reference page when opening from the
  sidebar, including case or alias hash variants and stale hash fallbacks.

## [0.6.1] - 2026-05-19

### Fixed

- Route readback `OscOutTTS` sends through the configured Talk transport so
  Talk TCP mode keeps command status for VS Code and MCP readbacks.

## [0.6.0] - 2026-05-19

### Added

- Prefer BEYOND Talk TCP for runtime command sends, with structured command
  replies, BEYOND error mapping, password redaction, and explicit Talk UDP
  fallback controls.
- Add MCP `checkTalkConnection` for Talk TCP greeting, `Echo 1`, `Hello`, and
  `Version` checks.

### Changed

- Surface Talk TCP status in `PangoLint: Run`, MCP `runScript`, runtime
  settings, and operator documentation while keeping OSC readback as the state
  proof path.

## [0.5.0] - 2026-05-19

### Added

- Add a Universe Components section to the offline Object Tree reference so
  Button, Drop Effect, Projection Zone, and related component types can be
  browsed directly.

### Changed

- Polish Object Tree reference table layout and visible value and behavior
  labels while keeping internal Object Tree metadata unchanged.

## [0.4.10] - 2026-05-19

### Changed

- Polish reference-site safety labels and Object Tree metadata display while
  keeping internal safety tiers and Object Tree metadata unchanged.

## [0.4.9] - 2026-05-19

### Changed

- Guard reference-site and extension-host source ownership with local README
  files, stricter source-layout tests, and synced architecture docs.

## [0.4.8] - 2026-05-19

### Changed

- Split Object Tree property index generation into named script modules without
  changing the generated runtime index or adding a compatibility layer.

## [0.4.7] - 2026-05-19

### Changed

- Split reference detail rendering into named source modules without changing
  the generated reference output or adding a compatibility layer.

## [0.4.6] - 2026-05-19

### Changed

- Split language diagnostics into named source modules without changing the
  diagnostic API or adding a compatibility layer.

## [0.4.5] - 2026-05-19

### Fixed

- Restore issue-start workflow script support for Node 25 when the silent git
  fetch path ignores stdout.

## [0.4.4] - 2026-05-19

### Added

- Add maintainer workflow scripts for issue branch startup, pull request
  readiness checks, and GitHub Release artifact verification.

## [0.4.3] - 2026-05-19

### Added

- Surface tracked OSC control routes in the generated PangoScript reference
  site for command detail pages and Object Tree property rows.
- Add public control route documentation and MCP/manual entries for the
  property control lookup tools.
- Enforce a PR version policy in CI so every PR into `main` advances the root
  extension, MCP package, and lockfile versions together.

## [0.4.2] - 2026-05-18

### Fixed

- Keep the mobile reference site in browse mode when switching between Commands
  and Object Tree sections with a preserved selection from another mode.
- Prevent stale preserved selections from driving the visible reference detail
  pane or URL hash outside their active mode.

## [0.4.1] - 2026-05-18

### Fixed

- Hide internal Object Tree readback and write-test status labels from the VS
  Code Objects sidebar property summaries.

## [0.4.0] - 2026-05-18

Initial public release.

### Added

- Conservative `.BeyondCode` language support for Pangolin BEYOND PangoScript,
  including TextMate grammar, semantic tokens, formatter, snippets, color
  decorators, label navigation, hover cards, completions, signature help, and
  quick fixes.
- PangoScript diagnostics for known syntax hazards, unsupported operators,
  unsupported loop shapes, command argument counts, missing labels,
  uninitialized variables, unused labels, unused variables, and Object Tree
  property typos.
- PangoLint sidebar with Commands, Objects, Diagnostics, and BEYOND Watcher
  views.
- Offline PangoScript reference site bundled into the VSIX.
- Curated command knowledge for 529 PangoScript commands plus expression
  functions and Object Tree runtime indexes.
- Optional BEYOND runtime readback and property tools, gated by trusted
  workspace checks, explicit settings, and per-run confirmation for writes.
- `pangolint-mcp`, a companion MCP server exposing the same command, object,
  diagnostics, and lint knowledge to MCP-aware coding tools.
- Public package gates for VSIX and MCP tarball contents.
- Attributed PaingoScripts examples from Jeff Vyduna's repository under
  `docs/references/beyond/pangoscript/working-examples/jvyduna/`, preserving
  upstream attribution and CC BY-SA 4.0 license notice.

### Notes

- PangoLint is independent open-source software and is not affiliated with,
  endorsed by, or sponsored by Pangolin Laser Systems, Inc.
- PangoLint ships curated metadata derived from BEYOND's documented exports and
  public reference material. It does not redistribute Pangolin manuals, help
  files, BEYOND command export text, or OSC HTML.

[Unreleased]: https://github.com/JD3Lasers/PangoLint/compare/v0.7.30...HEAD
[0.7.30]: https://github.com/JD3Lasers/PangoLint/compare/v0.7.29...v0.7.30
[0.7.29]: https://github.com/JD3Lasers/PangoLint/compare/v0.7.28...v0.7.29
[0.7.28]: https://github.com/JD3Lasers/PangoLint/compare/v0.7.27...v0.7.28
[0.7.27]: https://github.com/JD3Lasers/PangoLint/compare/v0.7.25...v0.7.27
[0.7.25]: https://github.com/JD3Lasers/PangoLint/compare/v0.7.24...v0.7.25
[0.7.24]: https://github.com/JD3Lasers/PangoLint/compare/v0.7.23...v0.7.24
[0.7.23]: https://github.com/JD3Lasers/PangoLint/compare/v0.7.22...v0.7.23
[0.7.22]: https://github.com/JD3Lasers/PangoLint/compare/v0.7.21...v0.7.22
[0.7.21]: https://github.com/JD3Lasers/PangoLint/compare/v0.7.20...v0.7.21
[0.7.20]: https://github.com/JD3Lasers/PangoLint/compare/v0.7.6...v0.7.20
[0.7.6]: https://github.com/JD3Lasers/PangoLint/compare/v0.7.5...v0.7.6
[0.7.5]: https://github.com/JD3Lasers/PangoLint/compare/v0.7.4...v0.7.5
[0.7.4]: https://github.com/JD3Lasers/PangoLint/compare/v0.7.3...v0.7.4
[0.7.3]: https://github.com/JD3Lasers/PangoLint/compare/v0.7.2...v0.7.3
[0.7.2]: https://github.com/JD3Lasers/PangoLint/compare/v0.7.1...v0.7.2
[0.7.1]: https://github.com/JD3Lasers/PangoLint/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/JD3Lasers/PangoLint/compare/v0.6.4...v0.7.0
[0.6.4]: https://github.com/JD3Lasers/PangoLint/compare/99b5626713295d0aa5be44edf6ec630a6eb9ac8b...v0.6.4
[0.6.3]: https://github.com/JD3Lasers/PangoLint/compare/5fbfafbe8aad3d768fca306ef163b6809aa1e7b2...99b5626713295d0aa5be44edf6ec630a6eb9ac8b
[0.6.2]: https://github.com/JD3Lasers/PangoLint/compare/776ebc7651739c6564887f68bf5980522527befd...5fbfafbe8aad3d768fca306ef163b6809aa1e7b2
[0.6.1]: https://github.com/JD3Lasers/PangoLint/compare/v0.6.0...776ebc7651739c6564887f68bf5980522527befd
[0.6.0]: https://github.com/JD3Lasers/PangoLint/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/JD3Lasers/PangoLint/compare/v0.4.10...v0.5.0
[0.4.10]: https://github.com/JD3Lasers/PangoLint/compare/v0.4.9...v0.4.10
[0.4.9]: https://github.com/JD3Lasers/PangoLint/compare/v0.4.8...v0.4.9
[0.4.8]: https://github.com/JD3Lasers/PangoLint/compare/v0.4.7...v0.4.8
[0.4.7]: https://github.com/JD3Lasers/PangoLint/compare/v0.4.6...v0.4.7
[0.4.6]: https://github.com/JD3Lasers/PangoLint/compare/v0.4.5...v0.4.6
[0.4.5]: https://github.com/JD3Lasers/PangoLint/compare/v0.4.4...v0.4.5
[0.4.4]: https://github.com/JD3Lasers/PangoLint/compare/v0.4.3...v0.4.4
[0.4.3]: https://github.com/JD3Lasers/PangoLint/compare/v0.4.2...v0.4.3
[0.4.2]: https://github.com/JD3Lasers/PangoLint/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/JD3Lasers/PangoLint/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/JD3Lasers/PangoLint/releases/tag/v0.4.0
