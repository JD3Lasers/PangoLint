# Agent Integration Runbook

Last updated: 2026-05-10

## Purpose

Operator-side procedures for installing, configuring, and verifying
the `pangolint-mcp` server with an MCP-aware AI client (Claude
Desktop, Claude Code, Cursor, etc.).

Scope is the developer authoring loop: an operator at a desk uses an
agent to write PangoScript, optionally pointed at a dev BEYOND for
fast feedback. Live-show control is out of scope.

## Pre-flight

1. Node.js 18+ installed (the published tarball is an ESM bundle).
2. An MCP-aware client.
3. (Optional, for runtime tools) a dev BEYOND instance reachable
   over the LAN with Talk UDP enabled. Defaults are `127.0.0.1:16062`
   for Talk and `0.0.0.0:7000` for OSC callbacks.

## Install

Install the `pangolint-mcp` tarball attached to a GitHub Release:

```bash
npm install -g ./pangolint-mcp-0.4.6.tgz
which pangolint-mcp   # confirm the binary is on PATH
```

For local development, build the same tarball from a PangoLint repository
checkout:

```bash
# from the repository root
npm run package:mcp
npm install -g ./mcp/pangolint-mcp-0.4.6.tgz
which pangolint-mcp   # confirm the binary is on PATH
```

If npm publishing is selected for a later release, the registry install path
will be:

```bash
npm install -g pangolint-mcp
```

The package ships a stdio MCP server. Logging is stderr-only; stdout
is reserved for JSON-RPC frames.

## Knowledge-only configuration (recommended first run)

No network access, no environment variables required. Add to your
client's MCP config:

```json
{
  "mcpServers": {
    "PangoLint": {
      "command": "pangolint-mcp"
    }
  }
}
```

Use `PangoLint` as the client-side server key when your client allows
mixed-case names. Some clients show this key in tool-call UI.

Restart the client. Verify the agent can call:

- `getServerConfig` → reports `runtimeEnabled: false`, `runtimeReadEnabled:
  false`, `runtimeWriteEnabled: false`, and lists the knowledge tools.
- `lookupCommand` with `name: "Brightness"` → returns the curated
  entry.
- `lintScript` with a small script → returns diagnostics.

If any of these fail, check the client's MCP-server logs (each client
exposes a different log path; consult the client's docs).

## Enabling runtime tools

Only after the knowledge-only configuration works.

1. Confirm the dev BEYOND host + port. Defaults match a single-host
   loopback layout. For a separate-machine layout, set both. Replace
   `<beyond-host>` with the actual BEYOND machine host or IP before
   running:

   ```bash
   PANGOLINT_MCP_BEYOND_TALK_HOST="<beyond-host>"
   PANGOLINT_MCP_BEYOND_TALK_PORT=16062
   ```

2. In BEYOND: enable OSC input (Configuration > Network > OSC) so it
   can hear the agent's runtime tool calls and emit readback
   callbacks.

3. Update the client config for read runtime. Replace
   `<beyond-host>` with the actual BEYOND machine host or IP before
   saving:

   ```json
   {
     "mcpServers": {
       "PangoLint": {
         "command": "pangolint-mcp",
         "env": {
           "PANGOLINT_MCP_RUNTIME_READ": "enabled",
           "PANGOLINT_MCP_BEYOND_TALK_HOST": "<beyond-host>",
           "PANGOLINT_MCP_BEYOND_TALK_PORT": "16062"
         }
       }
     }
   }
   ```

4. Restart the client. Have the agent call `getServerConfig` →
   `runtimeEnabled` and `runtimeReadEnabled` should now be `true`,
   `runtimeWriteEnabled` should still be `false`, and the
   available-tools list should include `healthCheck` and
   `readBeyondProperty` but not `runScript`.

5. `healthCheck` first. Expected `reachable: true` with the resolved
   address. If `reachable: false`, the server cannot address the
   target — DNS or routing problem on the launch machine, not
   BEYOND-side.

6. `readBeyondProperty` with `path: "Master.Brightness"`. Expected `ok:
   true` with the current value. A timeout means BEYOND is reachable
   at the network layer but not responding to OSC; check the
   listen-port settings on both sides.

7. Only when operator-supervised script sending is in scope, add
   `"PANGOLINT_MCP_RUNTIME_WRITE": "enabled"` to the same `env` block,
   restart the client, and confirm `getServerConfig` reports
   `runtimeWriteEnabled: true`.

8. `runScript` with a known-good straight-line command such as
   `OscOutTTS "/pangolint/mcp/smoke", "s", "manual-smoke"`.
   Expected lint-clean and `linesSent: 1`, with the callback visible in
   the configured OSC monitor.

## Recovery / common failures

- **"runtime disabled" returned even with env set** — the relevant env
  var wasn't passed through. Most clients need the `env` block inside
  `mcpServers`; setting the variable in the parent shell does not
  reach the spawned subprocess. Read tools need
  `PANGOLINT_MCP_RUNTIME_READ`; `runScript` needs
  `PANGOLINT_MCP_RUNTIME_WRITE`.
- **`healthCheck` reachable but `readBeyondProperty` timeouts** — BEYOND
  is on the network but isn't echoing OSC. Check `OSC In` /
  `OSC Out` ports in BEYOND; defaults vary by build.
- **`runScript` returns `refusedDueToErrors`** — the script has
  error-severity diagnostics. Read the `diagnostics` array in the
  response, fix the script, retry. This is by design, not a bug.
- **`runScript` returns a Talk UDP control-flow refusal** — the script
  contains labels, `goto`, `if`, loops, waits, or `exit`. Talk UDP is
  command-batch transport, not the BEYOND editor runner; paste full
  control-flow scripts directly in BEYOND for semantic validation. Confirm the
  source buffer is CRLF before copying because LF-only clipboard text can paste
  into BEYOND's PangoScript editor as one logical line.

## Source

- Package source: `mcp/` in the
  [PangoLint repository](https://github.com/JD3Lasers/PangoLint).
- The same `data/pangoscript/` knowledge base feeds both the VS Code
  extension and this MCP server, so upgrades stay in lockstep.
