# BEYOND Talk TCP Status Surfaces

Date: 2026-05-19

Companion spec:
`docs/specs/2026-05-19-beyond-talk-tcp-primary-transport.md`

## Goal

Define where BEYOND Talk TCP replies, command status, errors, and related OSC
callbacks should appear in PangoLint's VS Code extension and MCP server.

The primary transport spec decides that Talk TCP should be preferred when the
operator enables BEYOND TCP Talk Server. This spec defines the user-facing and
agent-facing response contract.

## Decision

Surface Talk TCP status in command-run transcripts and structured runtime
responses.

Do not surface raw Talk TCP status in BEYOND Watcher.

Keep the surface split:

- `PangoLint: Run` Output channel: runtime command transcript, TCP replies,
  BEYOND errors, transport selection, OSC capture summary.
- VS Code notifications: short success/failure summary only.
- VS Code status bar: compact transport/run status only.
- BEYOND Watcher: pinned Object Tree property values and captured OSC callback
  values.
- MCP `runScript`: structured runtime result with diagnostics, transport,
  Talk TCP replies, BEYOND command errors, and OSC callback summary.

## VS Code Output Channel

The `PangoLint: Run` Output channel is the primary human-readable transcript
surface for runtime sends.

For Talk TCP runs, append:

- timestamp,
- target host and port,
- selected transport,
- line count,
- greeting, if a new TCP connection is opened,
- per-command status when available,
- `ERROR Line` replies with command line mapping,
- OSC capture summary,
- total lines sent and elapsed time.

Example success transcript:

```text
[2026-05-19T20:14:12.120Z] Talk TCP -> 127.0.0.1:16063 (3 lines)
  greeting <- Welcome to BEYOND!
  line 1 ok <- Echo 1
  line 2 ok <- Hello! / OK
  line 3 ok <- OscOutTTS "/pangolint/run/abc", "s", "abc" / OK
  callbacks <- /pangolint/run/abc (s) ["abc"]
  ok - 3 lines sent over Talk TCP
```

Example BEYOND error transcript:

```text
[2026-05-19T20:15:02.421Z] Talk TCP -> 127.0.0.1:16063 (1 line)
  greeting <- Welcome to BEYOND!
  line 1 error <- ERROR Line: 1, Error: Unknown command: badcommand
  FAIL - BEYOND rejected line 1: Unknown command: badcommand
```

For UDP fallback, keep the transcript explicit:

```text
[2026-05-19T20:16:08.701Z] Talk UDP -> 127.0.0.1:16062 (3 lines)
  sent - local UDP socket accepted 1 datagram, BEYOND command status unavailable
```

## VS Code Notifications

Notifications should be short and action-oriented.

Use notifications for:

- final success,
- failed connection,
- BEYOND command rejection,
- timeout,
- lint-gate refusal.

Do not put full reply logs in notifications.

Examples:

- `PangoLint: sent 3 lines over Talk TCP.`
- `PangoLint: BEYOND rejected line 1: Unknown command: badcommand.`
- `PangoLint: Talk TCP timed out waiting for BEYOND status. See PangoLint: Run.`
- `PangoLint: sent 3 lines over Talk UDP. BEYOND status unavailable.`

Notifications should include a `Show Run Output` action when the user needs
details.

## VS Code Status Bar

The status bar should remain compact:

- `PangoLint: TCP OK (3)`
- `PangoLint: TCP ERROR (1)`
- `PangoLint: UDP sent (3)`
- `PangoLint: OSC 2 callbacks`

The replay status item should use transport-neutral wording such as
`Re-run (3)` and a tooltip that states the last transport used.

## BEYOND Watcher

BEYOND Watcher is the live state surface, not the command transcript surface.

Keep Watcher for:

- pinned Object Tree property paths,
- fetched values,
- property readback errors,
- captured OSC callbacks emitted by runtime runs.

Do not add these to Watcher:

- TCP greeting,
- `OK`,
- `ERROR Line`,
- echoed command text from `Echo 2`,
- raw TCP reply chunks,
- transport connection logs.

If a Talk TCP run emits `OscOutTTS` callbacks, Watcher may continue showing the
captured OSC callback entries. Those callbacks represent runtime data, not raw
transport status.

## MCP Response Contract

`runScript` should return a structured result that is useful to agents without
forcing them to parse human log text.

Proposed response shape:

```ts
interface RunScriptOutput {
  ok: boolean;
  diagnostics: PangoDiagnostic[];
  errorCount: number;
  warningCount: number;
  hintCount: number;
  transport: "tcp" | "udp";
  talkHost: string;
  talkPort: number;
  linesSent: number;
  payloadsSent?: number;
  bytesSent?: number;
  talkStatus: "ok" | "error" | "timeout" | "closed" | "send-only";
  talkGreeting?: string;
  talkReplies: TalkReply[];
  beyondError?: BeyondTalkError;
  oscCallbacks?: OscCallbackSummary;
  error?: string;
  refusedDueToErrors?: boolean;
  refusedDueToAnalysisLimit?: boolean;
}

interface TalkReply {
  lineNumber?: number;
  commandText?: string;
  status: "ok" | "error" | "output" | "echo" | "timeout" | "closed";
  replyLines: string[];
  redacted: boolean;
}

interface BeyondTalkError {
  lineNumber?: number;
  message: string;
  replyLine: string;
  redacted: boolean;
}

interface OscCallbackSummary {
  expectedAddresses: string[];
  messages: Array<{
    address: string;
    typeTags: string;
    args: Array<string | number>;
  }>;
  timedOut: boolean;
}
```

For UDP fallback:

- `transport` is `udp`,
- `talkStatus` is `send-only`,
- `talkReplies` is empty,
- `ok` only means local send completed,
- response text must not claim BEYOND accepted the command.

For TCP:

- `ok` requires BEYOND command status success.
- `ERROR Line` produces `ok: false` and fills `beyondError`.
- timeouts produce `ok: false`, `talkStatus: "timeout"`, and a clear `error`.
- if the script also requested OSC callbacks, include `oscCallbacks`.

## MCP Tool Behavior

`getServerConfig` should include transport settings and runtime availability:

```json
{
  "beyondTalkTransport": "auto",
  "beyondTalkTcpHost": "127.0.0.1",
  "beyondTalkTcpPort": 16063,
  "beyondTalkUdpHost": "127.0.0.1",
  "beyondTalkUdpPort": 16062,
  "beyondTalkUdpFallbackAllowed": false,
  "runtimeReadEnabled": true,
  "runtimeWriteEnabled": true
}
```

Use this fixed tool split:

- `healthCheck`: fast MCP server and configured socket reachability. It must not
  claim BEYOND accepted PangoScript commands.
- `checkTalkConnection`: Talk TCP greeting, `Echo 1`, `Hello`, and `Version`
  status.
- `readBeyondProperty`: OSC readback path.
- `runScript`: gated command send plus Talk status and optional OSC capture.

## Redaction Rules

The extension and MCP server must redact sensitive command text before writing
logs or returning agent-visible status.

Redact:

- `Password "<value>"`,
- configured TCP Talk password,
- values explicitly marked private by future settings,
- echoed command text from `Echo 2` when it contains a sensitive command.

Safe default:

- use `Echo 1`,
- do not use `Echo 2` in normal operation,
- record command line numbers and command names,
- record full command text only when it does not contain a known sensitive
  command.
- sanitize `TalkReply.replyLines`, `BeyondTalkError.message`, and
  `BeyondTalkError.replyLine` before storing them or returning them to MCP
  clients.
- keep raw TCP reply text in short-lived parser state only, then discard it
  after sanitized fields are produced.

Example redaction:

```text
line 1 ok <- Password "<redacted>"
```

## Error Mapping

Parse BEYOND errors into stable fields when possible.

Input:

```text
ERROR Line: 1, Error: Unknown command: badcommand
```

Output:

```json
{
  "lineNumber": 1,
  "message": "Unknown command: badcommand",
  "replyLine": "ERROR Line: 1, Error: Unknown command: badcommand",
  "redacted": false
}
```

If BEYOND returns an unrecognized error line, preserve a sanitized form in
`replyLine` and use the sanitized text as `message`. Do not store or return the
raw line.

Sensitive input example:

```text
ERROR Line: 1, Error: Password "sample-secret" invalid
```

Sanitized output:

```json
{
  "lineNumber": 1,
  "message": "Password \"<redacted>\" invalid",
  "replyLine": "ERROR Line: 1, Error: Password \"<redacted>\" invalid",
  "redacted": true
}
```

## Implementation Plan

1. Add shared Talk reply parsing and redaction functions under
   `src/runtime/talk/`.
2. Update Talk TCP send code to produce per-command status records.
3. Update `PangoLint: Run` output formatting for TCP and UDP modes.
4. Keep Watcher updates limited to OSC callback entries and pinned property
   readbacks.
5. Update MCP `runScript` output shape with transport, Talk status, replies,
   BEYOND error, and OSC callback summary.
6. Update `getServerConfig`, `healthCheck`, and `checkTalkConnection` behavior
   for TCP settings.
7. Update manual, MCP README, and runtime runbook.
8. Add tests for success, BEYOND error, timeout, UDP fallback, and redaction.

## Acceptance Criteria

- A TCP `Hello` run shows greeting, output, and `OK` in `PangoLint: Run`.
- A TCP unknown-command run shows a concise error notification and detailed
  transcript in `PangoLint: Run`.
- BEYOND Watcher does not show raw TCP `OK`, `ERROR Line`, greeting, or echo
  text.
- Watcher still shows captured OSC callbacks from runtime runs.
- MCP `runScript` returns structured Talk TCP status and BEYOND error fields.
- MCP `checkTalkConnection` reports Talk TCP greeting, `Echo 1`, `Hello`, and
  `Version` without changing show state.
- MCP `healthCheck` stays a reachability check and does not claim BEYOND command
  acceptance.
- UDP fallback responses clearly say command status is unavailable.
- Password commands and configured TCP Talk password values are redacted in
  extension output and MCP responses.
- `TalkReply.replyLines`, `BeyondTalkError.message`, and
  `BeyondTalkError.replyLine` are sanitized before storage or return.
- Tests cover VS Code formatting helpers, MCP output shape, error parsing, and
  redaction.
