# PangoLint User Manual

PangoLint is developer tooling for **Pangolin BEYOND PangoScript**.
This manual is the end-user reference for everything the project ships:
the VS Code extension and the companion `pangolint-mcp` server for AI
coding agents.

> **Quick orientation.** If you write `.BeyondCode` files in VS Code,
> install the extension. If you also work with an AI coding agent
> (Claude, Codex, Cursor, etc) and want it to verify
> command names against PangoLint's curated catalog and lint generated
> PangoScript, also install the MCP server. Both ship from the same
> repo and read the same curated knowledge base.
>
> **Reference data.** PangoLint ships a curated knowledge base of
> command names, signatures, and object-tree property paths. It does
> **not** redistribute Pangolin manuals, help files, BEYOND command
> exports, OSC HTML, or any other verbatim Pangolin reference
> material. See [Safety, privacy, and data](#safety-privacy-and-data).

## Contents

- [Quick start](#quick-start)
- [The editor](#the-editor)
  - [Syntax & semantic highlighting](#syntax--semantic-highlighting)
  - [Diagnostics](#diagnostics)
  - [Completions, hover, signature help](#completions-hover-signature-help)
  - [Quick fixes](#quick-fixes)
  - [Formatting](#formatting)
  - [Snippets](#snippets)
  - [Color decorators](#color-decorators)
  - [Navigation: Goto label, references, label highlighting](#navigation-goto-label-references-label-highlighting)
- [The sidebar](#the-sidebar)
  - [Commands view](#commands-view)
  - [Objects view](#objects-view)
  - [Diagnostics view](#diagnostics-view)
- [BEYOND runtime integration](#beyond-runtime-integration)
  - [Test BEYOND connection](#test-beyond-connection)
  - [User objects (register a universe / zone alias)](#user-objects-register-a-universe--zone-alias)
  - [Send Talk batch to BEYOND](#send-talk-batch-to-beyond)
  - [Fetch / set object values](#fetch--set-object-values)
  - [Watcher: pin a property](#watcher-pin-a-property)
  - [Validate objects in this file against BEYOND](#validate-objects-in-this-file-against-beyond)
  - [Live hover values](#live-hover-values)
- [The PangoLint MCP server](#the-pangolint-mcp-server)
  - [When to use it](#when-to-use-it)
  - [Install & configure](#install--configure)
  - [Knowledge tools (always on)](#knowledge-tools-always-on)
  - [Runtime tools (opt-in)](#runtime-tools-opt-in)
  - [MCP resources](#mcp-resources)
- [Reference: settings](#reference-settings)
- [Reference: commands](#reference-commands)
- [Reference: keybindings](#reference-keybindings)
- [Safety, privacy, and data](#safety-privacy-and-data)
- [Troubleshooting](#troubleshooting)

---

## Quick start

1. Install the VS Code extension from the Marketplace:

   ```bash
   code --install-extension jd3lasersllc.pangolint
   ```

2. Open any `.BeyondCode` file. Syntax highlighting, diagnostics,
   completions, and the activity-bar sidebar light up automatically.
3. Open the **PangoLint** view container (laser-warning icon in the
   activity bar) to browse commands and objects.
4. To enable BEYOND runtime features, configure
   `pangolint.beyond.talkTcpHost` to point at your dev BEYOND machine
   (and `pangolint.beyond.talkTcpPort` if needed), then run
   `PangoLint: Test BEYOND Connection` from the Command Palette.

That's it for the extension. For the MCP server, see
[The PangoLint MCP server](#the-pangolint-mcp-server) below.

---

## The editor

### Syntax & semantic highlighting

PangoLint registers `.BeyondCode` as the `pangoscript` language. You get:

- TextMate grammar with scopes for labels, commands, expression
  functions, variables, object paths, operators, OSC addresses, and
  string/comment forms.
- Semantic tokens so commands that PangoLint actually knows about render
  differently from unknown identifiers - useful for spotting typos at a
  glance.
- A document outline (Outline view, breadcrumbs) generated from script
  labels.

### Diagnostics

PangoLint ships **22 diagnostic codes**. The full reference with cause
and how-to-fix lives in
[docs/references/diagnostics/README.md](references/diagnostics/README.md);
this is the summary.

| Code | Severity | What it catches |
|---|---|---|
| `analysis-limited` | warning | PangoLint skipped a full-file pass or unusually long line because the input exceeds bounded-analysis limits. Runtime sends are blocked until the file can be fully checked. |
| `unclosed-string` | error | A line opens `"` with no closing quote. |
| `unbalanced-parentheses` | warning | Unequal `(` / `)`, or `)(` order. |
| `unknown-command` | warning | Identifier isn't in the curated catalog and isn't a recognized control-flow keyword. |
| `wrong-arg-count` | warning | Curated command called with the wrong number of arguments. Includes the zero-arity case (`EnableLaserOutput 1`). |
| `missing-label` | warning | `Goto X` jumps to a label that doesn't exist in the file. |
| `unsupported-quoted-goto-label` | warning | `Goto "X"` - quoted labels aren't recognized by BEYOND. |
| `uninitialized-variable` | hint | `var` is read before any assignment. |
| `unsupported-loop` | hint | `While`/`Do`/`Repeat`/`Until`/`Loop` - points to the label + `If <cond> Goto <label>` pattern. |
| `unsupported-for-range-syntax` | hint | `for x = a to b` - BEYOND only supports `for x = a, b`. |
| `unsupported-logical-operator` | hint | `&&` / `\|\|` - BEYOND uses `and`/`or` only. |
| `unsupported-bang-not-equal-operator` | hint | `!=` - BEYOND uses `<>`. |
| `unsupported-property-index-access` | warning | Direct reads of `Zone.0.Points[0].X` - BEYOND reports invalid array index. |
| `unsupported-deltavalue-assignment` | warning | `DeltaValue = …` outside its allowed editor context. |
| `unsupported-deltavalue-command-argument` | warning | `DeltaValue` passed as a command argument outside trigger handlers. |
| `deltavalue-midi-slot-context` | hint | `DeltaValue` MIDI slot context misalignment. |
| `unsupported-exit-semicolon` | hint | `exit;` - BEYOND wants bare `exit`. |
| `missing-terminal-exit` | hint | Script doesn't end with `exit`. |
| `extvalue-define-midi-trigger-default` | hint | `ExtValue` editor default in a `DefineMidiTrigger` body. |
| `unused-variable` | hint | `var x` declared but never referenced. |
| `unused-label` | hint | Label declared but never `Goto`'d. |
| `property-typo` | hint | `Object.PropertyName` doesn't match a known property; suggests the closest valid name. |

PangoLint biases **permissive** - most rules are warning or hint level.
Real errors are reserved for unambiguous syntax failures (`unclosed-string`,
unbalanced parens). Click any diagnostic in the **Diagnostics** sidebar
panel and use the `Why?` action to open the bundled reference scrolled
to that rule's section.

Run **PangoLint: Validate Current Script** from the Command Palette to
refresh diagnostics for the active `.BeyondCode` buffer and write a
portable report to the **PangoLint: Validation** Output channel. The
report lists severity, rule code, line / column, and the same
human-readable explanation shown by the editor hover. The completion
toast offers shortcuts to the Diagnostics sidebar, the Output channel,
and the Problems panel.

### Completions, hover, signature help

- **Command completions** - type a command name and PangoLint suggests
  matches from the bundled catalog (529 command entries). Each
  suggestion carries a description, syntax form, and safety tier.
- **Property completions** - type `Master.` (or `Zone.0.`, `FX.0.`,
  etc.) and PangoLint suggests properties from the schemas.
- **Goto label completions** - after `Goto ` or `If ... Goto `,
  PangoLint suggests labels declared in the current file. Declared
  variable goto targets keep their variable-reference behavior.
- **Hover tooltips** - hover any command name for a Markdown card with
  the syntax form, parameters, safety tier, and a primary example.
  Hover an object path for property listings, with segment-aware
  detail (root, array index/button name, property segment).
- **Signature help** - start typing a command's arguments to get an
  inline signature panel with parameter names, types, and ranges.

### Quick fixes

Click the lightbulb (or `Cmd+.` / `Ctrl+.`) on:

- An `unknown-command` warning - accept a Levenshtein-ranked
  replacement.
- A `property-typo` hint - accept the closest valid property name.
- An unknown property-path root - register it as a **user universe**
  (inherits `UniversePanel`), a **zone alias** (inherits `Zone`), or a
  **master alias** (inherits `Master`). See
  [User objects](#user-objects-register-a-universe--zone-alias).

### Formatting

Run **Format Document** (`Shift+Alt+F`) or wire format-on-save:

```jsonc
// .vscode/settings.json
{
  "[pangoscript]": {
    "editor.defaultFormatter": "jd3lasersllc.pangolint",
    "editor.formatOnSave": true
  }
}
```

The formatter is **intentionally conservative**:

- Preserves command order, strings, comments, labels, and unknown
  syntax verbatim.
- Normalizes whitespace and indentation only where it can do so safely.
- Will not collapse, reorder, or transform any line it doesn't fully
  recognize.

### Snippets

Type the prefix and press `Tab`. All 10 snippets:

| Prefix | Inserts |
|---|---|
| `loop` | Label + `if (cond) goto label` loop scaffold with `exit`. |
| `for` | Counted `i = 1; loop; i = i + 1; if (i <= 10) goto loop` pattern. |
| `ifguard` | `if (cond) goto afterBlock; … afterBlock:` skip pattern. |
| `oscread` | `OscOutTTS` readback skeleton with a typed return. |
| `oscfeedback` | `RegisterOscFeedback` with a run-prefixed cleanup. |
| `script` | `BeginScript` / `EndScript` wrapper. |
| `onclick` | `OnClick:` handler with an init guard. |
| `var` | `var name; name = 0` declaration + initial assignment. |
| `selectzone` | `SelectZone` + `ControlZone` destination prefix. |
| `zonewrite` | Direct `Zone.0.Brightness = 50` property assignment (recommended over the destination-prefix form). |

### Color decorators

Inline color swatches appear in the gutter for:

- `ColorBGR <hex>` literals
- `ColorRGB <hex>` literals
- `<Object>.Color = <int>` literal assignments

Click the swatch to open VS Code's color picker. The picker round-trips
the change back into the source format (BGR stays BGR, RGB stays RGB,
integer literals stay integer literals).

### Navigation: Goto label, references, label highlighting

- **Go to Definition** (`F12`) on `Goto MyLabel` jumps to `MyLabel:`.
- Cursor on a label (declaration or any `Goto` reference) **highlights
  every other occurrence** in the file.
- Optional **References code lens** above each label declaration -
  enable with `pangolint.codeLens.labelReferences: true`.

---

## The sidebar

Click the laser-warning icon in the activity bar. The **PangoLint** view
container has four stacked panels: Commands, Objects, Diagnostics, and
the BEYOND Watcher.

### Commands view

A webview browser over 521 browsable PangoScript commands plus 7 expression
functions. Prototype, internal, and do-not-use commands remain known for
diagnostics and direct lookup, but stay out of the browsable list.

- **Full-text search** across canonical name, aliases, description, and
  BEYOND category. Type into the search box at the top.
- **Category strip** filters to one of the 35 categories the catalog
  is organized around - these mirror BEYOND-style command categories.
  Click a category chip to scope the list.
- Click any command row to expand the inline **detail panel** -
  signature, BEYOND category, primary example.
- Detail-panel actions:
  - **Insert at cursor** - drops the example into the active editor.
  - **Copy signature** - copies the syntax form to clipboard.
  - **View in full reference** - opens the bundled offline PangoScript
    reference site in your default browser, deep-linked to that command.
- **Keyboard insert.** With a row focused, press `Cmd+Enter` (macOS) /
  `Ctrl+Enter` (Windows / Linux) to insert the example at the cursor -
  no mouse needed.
- **Cross-link from the editor.** In any `.BeyondCode` file, hover a
  command name and click `View in Commands sidebar`, or right-click →
  `View in Commands sidebar`. The Commands view scrolls to that
  command and expands its detail panel.

### Objects view

A webview browser over BEYOND's object surface, organized into
three sections:

1. **FX Effects** - every visualizer FX category and effect.
2. **Cue Types** - every cue-type code with its description.
3. **Objects** - Master, Zone, UniversePanel, ColorChannel,
   DmxOutput, Projector, ProTrack, QShift, and the rest of the bundled
   schemas with their property listings.

Search filters across all three sections in one pass. Right-click any
property path:

- If a setter command is mapped, **Insert** drops it at the cursor
  (e.g. right-click `Master.BPM` → inserts `SetBpm`).
- **View in Commands sidebar** - jump to the matching command in the
  Commands view.

The Objects view reads only bundled data - no network access, no live
BEYOND inspection. (For live values, see
[Live hover values](#live-hover-values) and the
[Watcher](#watcher-pin-a-property).)

### Diagnostics view

Issues in the active `.BeyondCode` file, grouped by rule. Each rule
group has:

- A row per diagnostic. Click to jump to the source range.
- A `Why?` action that opens the bundled
  [diagnostics reference](references/diagnostics/README.md) scrolled
  to that rule's section - works offline, no internet needed.

---

## BEYOND runtime integration

PangoLint can talk to a developer-local BEYOND for connection checks,
property readbacks, and gated script-batch sends. **All runtime
features require a trusted workspace.** Readback-only features require
an explicit command or `pangolint.beyond.liveHoverValues: true`.
Write/script execution features additionally require
`pangolint.beyond.allowScriptExecution: true` and an in-app
confirmation prompt. Runtime target settings are machine-scoped so a
workspace cannot silently repoint PangoLint at a different BEYOND host.

> **Operator responsibility.** Runtime integration is intended for
> developer-local testing only. Users remain responsible for
> validating all scripts inside BEYOND and for following all laser
> safety, zoning, output, and show-control procedures. PangoLint's
> lint gate is a syntax check, not a safety check - it cannot
> reason about beam paths, audience separation, scan-fail behavior,
> or any other operational laser-safety concern.

### Test BEYOND connection

Command Palette → **PangoLint: Test BEYOND Connection**.

PangoLint sends a small `OscOutTTS` ping over the configured BEYOND
Talk path, then waits for the OSC echo on
`oscListenHost:oscListenPort`. The status bar reports success or the
specific failure mode (DNS lookup, bind, no callback, etc.).
**Readback-only** - no projector, output, geometry, or zoning state is
touched.

### User objects (register a universe / zone alias)

PangoScript code commonly references workspace-scoped identifiers like
`MyUniverse.Button1.X` or `MainStage.Brightness`. PangoLint doesn't
know these out of the box. When such a path appears, PangoLint surfaces
a code action lightbulb:

- **Register `<Root>` as a user universe** - inherits the
  `UniversePanel` schema, with workspace-scanned button names merged in
  as `arrayIndices`.
- **Register `<Root>` as a zone alias** - inherits the `Zone` schema.
- **Register `<Root>` as a master alias** - inherits the `Master`
  schema.

Registry persists at `.pangolint/user-objects.json` (workspace-rooted).
View / remove entries via **PangoLint: Show User Objects** and
**PangoLint: Remove User Object** in the Command Palette.

When `pangolint.folderScopedUniverses: true` (default), PangoLint also
auto-discovers universe panels by scanning sibling `.BeyondCode` files -
if an unknown root appears in 2+ files in the same parent folder, it's
treated as a universe panel without explicit classification. This
mirrors BEYOND's workspace-scoped object visibility.

### Send Talk batch to BEYOND

Two commands send straight-line PangoScript over BEYOND Talk:

- **PangoLint: Send Talk Batch to BEYOND** - sends the entire active
  `.BeyondCode` file.
- **PangoLint: Send Selection as Talk Batch** - sends just the
  highlighted selection. Right-click → `Send Selection as Talk Batch`
  works inside any `.BeyondCode` editor.

Both gates:

1. `pangolint.beyond.allowScriptExecution: true` - explicit opt-in.
2. Workspace must be **trusted**.
3. Confirm modal - by default, `confirmRunEachSession: true` shows
   the modal *every* run, not just the first. Recommended on for
   safety.
4. **Lint-before-send** refuses any text that fires an error-severity
   diagnostic, or any text where PangoLint's analysis limits prevent a
   full lint pass. Hint and warning diagnostics surface in the response
   but don't block.
5. **Control-flow blocked** - BEYOND Talk isn't editor-equivalent.
   PangoLint blocks labels, `goto`, `if`, loops, waits, and `exit` in
   this path. Paste full control-flow scripts directly into BEYOND's
   PangoScript editor instead.

After a successful send, **PangoLint: Re-send last Talk Batch** replays
the same batch (skips the lint, keeps the gates) - useful for tight
iteration when nothing's changed.

Talk TCP can show BEYOND command replies and parser errors in the
**PangoLint: Run** Output channel. Talk UDP is a valid primary transport,
but it is send-only from PangoLint's side, so the Output channel reports
datagram send status instead of BEYOND parser replies.

> **CRLF reminder.** BEYOND's PangoScript editor paste path treats
> LF-only clipboard text as one logical line. `.BeyondCode` files
> intentionally check out with CRLF endings. Confirm CRLF before
> copying when you bypass PangoLint and paste directly.

### Fetch / set object values

- **PangoLint: Fetch object value from BEYOND** - Command Palette or
  right-click → reads a property path you enter (e.g.
  `Master.Brightness`). Sends `OscOutTTS` with a typed return tag,
  awaits the OSC callback, and shows the value inline.
- **PangoLint: Set object value on BEYOND** - Command Palette or
  right-click → writes a value to a property path. Gated like
  [Send Talk batch](#send-talk-batch-to-beyond). String values are
  entered without wrapping quotes; PangoLint serializes exactly one
  assignment line before sending.

### Watcher: pin a property

The **PangoLint Watcher** view appears in the Explorer panel when at
least one property is pinned. Pin / unpin from the editor:

- Right-click a property path → **Pin property to BEYOND Watcher**.
- Right-click a watched item in the view → **Unpin from Watcher**.

Watcher view actions:

- **Refresh Watcher** - re-reads every pinned property in one batch.
- **Clear all watched properties**.

The watcher does **not** poll automatically - refreshes are explicit.
This keeps network traffic predictable.

### Validate objects in this file against BEYOND

Command Palette → **PangoLint: Validate objects in this file against
BEYOND**.

PangoLint walks every property path referenced in the active file and
issues a readback against BEYOND. Paths that resolve are cached as
live-confirmed; paths that time out or return an error are reported in
the **PangoLint: Run** Output channel and summarized in a notification.
Useful as a pre-flight before sending a script, especially when you've
added new universes / zone aliases since the last verified send.

### Live hover values

Set `pangolint.beyond.liveHoverValues: true` to augment property-path
hover tooltips with the current BEYOND value. Cached for 30 seconds per
path. **Off by default** - generates network traffic on every hover. A
nice quick-glance feature when actively tuning, but unnecessary the
rest of the time.

---

## The PangoLint MCP server

`pangolint-mcp` is a [Model Context Protocol](https://modelcontextprotocol.io)
stdio server that exposes the same curated knowledge to AI coding
agents. It ships from the `mcp/` workspace in this repo and reads from
the same `data/pangoscript/` knowledge base the extension uses, so
upgrades stay in lockstep.

### When to use it

- You ask Claude / Codex / Cursor / another agent to write or edit PangoScript
  and you want command-name verification against PangoLint's curated
  catalog, not hallucinated names from training data.
- You want the agent to lint generated PangoScript before showing you
  the result.
- (Opt-in) You want the agent to send lint-clean PangoScript to a
  developer-local BEYOND for fast visual feedback.

If you don't use AI agents in your PangoScript workflow, you don't
need the MCP server.

### Install & configure

Install the published package from npm:

```bash
npm install -g pangolint-mcp
which pangolint-mcp
```

Or install the `pangolint-mcp` tarball attached to a GitHub Release:

```bash
npm install -g ./pangolint-mcp-0.7.63.tgz
which pangolint-mcp
```

For local development, build the same tarball from this repo:

```bash
npm run package:mcp
npm install -g ./mcp/pangolint-mcp-0.7.63.tgz
which pangolint-mcp
```

Wire it into your MCP-aware client by adding a stdio entry:

Use `PangoLint` as the client-side server key when your client allows
mixed-case names. Some clients show this key in tool-call UI.

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "PangoLint": { "command": "pangolint-mcp" }
  }
}
```

**Claude Code** (`.claude/mcp.json` or your CLI's MCP config):

```json
{
  "mcpServers": {
    "PangoLint": { "command": "pangolint-mcp" }
  }
}
```

**Codex CLI**:

```bash
codex mcp add PangoLint -- "$(which pangolint-mcp)"
codex mcp get PangoLint
```

If the old lowercase `pangolint` alias is already registered, run
`codex mcp remove pangolint` first, then add it again.

To enable read runtime tools in Codex, add the startup env vars when
you register the server:

```bash
codex mcp add PangoLint \
  --env PANGOLINT_MCP_RUNTIME_READ=enabled \
  --env PANGOLINT_MCP_BEYOND_TALK_TRANSPORT=tcp \
  --env PANGOLINT_MCP_BEYOND_TALK_TCP_HOST=127.0.0.1 \
  --env PANGOLINT_MCP_BEYOND_TALK_TCP_PORT=16063 \
  -- "$(which pangolint-mcp)"
```

**Cursor / VS Code (with MCP)**:

```json
{
  "servers": {
    "PangoLint": { "command": "pangolint-mcp" }
  }
}
```

To enable read runtime tools (network access to a local BEYOND), pass
`PANGOLINT_MCP_RUNTIME_READ=enabled` and your BEYOND target as env
vars. Add `PANGOLINT_MCP_RUNTIME_WRITE=enabled` only when you also
want agents to send scripts through `runScript`.

```json
{
  "mcpServers": {
    "PangoLint": {
      "command": "pangolint-mcp",
      "env": {
        "PANGOLINT_MCP_RUNTIME_READ": "enabled",
        "PANGOLINT_MCP_BEYOND_TALK_TRANSPORT": "tcp",
        "PANGOLINT_MCP_BEYOND_TALK_TCP_HOST": "127.0.0.1",
        "PANGOLINT_MCP_BEYOND_TALK_TCP_PORT": "16063"
      }
    }
  }
}
```

The full env-var list lives in [mcp/README.md](../mcp/README.md).

### Knowledge tools (always on)

Eleven offline tools the agent can call without any opt-in:

| Tool | What it does |
|---|---|
| `lookupCommand` | Curated entry for one command name (canonical or alias). |
| `searchCommands` | Task-intent search over names, aliases, descriptions, categories, forms, parameters, notes, and tags, with optional `safetyTier` filter. |
| `lookupObject` | Unified object lookup for canonical schemas and exact Object Tree paths (for example `WS.N.N.Caption` and `FX.N.N.N.Oscillator.Period`). |
| `listObjects` | Object roots from canonical schemas plus Object Tree-only families such as `WS`, `FX`, and `DmxOutput`. |
| `searchObjectProperties` | Ranked search over BEYOND Object Tree property paths (e.g. `Master.ShowSpeed`, `FX.N.N.N.Oscillator.Period`). |
| `lookupObjectProperty` | Exact lookup for a single property path. |
| `lookupPropertyControls` | Exact property lookup with Object Tree path, direct `/b/` address, PangoScript command links, OSC routes, range data, readback, and behavior metadata. |
| `searchPropertyControls` | Search property controls by path, OSC route, command name, context, and value metadata. |
| `lintScript` | Run PangoLint diagnostics over text and return the structured diagnostic list. |
| `explainDiagnostic` | Markdown documentation for one diagnostic code. |
| `getServerConfig` | Current config and which tools are available. Agents are instructed to call this first. |

### Runtime tools (opt-in)

Four tools that talk to the configured BEYOND host. Read runtime and
write runtime are separate opt-ins. Each tool returns
`{ ok: false, blocked: true }` unless the matching runtime tier was
enabled at server startup.

| Tool | Tier | What it does |
|---|---|---|
| `healthCheck` | T0 | Requires `PANGOLINT_MCP_RUNTIME_READ=enabled`. DNS + UDP-socket reachability of the configured BEYOND UDP target. Doesn't verify BEYOND accepts commands. |
| `checkTalkConnection` | T0 | Requires `PANGOLINT_MCP_RUNTIME_READ=enabled`. Opens Talk TCP and checks greeting, configured `Echo` mode, `Hello`, and `Version` replies. |
| `readBeyondProperty` | T1 (read) | Requires `PANGOLINT_MCP_RUNTIME_READ=enabled`. Single readback of a property path (`Master.Brightness`, `Zone.0.Red`, …) and returns the value. Talk TCP readbacks use the configured `Echo` mode. |
| `runScript` | T2+ (write) | Requires `PANGOLINT_MCP_RUNTIME_WRITE=enabled`. Lints the supplied text; refuses on any error-severity diagnostic; otherwise sends via configured BEYOND Talk transport. Talk TCP reports the selected `Echo` mode. |

`runScript`'s lint-before-send gate is the **load-bearing developer
behavior**: `runScript` blocks script text that produces an
error-severity PangoLint diagnostic before any BEYOND Talk send is
attempted. Hint and warning diagnostics surface in the response but
don't block the send. This is a syntax gate, not a safety gate - it
does not validate operational laser-safety concerns.

### MCP resources

Eight resources for browsing the bundled knowledge base directly:

| URI | Contents |
|---|---|
| `pangoscript://catalog/commands` | Command catalog (JSON). |
| `pangoscript://schemas/objects` |  Object schema (JSON). |
| `pangoscript://diagnostics/codes` | Diagnostics doc page (Markdown). |
| `pangoscript://reference/operators` | Operator reference (Markdown). |
| `pangoscript://reference/syntax` | Parser-shape reference (Markdown). |
| `pangoscript://reference/command-reference` | Full command reference (Markdown). |
| `pangoscript://reference/master-object-tree` | Object Tree root reference (Markdown). |
| `pangoscript://reference/object-model` | Object model overview (Markdown). |

Each advertises a `size` hint so MCP clients can budget context before
fetching.

---

## Reference: settings

All settings live under the `pangolint.*` namespace. The
`pangolint.beyond.*` runtime settings are machine-scoped; configure
them in user or machine settings, not workspace settings.

| Setting | Default | Purpose |
|---|---|---|
| `pangolint.beyond.talkTransport` | `auto` | `auto`, `tcp`, or `udp`. Auto tries Talk TCP first and uses UDP only when fallback is explicitly allowed. |
| `pangolint.beyond.talkTcpHost` | `127.0.0.1` | BEYOND Talk TCP host. |
| `pangolint.beyond.talkTcpPort` | `16063` | BEYOND Talk TCP port. |
| `pangolint.beyond.talkTcpEchoMode` | `1` | Talk TCP `Echo` mode used after optional password authentication. `1` returns brief status replies. `2` adds input echoes that are useful for parser feedback. |
| `pangolint.beyond.talkUdpHost` | `127.0.0.1` | BEYOND Talk UDP host. |
| `pangolint.beyond.talkUdpPort` | `16062` | BEYOND Talk UDP port. |
| `pangolint.beyond.talkUdpFallbackAllowed` | `false` | Allow unauthenticated UDP fallback when TCP is unavailable before authentication or command send begins. |
| `pangolint.beyond.talkTcpPassword` | `""` | Optional BEYOND TCP Talk Server password. Redacted from runtime output. |
| `pangolint.beyond.talkHost` | `127.0.0.1` | UDP host alias. |
| `pangolint.beyond.talkPort` | `16062` | UDP port alias. |
| `pangolint.beyond.oscListenHost` | `0.0.0.0` | Local interface used for OSC callbacks from BEYOND. |
| `pangolint.beyond.oscListenPort` | `7000` | Local UDP port used for OSC callbacks from BEYOND. |
| `pangolint.beyond.readbackTimeoutMs` | `3000` | Timeout for OSC readback callbacks (ms). |
| `pangolint.beyond.allowScriptExecution` | `false` | Allow sending BEYOND Talk command batches. Off by default. |
| `pangolint.beyond.confirmRunEachSession` | `true` | Confirm modal before each script-run (recommended on). |
| `pangolint.beyond.liveHoverValues` | `false` | Augment hover tooltips with live BEYOND values. Generates network traffic per hover. |
| `pangolint.codeLens.labelReferences` | `false` | Show `N references` code lens above each label declaration. |
| `pangolint.folderScopedUniverses` | `true` | Auto-discover universe panels by scanning sibling `.BeyondCode` files. |
| `pangolint.diagnostics.highlightStyle` | `lineBackground` | Controls extra editor emphasis for diagnostics: squiggle only, diagnostic-range background, or whole-line background. |
| `pangolint.diagnostics.inlineMessages` | `off` | Appends diagnostic messages after source lines when set to `warningsAndAbove` or `all`. |

---

## Reference: commands

Every command is also reachable from the Command Palette under
**PangoLint:**.

### Editor & validation

| Command | What it does |
|---|---|
| `pangolint.validateCurrentScript` | Re-run diagnostics on the active `.BeyondCode` file and write a report to the `PangoLint: Validation` Output channel. |

### BEYOND runtime

| Command | What it does |
|---|---|
| `pangolint.checkBeyondConnection` | Test BEYOND Connection (readback-only ping). |
| `pangolint.runScript` | Send the current file as a Talk batch (gated). |
| `pangolint.runSelection` | Send the current selection as a Talk batch (gated). |
| `pangolint.replayLastScript` | Re-send the last Talk batch verbatim. |
| `pangolint.fetchObjectValue` | Read a property path from BEYOND. |
| `pangolint.setObjectValue` | Write a property path on BEYOND (gated). |
| `pangolint.validateObjectsAgainstBeyond` | Walk every property path in this file and confirm it resolves on BEYOND. |
| `pangolint.pinToWatcher` | Pin a property path to the BEYOND Watcher. |
| `pangolint.unpinFromWatcher` | Unpin a property from the Watcher. |
| `pangolint.refreshWatcher` | Re-read every pinned property. |
| `pangolint.clearWatcher` | Unpin all watched properties. |

### User objects

| Command | What it does |
|---|---|
| `pangolint.addUserObject` | Internal - invoked by the code-action lightbulb. |
| `pangolint.removeUserObject` | Remove a registered universe / zone alias / master alias. |
| `pangolint.showUserObjects` | List currently registered user objects. |

### Sidebar

| Command | What it does |
|---|---|
| `pangolint.sidebar.refresh` | Refresh sidebar (Commands / Objects / Diagnostics). |
| `pangolint.sidebar.filterCommands` | Open the filter prompt for the Commands view. |
| `pangolint.sidebar.clearFilter` | Clear the Commands filter. |
| `pangolint.sidebar.insertAtCursor` | Insert the focused command's example at the cursor. |
| `pangolint.sidebar.insertSelectedCommand` | Same, bound to `Cmd+Enter` / `Ctrl+Enter` when the Commands view is focused. |
| `pangolint.sidebar.copySignature` | Copy the focused command's signature to the clipboard. |
| `pangolint.openReferenceSite` | Open the bundled offline PangoScript reference site in the default browser. |
| `pangolint.sidebar.revealDiagnostic` | Reveal the focused diagnostic at its source range. |
| `pangolint.sidebar.openDiagnosticDocs` | Open the bundled diagnostics doc scrolled to the focused rule. |
| `pangolint.sidebar.showCommandAtCursor` | View the command at the editor cursor in the Commands sidebar. |

---

## Reference: keybindings

| Combo (macOS / others) | Command | When |
|---|---|---|
| `Cmd+Enter` / `Ctrl+Enter` | `pangolint.sidebar.insertSelectedCommand` | Commands view focused, editor open on a `.BeyondCode` file. |
| `Cmd+.` / `Ctrl+.` | (VS Code default) Quick fix | On any diagnostic with a code action. |
| `F12` | (VS Code default) Go to Definition | On a `Goto MyLabel` reference. |
| `Shift+Alt+F` | (VS Code default) Format Document | In a `.BeyondCode` file. |

---

## Safety, privacy, and data

PangoLint biases conservative on three axes:

- **Network behavior.** Nothing on the network unless you've explicitly
  configured a BEYOND host *and* invoked a runtime command.
  - Knowledge tools, sidebar, completions, hover (without
    `liveHoverValues`), formatting, diagnostics - all 100% offline.
  - `Test BEYOND Connection` is readback-only (an `OscOutTTS` ping).
  - `Send Talk Batch`, `Set object value`, and the MCP `runScript`
    require explicit opt-in (`allowScriptExecution: true` for the
    extension; `PANGOLINT_MCP_RUNTIME_WRITE=enabled` for the MCP server) and
    a trusted workspace.
- **Workspace mutations.** PangoLint writes to two places only:
  `.pangolint/user-objects.json` (when you accept a register-as code
  action) and the active editor (when you explicitly insert a command
  / accept a quick fix). No silent edits.
- **What's bundled.** The repo ships a curated knowledge base derived
  from BEYOND's published exports. Verbatim Pangolin reference
  materials (BEYOND command export `.txt`, OSC HTML, local help) are
  **not** in the public repo. End users get the pre-generated
  `data/pangoscript/commands.merged.json` and do not need private
  source inputs.

---

## Troubleshooting

**Test BEYOND Connection times out.**
Confirm `pangolint.beyond.talkTcpHost` matches the BEYOND machine's IP
(not `127.0.0.1` if BEYOND is on a separate box), and confirm
`pangolint.beyond.talkTcpPort` matches the Talk TCP server port.
If you explicitly use UDP, check `pangolint.beyond.talkUdpHost` and
`pangolint.beyond.talkUdpPort` instead. Confirm BEYOND is configured
to send OSC Out callbacks back to your laptop's IP on
`pangolint.beyond.oscListenPort`. macOS / Windows firewall must allow
the listener port.

**Talk batch sent, BEYOND unchanged.**
Check whether the script uses control flow (`label:` / `goto` / `if` /
loops / waits / `exit`). BEYOND Talk is for straight-line command batches
only, paste full scripts directly into BEYOND's PangoScript editor.
The `BEYOND Notification Center` (in BEYOND itself) is the runtime
oracle for failed sends; check it when a probe inexplicably no-ops.

**Pasted script collapsed into one line.**
BEYOND's paste path treats LF-only clipboard text as one logical line.
`.BeyondCode` files intentionally check out with CRLF endings. Confirm
CRLF before copying.

**Property hover says "unknown root".**
The root identifier isn't in the canonical schemas and hasn't been
registered as a user object yet. Click the lightbulb on the unknown
root to register it as a universe / zone alias / master alias, or
enable `pangolint.folderScopedUniverses` so PangoLint auto-discovers
universes from sibling files.

**MCP runtime tool returns `{ ok: false, blocked: true }`.**
The server was started without the required runtime tier. Add
`PANGOLINT_MCP_RUNTIME_READ=enabled` for `healthCheck` /
`readBeyondProperty`, or `PANGOLINT_MCP_RUNTIME_WRITE=enabled` for
`runScript`, then restart the client. The agent is instructed not to
retry - it should tell you how to enable runtime instead.

**Markdown reference link from `Why?` doesn't open.**
The bundled diagnostics doc lives inside the VSIX. Reload the VS Code
window after upgrading PangoLint so the new doc path resolves.

---

PangoLint is independent software and is not affiliated with,
endorsed by, or sponsored by Pangolin Laser Systems, Inc. See
[README.md](../README.md) for the full trademark notice.
