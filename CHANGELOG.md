# Changelog

Notable public changes to PangoLint. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/JD3Lasers/PangoLint/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/JD3Lasers/PangoLint/releases/tag/v0.4.0
