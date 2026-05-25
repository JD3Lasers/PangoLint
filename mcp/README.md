# PangoLint MCP

MCP server exposing PangoLint's curated PangoScript knowledge to AI
coding agents. The package and binary name is `pangolint-mcp`.

## What this is

A **developer tool**. The agent at the other end of this server is
helping you author PangoScript at a desk against your own dev BEYOND.
It can verify command names, look up object schemas and Object Tree
paths, lint generated code, and, when explicitly enabled, send the
latest draft to BEYOND for fast visual feedback.

## What this isn't

A show-operator tool. There is no live-show profile, no audience-
protective confirmation prompt, and no hundred-tool OSC API. If you
need cue-by-cue control of a running performance, this is the wrong
package; the runtime tools should stay disabled or unused in that
context.

## Install

Install the published package from npm:

```bash
npm install -g pangolint-mcp
which pangolint-mcp
```

Or install the `pangolint-mcp` tarball attached to a GitHub Release:

```bash
npm install -g ./pangolint-mcp-0.7.49.tgz
which pangolint-mcp
```

For local development, build the same tarball from a repository checkout:

```bash
# from the repository root
npm run package:mcp
npm install -g ./mcp/pangolint-mcp-0.7.49.tgz
which pangolint-mcp
```

The binary is `pangolint-mcp` (stdio transport).

## Tools

### Always available (offline, no network)

| Tool | What it does |
|---|---|
| `lookupCommand` | Curated entry for one command name (canonical or alias). |
| `searchCommands` | Task-intent search over names, aliases, descriptions, categories, forms, parameters, notes, tags, and command-reference prose; optional `safetyTier` filter. |
| `lookupObject` | Unified object lookup for canonical schemas and exact Object Tree paths (e.g. `WS.N.N.Caption`, `FX.N.N.N.Oscillator.Period`). |
| `listObjects` | Object roots from canonical schemas plus Object Tree-only families such as `WS`, `FX`, and `DmxOutput`. |
| `searchObjectProperties` | Ranked search over Object Tree and FX property paths. |
| `lookupObjectProperty` | Exact lookup for one Object Tree property path. |
| `lookupPropertyControls` | Exact property lookup with Object Tree path, direct `/b/` address, PangoScript command links, OSC routes, range data, readback, and behavior metadata. |
| `searchPropertyControls` | Search property controls by path, OSC route, command name, context, and value metadata. |
| `lintScript` | Run PangoLint diagnostics over text, using bundled object schemas and Object Tree paths for property hints. |
| `explainDiagnostic` | Markdown for one diagnostic code. |
| `getServerConfig` | Current config + which tools are available. Call this first. |

### Runtime tools (require opt-in)

These return `{ ok: false, blocked: true }` unless
the matching runtime tier is enabled at startup. Read runtime and write
runtime are split so agents can inspect BEYOND state without gaining
script-send capability.

| Tool | Tier | What it does |
|---|---|---|
| `healthCheck` | T0 | Requires `PANGOLINT_MCP_RUNTIME_READ=enabled`. DNS + UDP-socket reachability of the configured BEYOND UDP target. Does not verify BEYOND accepts commands. |
| `checkTalkConnection` | T0 | Requires `PANGOLINT_MCP_RUNTIME_READ=enabled`. Opens Talk TCP and checks greeting, configured `Echo` mode, `Hello`, and `Version` replies. |
| `readBeyondProperty` | T1 read | Requires `PANGOLINT_MCP_RUNTIME_READ=enabled`. Single readback of a property path (e.g. `Master.Brightness`). Talk TCP readbacks use the configured `Echo` mode. |
| `runScript` | T2+ | Requires `PANGOLINT_MCP_RUNTIME_WRITE=enabled`. Lints; refuses on any error-severity diagnostic; otherwise sends via configured Talk transport. Talk TCP reports BEYOND replies with the configured `Echo` mode; UDP fallback is send-only. |

`runScript`'s lint-before-run gate is the load-bearing developer
guarantee: nothing reaches BEYOND that PangoLint already knows is
broken syntax. Hint and warning diagnostics surface in the response
but do not block.

## Resources

- `pangoscript://catalog/commands` - full curated command catalog (JSON)
- `pangoscript://schemas/objects` - every canonical object schema (JSON)
- `pangoscript://diagnostics/codes` - diagnostics doc (markdown)
- `pangoscript://reference/operators` - operator reference (markdown)
- `pangoscript://reference/syntax` - parser-shape reference (markdown)
- `pangoscript://reference/command-reference` - full command reference (markdown)
- `pangoscript://reference/master-object-tree` - Object Tree root reference (markdown)
- `pangoscript://reference/object-model` - object model overview (markdown)

Browse these to load PangoScript context into the agent without
calling individual tools.

## Known limitations

- Workspace-local universes, zone aliases, and operator-named layouts are
  not bundled. Agents should treat unknown object roots as potentially
  workspace-defined unless the user supplies the showfile context or runtime
  readback confirms the root.
- Runtime-only evidence remains scoped to the lab/build that produced it.
  Use command `evidenceLevel`, `verification`, and safety-tier fields before
  presenting a behavior as confirmed.
- `runScript` uses BEYOND Talk for straight-line command batches. Talk TCP
  reports command replies when enabled, but it is still not equivalent to
  BEYOND's editor runner. Labels, `goto`, `if`, loops, waits, and
  multi-section scripts still need BEYOND editor/manual validation.
- Property validation uses bundled canonical schemas plus the Object Tree
  index. It cannot validate showfile-specific aliases without workspace or
  runtime context.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `PANGOLINT_MCP_RUNTIME_READ` | (off) | Set to `enabled` (or `1` / `true`) to enable read runtime tools: `healthCheck`, `checkTalkConnection`, and `readBeyondProperty`. |
| `PANGOLINT_MCP_RUNTIME_WRITE` | (off) | Set to `enabled` (or `1` / `true`) to enable `runScript`. Also enables read runtime tools. |
| `PANGOLINT_MCP_RUNTIME` | (off) | Legacy alias for read runtime only. Does not enable `runScript`. |
| `PANGOLINT_MCP_BEYOND_TALK_TRANSPORT` | `auto` | `auto`, `tcp`, or `udp`. Auto tries Talk TCP first and only uses UDP when fallback is explicitly allowed. |
| `PANGOLINT_MCP_BEYOND_TALK_TCP_HOST` | `127.0.0.1` | BEYOND Talk TCP host. |
| `PANGOLINT_MCP_BEYOND_TALK_TCP_PORT` | `16063` | BEYOND Talk TCP port. |
| `PANGOLINT_MCP_BEYOND_TALK_TCP_ECHO_MODE` | `2` | Talk TCP `Echo` mode used after optional password authentication. `2` returns input echoes plus status replies for richer parser feedback. Use `1` for brief status-only replies. |
| `PANGOLINT_MCP_BEYOND_TALK_UDP_HOST` | Talk host alias or `127.0.0.1` | BEYOND Talk UDP host. |
| `PANGOLINT_MCP_BEYOND_TALK_UDP_PORT` | Talk port alias or `16062` | BEYOND Talk UDP port. |
| `PANGOLINT_MCP_BEYOND_TALK_UDP_FALLBACK_ALLOWED` | (off) | Set to `enabled` (or `1` / `true`) to allow auto mode to use unauthenticated UDP when TCP is unavailable before authentication or command send begins. |
| `PANGOLINT_MCP_BEYOND_TALK_TCP_PASSWORD` | (empty) | Optional BEYOND TCP Talk Server password. This value is redacted from runtime output. |
| `PANGOLINT_MCP_BEYOND_TALK_HOST` | `127.0.0.1` | UDP host alias used when `PANGOLINT_MCP_BEYOND_TALK_UDP_HOST` is unset. |
| `PANGOLINT_MCP_BEYOND_TALK_PORT` | `16062` | UDP port alias used when `PANGOLINT_MCP_BEYOND_TALK_UDP_PORT` is unset. |
| `PANGOLINT_MCP_BEYOND_OSC_LISTEN_HOST` | `0.0.0.0` | Local interface for OSC callbacks. |
| `PANGOLINT_MCP_BEYOND_OSC_LISTEN_PORT` | `7000` | Local UDP port for OSC callbacks. |
| `PANGOLINT_MCP_READBACK_TIMEOUT_MS` | `3000` | Readback timeout (ms). |
| `PANGOLINT_MCP_DATA_DIR` | (auto) | Override the data/docs base path. Used in monorepo dev. |

The network target is fixed at startup. The agent cannot redirect a
runtime call to a different host.

`Echo 2` improves Talk TCP `WriteLn` cross-checks because BEYOND echoes
the command text before status output. `RegisterOscFeedback` remains the
push-feedback path for observing values changed live outside the MCP tool.

## MCP client configuration

Use `PangoLint` as the client-side server key when your client allows
mixed-case names. Some clients show this key in tool-call UI.

### Claude Desktop

`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "PangoLint": {
      "command": "pangolint-mcp"
    }
  }
}
```

To enable read runtime tools against a local BEYOND:

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

### Claude Code

`.claude/mcp.json` (or your CLI's MCP config):

```json
{
  "mcpServers": {
    "PangoLint": {
      "command": "pangolint-mcp"
    }
  }
}
```

### Cursor / VS Code (with MCP)

```json
{
  "servers": {
    "PangoLint": {
      "command": "pangolint-mcp"
    }
  }
}
```

## Recommended flow

1. **Always-on**: agent uses `lookupCommand` / `searchCommands`,
   `listObjects` / `lookupObject`, `searchObjectProperties`, and
   `lintScript` while writing PangoScript. `lookupObject` can resolve
   canonical roots and exact Object Tree paths such as
   `WS.1.2.Caption`. No network involved.
2. **First time targeting a BEYOND**: launch with
   `PANGOLINT_MCP_RUNTIME_READ=enabled` and the right host/port. Have
   the agent call `getServerConfig` to confirm read runtime is on, then
   `healthCheck` to verify UDP reachability and `checkTalkConnection`
   to verify Talk TCP replies.
3. **Iterating**: `lintScript` first to catch errors locally;
   enable `PANGOLINT_MCP_RUNTIME_WRITE=enabled` only when you want
   agents to send scripts to BEYOND through `runScript`. The
   lint-before-run gate inside `runScript` means you can't accidentally
   send broken syntax even if you skip step 1.

## Source

Source lives at <https://github.com/JD3Lasers/PangoLint> in the
`mcp/` workspace. Both this package and the PangoLint VS Code
extension read from the same `data/pangoscript/` knowledge base, so
upgrades stay in lockstep.

## License

GPL-3.0-or-later.
