# PangoScript VS Code Foundation Design

Date: 2026-05-03

## Goal

Build the first usable foundation for a VS Code extension that helps BEYOND operators write Pangolin BEYOND PangoScript with conservative linting, formatting, completion data, and an operator-triggered runtime connection check.

## Source Material

The first version is grounded in public Pangolin documentation, BEYOND command
exports, checked-in PangoLint data, and the runtime runbook:

- `docs/runbooks/beyond-runtime-command-runbook.md`

The live runtime path was verified on 2026-05-03 by sending Talk UDP to a local BEYOND host on port `16062` and receiving an `OscOutTTS` OSC callback on this Mac's listener port `7000`.

## Compatibility Posture

BEYOND is written in Delphi, and lightly documented PangoScript behavior may include Delphi-shaped syntax. The extension must therefore parse conservatively:

- Preserve unknown constructs rather than rewriting them.
- Treat Delphi-like property/index/object accessors as plausible expressions.
- Warn only when the rule has local documentation, command-catalog evidence, or live runtime evidence.
- Prefer hints and warnings over hard errors for language semantics that BEYOND may accept.

## Architecture

The extension is TypeScript-first and offline-first. It activates for the `pangoscript` language and provides diagnostics, formatting, command catalog services, and one readback-only BEYOND connection command.

Core parsing/linting/formatting code lives in pure modules under `src/` so it can be tested with Vitest without launching VS Code. `src/extension.ts` is only the VS Code adapter layer.

Runtime BEYOND integration is isolated behind small UDP/OSC modules. The default command is a safe ping using:

```text
OscOutTTS "/pangolint/ping", "s", "<request-id>"
```

## Components

- `src/knowledge/catalog.ts`: parses the exported command list into command metadata and aliases.
- `src/language/parser.ts`: tokenizes line-oriented PangoScript, preserving comments, labels, assignments, commands, OSC-address statements, strings, and expressions.
- `src/language/diagnostics.ts`: returns conservative diagnostics for syntax balance, unknown commands, missing labels, and declared-but-uninitialized variable use.
- `src/language/formatter.ts`: applies low-risk whitespace normalization without reordering or restructuring code.
- `src/runtime/talk/talkUdp.ts`: normalizes Talk UDP payloads as ASCII `\r\n`-terminated lines.
- `src/runtime/osc/osc.ts`: builds and decodes the small OSC 1.0 subset needed for readback checks.
- `src/runtime/readback/beyondReadback.ts`: sends read-only PangoScript readback commands and waits for matching OSC callbacks.
- `src/extension.ts`: registers VS Code diagnostics, formatter, catalog completions, and commands.

## Diagnostics Scope

Initial diagnostics include:

- Unclosed strings.
- Unbalanced parentheses outside strings/comments.
- Unknown leading command words when the line is not a label, declaration, assignment, IF, GOTO, or OSC address.
- `goto` targets that are literal labels and do not exist in the document.
- Variables declared with `var` or `globalvar` that are used before a local assignment in the same document.

The first version intentionally does not reject object properties, array/index accessors, or unknown Delphi-shaped expressions.

## Formatting Scope

Formatting is deliberately narrow:

- Keep `.BeyondCode` buffers CRLF for BEYOND paste compatibility. Parser and
  formatter internals may normalize to `\n`, but saved/copied PangoScript
  should not be rewritten to LF.
- Trim trailing whitespace.
- Normalize spaces around bare assignment operators.
- Normalize comma spacing outside strings.
- Keep labels at column zero.
- Preserve comments, strings, blank lines, and command order.

## Runtime Readback Scope

The foundation includes a single readback-only command: `PangoLint: Test BEYOND Connection`. Settings define the BEYOND Talk host/port and the local OSC listen host/port. The command sends a unique ping callback request and reports success/failure in the VS Code UI.

Defaults keep a single-host loopback layout safe and public. Operators with
BEYOND on another machine replace the Talk host with their LAN BEYOND host or
IP in local settings.

- BEYOND Talk host: `127.0.0.1`
- BEYOND Talk port: `16062`
- Local OSC listen host: `0.0.0.0`
- Local OSC listen port: `7000`

## Testing

Vitest covers catalog parsing, parser behavior, diagnostics, formatter behavior, Talk UDP payload rendering, OSC encode/decode, and the BEYOND readback with mocked UDP sockets.

Manual runtime verification is limited to the readback-only connection command.
