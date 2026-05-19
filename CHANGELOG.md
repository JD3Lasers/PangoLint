# Changelog

Notable public changes to PangoLint. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/JD3Lasers/PangoLint/compare/v0.4.9...HEAD
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
