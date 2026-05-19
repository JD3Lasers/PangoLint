# PangoLint

Conservative linting, formatting, and BEYOND runtime readback checks for Pangolin BEYOND PangoScript, plus the PangoLint MCP server (`pangolint-mcp`) that exposes the same curated knowledge to AI coding agents.

> **End-user manual:** <https://jd3lasers.github.io/PangoLint/manual.html> is the end-to-end feature reference for diagnostics, sidebar, runtime integration, settings, commands, and troubleshooting, with screenshots of every feature. The source copy lives at [`docs/manual.html`](docs/manual.html).
>
> **PangoScript reference browser:** <https://jd3lasers.github.io/PangoLint/reference/> is the published searchable command and Object Tree reference.

## What you get

- **`.BeyondCode` language support**: TextMate grammar plus semantic tokens that distinguish curated commands from unknown identifiers, so typos are easy to spot.
- **21 diagnostic codes**: from real syntax errors (unclosed strings, unbalanced parens) to PangoScript-specific hints (unsupported `While`/`Loop`, `!=` instead of `<>`, `&&` instead of `and`, `for x = a to b` instead of `for x = a, b`, missing terminal `exit`, and more). Every code has a `Why?` action that opens the bundled rule reference offline.
- **Catalog-aware completions, hover cards, and signature help**: backed by the bundled PangoScript command catalog, Object Tree property data, and tracked OSC control route links. Hovers show syntax form, parameters, safety tier, and a primary example.
- **Quick fixes**: accept Levenshtein-ranked replacements for `unknown-command` warnings and `property-typo` hints, or register an unknown root as a user universe, zone alias, or master alias.
- **PangoLint sidebar**: four stacked panels (Commands, Objects, Diagnostics, BEYOND Watcher). The Commands panel groups browsable commands and expression functions into categories with full-text search, inline detail panels, `Cmd+Enter` insert at cursor, and deep links into the bundled offline PangoScript reference site. The Objects panel browses FX Effects, Cue Types, Object Tree roots, and schema data with an OSC-address toggle.
- **Conservative formatter**: preserves command order, strings, comments, labels, and any unknown syntax verbatim.
- **10 snippets**: `loop`, `for`, `ifguard`, `oscread`, `oscfeedback`, `script`, `onclick`, `var`, `selectzone`, `zonewrite`.
- **Color decorators**: inline swatches for `ColorBGR`, `ColorRGB`, and `<Object>.Color = <int>` literals. Click to open VS Code's color picker.
- **Label-aware navigation**: `F12` Go to Definition on `Goto MyLabel` jumps to the declaration. Cursor on any label highlights every other occurrence.
- **Optional, opt-in BEYOND runtime tools**: `Test BEYOND Connection`, fetch or set property values, pin properties to the BEYOND Watcher, validate every property path in the active file, and augment hover tooltips with live BEYOND values. Every write path is gated by `pangolint.beyond.allowScriptExecution` plus a per-run confirm modal.
- **PangoLint MCP server** (`pangolint-mcp`): the same curated knowledge exposed to AI coding agents (Claude Desktop, Claude Code, Cursor, VS Code with MCP). See [section 05 of the manual](https://jd3lasers.github.io/PangoLint/manual.html#mcp-server).

## Install

PangoLint is not on the VS Code Marketplace yet. Install from a [GitHub Release VSIX](https://github.com/JD3Lasers/PangoLint/releases/latest), or build one locally:

```bash
npm ci
npm run package:vsix
code --install-extension pangolint-0.4.7.vsix --force
```

Reload the VS Code window after installing. To uninstall:

```bash
code --uninstall-extension jd3.pangolint
```

## BEYOND runtime setup (optional)

To enable runtime features, point PangoLint at your developer-local BEYOND:

```jsonc
// .vscode/settings.json
{
  "pangolint.beyond.talkHost": "127.0.0.1",     // replace if BEYOND runs elsewhere
  "pangolint.beyond.talkPort": 16062,
  "pangolint.beyond.oscListenPort": 7000,
  "pangolint.beyond.allowScriptExecution": true // required for any send
}
```

Then run **PangoLint: Test BEYOND Connection** from the Command Palette. The connection check is readback-only (an `OscOutTTS` ping). It does not change projector, output, geometry, or zoning state. See [section 04 of the manual](https://jd3lasers.github.io/PangoLint/manual.html#beyond-runtime) for the full runtime workflow and safety gates.

## Format on save (optional)

```jsonc
// .vscode/settings.json
{
  "[pangoscript]": {
    "editor.defaultFormatter": "jd3.pangolint",
    "editor.formatOnSave": true
  }
}
```

## License & trademark notice

PangoLint is licensed under the **GNU General Public License v3.0 or later** (see [LICENSE](LICENSE)). PangoLint is independent open-source software.

**PangoLint is not affiliated with, endorsed by, or sponsored by Pangolin Laser Systems, Inc.** "Pangolin", "BEYOND", and "PangoScript" are trademarks of Pangolin Laser Systems, Inc., used here nominatively to describe what PangoLint works with. Use of PangoLint with BEYOND requires a separate, valid Pangolin license.

The command and property metadata bundled with PangoLint is derived from BEYOND's documented exports and the public reference materials Pangolin publishes. Reference sources:

- Pangolin's official site: <https://www.pangolin.com>
- BEYOND product page: <https://pangolin.com/pages/beyond>
- Pangolin support and documentation hub: <https://support.pangolin.com>

If you are a Pangolin representative and have concerns about PangoLint's contents or scope, please open an issue at <https://github.com/JD3Lasers/PangoLint/issues>.

## Contributing

Build instructions, packaging gates, and public contribution guidance live in [`CONTRIBUTING.md`](CONTRIBUTING.md).
