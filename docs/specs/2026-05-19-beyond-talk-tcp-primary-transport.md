# BEYOND Talk TCP Primary Transport

Date: 2026-05-19

Companion status-surface spec:
`docs/specs/2026-05-19-beyond-talk-tcp-status-surfaces.md`

## Goal

Move BEYOND command sending toward Talk TCP as the preferred command transport
for PangoLint and related JD3 tools, while keeping Talk UDP as an explicit
fallback for deployments that have not enabled the TCP Talk Server.

Talk TCP gives the client a command reply stream. That reply stream can report
connection greeting text, `OK` acknowledgements, command output such as
`Hello!` and `Version`, and parse/runtime errors such as unknown command
messages. Talk UDP remains useful for simple fire-and-forget sends, but it does
not provide a useful same-machine reply path in current local testing.

OSC remains the state and readback proof path. Talk TCP can say whether BEYOND
accepted a command line. It does not prove that a command changed the intended
Object Tree value, that a no-op command had operator-visible effect, or that a
value was clamped as expected.

## Decision

Use Talk TCP as the primary command transport when the operator enables the
BEYOND TCP Talk Server.

Keep Talk UDP as a configured fallback:

- TCP primary: command send plus status/error replies.
- UDP fallback: legacy command send only, with no command reply guarantee.
- OSC readback: property values, callbacks, and runtime evidence.

Do not remove Talk UDP support in the first implementation. Existing tools and
show computers may only have the UDP Talk Server enabled.

## Current Evidence

Local BEYOND 5.5.0.2030 testing on 2026-05-19 showed:

- UDP Talk Server on port `16062` accepted T0 commands but returned no reply to
  the sender socket for `Echo 1`, `Hello`, `Version`, or an intentionally
  unknown command.
- Enabling the UDP Talk Client service did not make UDP replies return to the
  sender socket.
- TCP Talk Server on port `16063` accepted loopback and LAN client connections.
- TCP connection greeting was `Welcome to BEYOND!`.
- `Echo 1` returned `OK`.
- `Hello` returned `Hello!` followed by `OK`.
- `Version` returned `5.5.0.2030` followed by `OK`.
- An unknown command returned `ERROR Line: 1, Error: Unknown command: ...`.
- `Echo 2` returned the lower-case input line before the command output and
  `OK`.
- A TCP-sent `OscOutTTS` command produced the expected OSC callback on the
  configured OSC Out listener.
- A TCP control-flow probe using an editor-validated branch fixture still
  behaved as command-line transport, not full editor script execution. `goto
  Start` and `if (branchValue = 0) goto BranchZero` returned `ERROR Line: 1,
  Error: Label not found: ...`, and the callback that should have been skipped
  still fired.

These probes used only T0/T1 commands and did not change BEYOND show state.

## Operator Requirements

Talk TCP should be opt-in at the BEYOND side:

- Operator enables BEYOND TCP Talk Server.
- Default TCP port is `16063`.
- Client should support same-machine `127.0.0.1` and LAN host names or IPs.
- If the deployment sets a TCP Talk Server password in BEYOND.INI, the client
  must send `Password "<password>"` before other controlled commands.
- Tools must not log or echo passwords. Use `Echo 0` or avoid `Echo 2` around
  authentication commands.

The UI should clearly distinguish:

- Talk TCP connected with replies available.
- Talk UDP fallback connected but reply status unavailable.
- OSC callback path working.
- OSC callback path unavailable.

## Protocol Shape

Talk TCP is a line-oriented ASCII command stream:

- Connect to `<beyond-host>:16063`.
- Expect a greeting such as `Welcome to BEYOND!`.
- Send one PangoScript command line at a time, terminated with CRLF.
- Use the configured Echo mode for command status. Extension runtime defaults
  to `Echo 1`; MCP runtime defaults to `Echo 2` for agent readbacks.
- Read response lines until the command has a terminal status:
  - `OK`
  - `ERROR Line: <n>, Error: <message>`
  - connection close or timeout

`Echo 2` is useful for debugging protocol framing and parser feedback because
it repeats command text before status output. MCP runtime returns sanitized
reply lines and exposes the selected mode as `talkTcpEchoMode`.

Talk TCP should still be treated as command-line transport. It is not
equivalent to running a `.BeyondCode` script in BEYOND's PangoScript editor.
Labels, `goto`, `if ... goto`, loops, waits, and `exit` should remain blocked
from automated command sends unless a separate whole-script execution mode is
freshly verified.

## Transport Selection

Runtime settings should support this order:

1. If Talk TCP is enabled in tool settings, use TCP and fail closed when the TCP
   connection fails.
2. If transport mode is `auto`, try TCP first, then fall back to UDP only when
   TCP is unavailable before authentication and UDP fallback is explicitly
   allowed.
3. If transport mode is `udp`, preserve current UDP behavior.

UDP fallback must be disabled by default. TCP password use makes the transport
choice security-sensitive because UDP has no equivalent authentication. In
`auto` mode, the tool may use UDP only when all of these are true:

- `beyondTalkUdpFallbackAllowed` is `true`.
- TCP connect failed or timed out before any password or command was sent.
- The operator-visible status says Talk UDP fallback was used and BEYOND command
  status is unavailable.

The tool must not fall back to UDP after a TCP password rejection, a BEYOND
`ERROR Line` reply, a TCP timeout after commands begin, or a TCP connection
close after authentication begins. Those cases are hard failures and should
preserve the TCP error for the user.

Proposed settings:

```json
{
  "beyondTalkTransport": "auto",
  "beyondTalkTcpHost": "127.0.0.1",
  "beyondTalkTcpPort": 16063,
  "beyondTalkUdpHost": "127.0.0.1",
  "beyondTalkUdpPort": 16062,
  "beyondTalkUdpFallbackAllowed": false,
  "beyondTalkTcpPassword": "",
  "beyondTalkCommandTimeoutMs": 3000
}
```

Tools with existing settings can map these names to their local configuration
style, but the behavior should stay the same across repos.

## Command Execution Contract

Talk TCP send functions should return structured command results:

```ts
interface TalkCommandResult {
  ok: boolean;
  transport: "tcp" | "udp";
  commandText: string;
  replyLines: string[];
  status?: "ok" | "error" | "timeout" | "closed" | "unavailable";
  errorLine?: number;
  errorMessage?: string;
}
```

For UDP fallback, `ok` can only mean the local socket send completed. It must not
be reported as BEYOND command acceptance.

For TCP, `ok` should require an `OK` response for commands where BEYOND returns
one. `ERROR Line` responses should be surfaced to the user and to MCP clients.

## Readback Contract

Talk TCP improves command acceptance evidence, but it does not replace
readback:

- Use TCP status to detect parse errors, unknown commands, and immediate command
  failures.
- Use OSC callbacks for property values and query results.
- Use `RegisterOscFeedback` or `OscOutTTS` when a workflow needs Object Tree
  evidence.
- For write verification, arm OSC capture before sending the TCP command batch,
  then require both TCP `OK` and the expected OSC callback/readback.

The stronger proof shape is:

1. Bind or prepare OSC listener.
2. Connect Talk TCP.
3. Send command or command batch.
4. Require TCP success.
5. Require OSC readback when state evidence is needed.
6. Restore baseline for reversible write probes.

## Safety Rules

- Default to T0/T1 probes for connection checks: configured Echo mode, `Hello`,
  `Version`, and `OscOutTTS` ping.
- Do not send output, playback, projector, mute, zoning, or geometry commands
  without the existing runtime safety approval path.
- Never use `Echo 2` for commands containing credentials or operator-private
  values.
- Keep TCP password values out of logs, issue bodies, generated docs, MCP
  responses, and screenshots.
- Treat TCP Talk Server exposure as a control-plane security boundary. Prefer
  loopback for same-machine tools. LAN use requires operator-owned firewall and
  password decisions.

## Implementation Plan

1. Add a pure Talk TCP transport module with tests for greeting, line send,
   `OK`, `ERROR Line`, timeout, close, and password-redaction behavior.
2. Add shared command-result parsing so extension and MCP output use the same
   fields.
3. Update runtime config for transport mode, TCP host/port, timeout, and
   optional password.
4. Update VS Code command sending to prefer TCP when configured and show status
   replies in the UI.
5. Update MCP `runScript` to use TCP when enabled and report BEYOND command
   errors in structured results.
6. Keep UDP fallback and label it clearly as send-only.
7. Update the runtime runbook, manual, and package docs.
8. Add cross-repo adoption notes for JD3 tools that currently send BEYOND Talk
   UDP.

## Acceptance Criteria

- TCP connection check reports greeting, `Hello`, `Version`, and `OK`.
- Unknown command over TCP produces a user-visible and MCP-visible BEYOND error.
- UDP mode remains available and keeps current behavior.
- `auto` mode falls back to UDP only when fallback is explicitly allowed and TCP
  failed before authentication or command send began.
- TCP password rejection, BEYOND command rejection, command timeout, or
  authenticated connection close does not fall back to UDP.
- TCP mode does not leak password values in logs or responses.
- Readback workflows still require OSC evidence for state claims.
- Existing tests cover TCP parser behavior and UDP fallback behavior.
- Public docs explain when to use TCP, UDP, and OSC.
- The implementation passes `npm run check`.
