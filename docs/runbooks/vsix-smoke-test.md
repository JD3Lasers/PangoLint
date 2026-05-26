# PangoLint VSIX Smoke Test

Companion fixture: [vsix-smoke-test.BeyondCode](vsix-smoke-test.BeyondCode).

Runs against a freshly built `pangolint-<version>.vsix`. The goal is to confirm
the packaged extension activates, registers the language, surfaces the smoke
diagnostics from `src/language/diagnostics.ts`, exposes the contributed palette
commands, and respects the conservative formatter contract.

This is a manual-plus-automated smoke. `npm run test:extension-host` covers
activation, diagnostics, formatting, hover, command registration, and sidebar
command registration. The visual/editor interaction checks below still need a
human pass in VS Code.

## 1. Build a fresh VSIX

From the repo root in PowerShell:

```powershell
npm ci
npm run check
npm run package:vsix
```

`package:vsix` chains `npm run check:public`, `vsce package --no-dependencies`,
and the cross-platform SHA256 writer. On success it writes
`pangolint-<version>.vsix` and `pangolint.vsix.sha256` into the repo root. Verify
the size is in the expected hundreds-of-KB range and that `dist/extension.js`
and `data/pangoscript/commands.merged.json` are present in the package:

```powershell
npx vsce ls --no-dependencies | Select-String -Pattern "extension.js|commands.merged"
```

If `verifyPackageContents` fails, fix the underlying issue. Do not pass go.

## 2. Install into VS Code

Pick one path.

### Option A - VS Code CLI

```powershell
code --install-extension .\pangolint-<version>.vsix --force
```

Restart VS Code (or use `Developer: Reload Window` from the palette) so the
extension activates against any open `.BeyondCode` files.

### Option B - Extensions panel

1. `Ctrl+Shift+X` to open the Extensions view.
2. Click the `…` menu (top of the panel) → **Install from VSIX…**.
3. Pick the freshly built `pangolint-<version>.vsix`.
4. Reload the window when prompted.

### Verify install

- Extensions view shows **PangoLint** at the packaged version (publisher `jd3lasersllc`).
- Open `docs/runbooks/vsix-smoke-test.BeyondCode`. The status bar should read
  **PangoScript** as the language mode.

## 3. Walk the fixture

Open `docs/runbooks/vsix-smoke-test.BeyondCode`. Diagnostics should populate
within a second or two of activation.

Map of expected diagnostics - line numbers reference the fixture as committed:

| Fixture lines | Code | Severity | Notes |
|---|---|---|---|
| 9-12  (`SelectZone 1`, `Brightness 50`, `WaitForBeat 4`, `DisplayPopup`) | - | none | Known commands; clean. |
| 15 (`TotallyMadeUpCommand 99`) | `unknown-command` | warning | Yellow squiggle on the command name. |
| 18 (`DisplayPopup "no closing quote`) | `unclosed-string` | error | Red squiggle, full-line range. |
| 21 (`if ((1 > 0) DisplayPopup "bad"`) | `unbalanced-parentheses` | warning | |
| 24-25 (inline label + goto) | - | none | `mylabel:` is collected; goto resolves. |
| 28 (`goto DefinitelyNotALabel`) | `missing-label` | warning | Bare missing target. Quoted targets are BEYOND-rejected and covered by `unsupported-quoted-goto-label`. |
| 31-32 (`var zoneName` then `OscOutTTS` reading it) | `uninitialized-variable` | warning | Squiggle on the `zoneName` identifier in the OscOutTTS arg list. |
| 35-37 (`var beatRate`, assign 120, then read) | - | none | Confirms assignment-then-read suppresses the warning. |
| 40-42 (`zoneBrightness = Zone.0.Brightness`, then OSC address with `<zoneBrightness>`) | - | none | Confirms dotted property access is preserved by the permissive parser posture. |
| End of file (fixture intentionally has no final `exit`) | `missing-terminal-exit` | hint | BEYOND accepts this shape; PangoLint recommends `exit` as a fall-through guard. |

Total expected PangoLint diagnostics: **6** - one each of `unknown-command`,
`unclosed-string`, `unbalanced-parentheses`, `missing-label`,
`uninitialized-variable`, and `missing-terminal-exit`.

The PangoLint Diagnostics sidebar should show all 6 groups. VS Code's lower
Problems panel may show **5** entries because it counts the error and warning
diagnostics but may omit the hint-level `missing-terminal-exit` from that lower
panel count. That is acceptable as long as the PangoLint Diagnostics sidebar
shows `missing-terminal-exit` and no unexpected diagnostics are present.

If anything is missing or extra, capture the Problems output and stop. Do not
record the smoke as passing.

## 4. Editor feature checks

Still in the fixture file:

- **Syntax highlighting.** Keywords, strings, comments, and numbers should
  colorize per the TextMate grammar in `syntaxes/pangoscript.tmLanguage.json`.
- **Completions.** Position the cursor on a blank line, type `Sel`, hit
  `Ctrl+Space`. `SelectZone` should be in the suggestion list (sourced from
  the merged knowledge base).
- **Format Document.** Run `Shift+Alt+F` (or palette →
  *Format Document*). The buffer should be byte-identical save for the
  formatter's documented low-risk transforms - strings, comments, labels,
  command order, and Delphi-shaped expressions must be preserved. If the
  formatter mutates the unclosed string, the unbalanced parens, or the
  property-access line, treat that as a failure.

## 5. Palette commands

Open the command palette (`Ctrl+Shift+P`) and run each of:

- **PangoLint: Validate Current Script** - should run against the active
  buffer, write a detailed report to the **PangoLint: Validation** Output
  channel, reveal that Output channel when diagnostics exist, and show a
  notification with a diagnostic count matching the table in step 3 (6). The
  notification should expose actions for **Show Diagnostics**, **Show Output**,
  and **Open Problems**.
- **PangoLint: Test BEYOND Connection** - should attempt the readback-only
  `OscOutTTS` ping. Without a real BEYOND host on the configured
  `pangolint.beyond.talkHost:talkPort` target (default `127.0.0.1:16062`),
  expect a notification along the lines of *"BEYOND readback failed: Timed
  out after 3000 ms"* after the configured `readbackTimeoutMs`. A timeout is
  the **expected** result here - anything else (immediate bind error,
  silent failure, unhandled exception) is a smoke failure.

If you do have a BEYOND host reachable, a successful connection check should surface
a callback with the readback request ID echoed back, per the readback
contract in `src/runtime/readback/beyondReadback.ts`.

## 6. Sidebar copy checks

Open the PangoLint activity bar views:

- **Commands.** Right-click `SelectZone` in the Commands sidebar. **Copy
  command** should place `SelectZone` on the clipboard, and **Copy signature**
  should place that command's displayed signature on the clipboard.
- **Objects.** Right-click a property path such as `Master.BPM` or
  `Zone.0.Brightness` in the Objects sidebar. **Copy path** should place the
  displayed path on the clipboard. Toggle the PS/OSC mode and confirm the
  copied value follows the displayed format.

## 7. Pass / fail checklist

Mark each ☐ as you go:

- ☐ VSIX builds, `verifyPackageContents` passes, file size sane.
- ☐ Install via CLI or VSIX panel succeeds; reload picks up the extension.
- ☐ Status bar shows `PangoScript` for `.BeyondCode` files.
- ☐ PangoLint Diagnostics sidebar shows exactly the 6 diagnostics in step 3,
  with matching codes and severities.
- ☐ VS Code's lower Problems panel shows the 5 error/warning diagnostics, or
  shows all 6 if the current VS Code version includes hints in that view.
- ☐ Inline label/goto and Delphi property access produce **no** warnings.
- ☐ Completions show `SelectZone` from a `Sel` prefix.
- ☐ Format Document preserves strings, comments, labels, parens, and
  property/index access.
- ☐ `PangoLint: Validate Current Script` reports 6 diagnostics, opens the
  **PangoLint: Validation** Output channel, and lists each diagnostic with
  severity, code, line/column, and message.
- ☐ `PangoLint: Test BEYOND Connection` returns a clean timeout (or echoed callback
  if a real host is up).
- ☐ Commands sidebar right-click copy actions place the command name and
  signature on the clipboard.
- ☐ Objects sidebar right-click **Copy path** places the displayed property path
  on the clipboard in both PS and OSC modes.

When every box is ticked, record the smoke result in the release issue or PR.

## 8. Rollback

If the install misbehaves or you want a clean slate:

```powershell
code --uninstall-extension jd3lasersllc.pangolint
```

Then reload VS Code. The extension carries no persistent state outside its
configured `pangolint.beyond.*` settings, so uninstall is non-destructive.

## Known gaps

- The automated extension-host suite does not visually verify TextMate colors,
  completion UI rendering, signature-help UI rendering, or sidebar webview
  layout. Keep the manual fixture pass for those surfaces.
