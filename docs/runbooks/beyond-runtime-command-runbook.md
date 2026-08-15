# Local BEYOND Runtime Command Runbook

Last updated: 2026-05-22

## Purpose

Define the safe, evidence-backed path for operator-supervised BEYOND runtime
command checks from this repository.

This runbook covers direct local/LAN BEYOND validation only. A common setup is
a Mac development machine talking to BEYOND on a separate local-network Windows
machine, because BEYOND is Windows-only. Public examples use placeholder or
documentation-reserved hosts; local operators must substitute their own lab
addresses. That network shape is an operator-supervised test setup, not a
general remote-control model.

## Scope Boundary

Use this runbook for:
- Talk TCP command transport, Talk UDP fallback, and PangoScript callback checks,
- straight-line Talk command batches that do not depend on script control
  flow,
- OSC writes and OSC query/readback checks,
- source/test-backed confirmation of command shapes before a runtime-sensitive
  PR claim,
- recording BEYOND command evidence in issue/PR closeout notes.

Do not use this runbook to:
- authorize remote clients to send raw Talk TCP, Talk UDP, OSC, or PangoScript,
- treat BEYOND Talk as equivalent to running a `.BeyondCode` script in BEYOND's
  PangoScript editor,
- bypass the runtime safety rules in the engineering standards,
- run live-output commands without explicit operator supervision.

## Reference Inputs

Current local source of truth remains the engineering standards, the current
source/tests, and the PangoLint design/plan docs. BEYOND reference files are
supporting evidence, not automatic implementation authority.

Relevant project docs:
- `docs/specs/2026-05-05-engineering-standards.md`
- `docs/specs/2026-05-03-pangoscript-vscode-foundation-design.md`
- `docs/references/operators.md`
- `docs/references/syntax.md`

For canonical Pangolin documentation, refer to
<https://support.pangolin.com>. The public repository uses checked-in
PangoLint reference data and docs for tests and package builds.

Implementation anchors:
- `src/runtime/talk/talkTcp.ts`
- `src/runtime/readback/beyondReadback.ts`
- `src/runtime/talk/talkUdp.ts`
- `src/runtime/osc/osc.ts`
- `tests/runtime/beyondReadback.test.ts`
- `tests/runtime/talkUdp.test.ts`
- `tests/runtime/osc.test.ts`

## Endpoint Model

Default BEYOND endpoints:
- Talk TCP: app to BEYOND on TCP `16063`
- Talk UDP: app to BEYOND on UDP `16062`
- OSC In: app to BEYOND on UDP `8000`
- OSC Out: BEYOND to app listener on UDP `7000`

For same-machine BEYOND:
- BEYOND host fields commonly use `127.0.0.1`.
- App listener may bind `127.0.0.1:<osc_listen_port>`.

For a Mac-to-Windows lab shape:
- BEYOND host fields should target the Windows BEYOND machine, for example
  `<beyond-host>` or a documentation-reserved placeholder such as `192.0.2.147`.
- BEYOND OSC Out must target the Mac's reachable LAN address and listener port,
  not `127.0.0.1` on the Windows machine.
- The app listener should bind `0.0.0.0:<osc_listen_port>` or the Mac's specific
  LAN interface address when receiving callbacks from the Windows machine.
- Windows firewall must allow the selected BEYOND TCP and UDP ports.
- macOS firewall/network permissions must allow inbound OSC callback traffic to
  the app listener.

## Safety Tiers

Use the lowest tier that proves the claim.

| Tier | Scope | Examples | Evidence expectation |
| --- | --- | --- | --- |
| T0 | No live BEYOND | source/tests/static docs only | command/test output |
| T1 | Readback-only | `OscOutTTS` ping, zone count query, PangoScript property readbacks | NDJSON log or console output |
| T2 | Reversible preview-plane writes | `/b/Zone/N/Preview/*` write then readback/restore | before/write/restore evidence |
| T3 | Live output actuation | projector mute/unmute, laser output enable/disable | explicit operator-supervised note |
| T4 | Output geometry/Zoning writes | `Zone.N.UGC.*`, `/b/Zone/N/UGC/*`, test frames | baseline, write, readback, restore |

T3 and T4 commands must be issue-scoped. Record the exact target zone/projector,
the physical safety state, the command sent, the observed BEYOND result, and the
restore/cleanup action.

## BEYOND Talk Command-Batch Limit

Treat BEYOND Talk as command-batch transport. Current runtime evidence shows it
does not preserve BEYOND editor script semantics for labels, `goto`, `if`,
loops, waits, or `exit`; lines that should be skipped by control flow can still
execute when sent over Talk TCP or Talk UDP.

PangoLint therefore blocks those constructs in `Send Talk Batch to BEYOND` and
MCP `runScript` runtime sends. To validate a full `.BeyondCode` script with
control flow, paste it directly into BEYOND's PangoScript editor and record the
manual OSC/output evidence in the regression fixture notes. Confirm the buffer
is CRLF before copying; LF-only clipboard text can paste into BEYOND as one
logical line.

## Readback-First Connectivity Check

Prefer the Test Console for manual runtime checks:

```bash
python run_test_console.py
```

1. Configure endpoints in the Test Console `Connections` panel.
2. Start the OSC listener.
3. Send the Talk snippet:

```text
OscOutTTS "/bpb/ping", "s", "hello"
```

Expected callback:
- address: `/bpb/ping`
- type tags: `s`
- payload: `hello`

If the callback is missing, verify the BEYOND OSC Out destination host/port and
the app listener bind address before testing write paths.

## Operator-Supervised Local Smoke

Run live smoke checks locally on a computer that can reach the supervised
BEYOND bench. The smoke command checks:

- Talk TCP `Hello` and `Version` to verify parser/status readback.
- A readback-only `OscOutTTS` ping sent over Talk TCP.
- A harmless Object Tree readback, defaulting to `Master.Brightness`.
- A Talk UDP `OscOutTTS` callback smoke check. This proves the datagram path and
  callback route, but Talk UDP remains send-only for parser/status reporting.

Configure the bench through process environment variables. Keep local network
addresses out of checked-in files.

| Name | Purpose |
| --- | --- |
| `PANGOLINT_LIVE_BEYOND_HOST` | Optional shared BEYOND host for Talk TCP and Talk UDP. |
| `PANGOLINT_LIVE_BEYOND_TALK_TCP_HOST` | Talk TCP host when it differs from the shared host. |
| `PANGOLINT_LIVE_BEYOND_TALK_TCP_PORT` | Talk TCP port. Defaults to `16063`. |
| `PANGOLINT_LIVE_BEYOND_TALK_UDP_HOST` | Talk UDP host when it differs from the shared host. |
| `PANGOLINT_LIVE_BEYOND_TALK_UDP_PORT` | Talk UDP port. Defaults to `16062`. |
| `PANGOLINT_LIVE_BEYOND_TCP_PASSWORD` | Optional Talk TCP password. Set it only in the local process environment and do not check it in. |
| `PANGOLINT_LIVE_BEYOND_OSC_LISTEN_HOST` | Local listener bind host. Defaults to `0.0.0.0`. |
| `PANGOLINT_LIVE_BEYOND_OSC_LISTEN_PORT` | Local OSC callback listener port. Defaults to `7000`. |
| `PANGOLINT_LIVE_BEYOND_READBACK_TIMEOUT_MS` | Readback timeout. Defaults to `5000`. |
| `PANGOLINT_LIVE_BEYOND_READBACK_PATH` | Readback Object Tree path. Defaults to `Master.Brightness`. |
| `PANGOLINT_LIVE_BEYOND_READBACK_TYPE` | OSC type tag for the readback path: `f`, `i`, or `s`. Defaults to `f`. |

Run the same smoke locally with:

```bash
npm run smoke:live-beyond -- --mode all
```

Available modes:
- `connection`: Talk TCP plus the readback-only OSC ping.
- `readback`: connection checks plus the configured property readback.
- `udp`: Talk UDP callback smoke only.
- `all`: every check above.

Range spot checks should stay in a separate issue and manual profile. Use the
local smoke command to prove the bench is reachable before running curated
range canaries.

### Build 2060 compatibility check

The public BEYOND 5.5 Build 2060 was checked on 2026-07-21 with a same-machine,
loopback-only setup:

- Talk TCP `Hello` and `Version` passed, with `Version` returning
  `5.5.0.2060`.
- A unique `OscOutTTS` callback sent over Talk TCP was received on the
  configured OSC Out listener.
- `GetTimelineTabName` and `GetTimelineTabIndex` returned `Untitled` and `0`
  for the selected unsaved Timeline tab.
- `TimelineSetTabName "__pangolint_issue_169_missing__"` returned `OK` and the
  selected tab remained `Untitled` at index `0`.
- `TimelineMarker 6, 13.579` returned `OK` on that unsaved tab, and the tab
  readback remained `Untitled` at index `0`.

These results confirm the scoped connection and Timeline contracts only. They
do not relabel earlier Build 2030 or Build 2044 runtime evidence.

## Zone Identity Readback Check

Use a request-id suffix unique to the run.

```text
var zoneName;
zoneName = Zone.0.Name;
OscOutTTS "/pangolint/readback/zone", "iss", 0, zoneName, "manual-YYYYMMDD-HHMM";
```

Expected callback:
- address: `/pangolint/readback/zone`
- type tags: `iss`
- args: zone index, zone name, request id

This path is preferred for zone names because direct OSC query callbacks for
`/b/Zone/0/Name` were not observed in the current documented setup.

## OSC Readback Check

Use existing Test Console OSC presets first:
- `/b/Zone/Count`
- `/b/Zone/0/ProjectorIndex`

Expected behavior is documented in:
- `docs/validation/snippets-truth-table.md`

Do not generalize one successful OSC query into a blanket readback contract.
Several BEYOND object paths have required Talk UDP-triggered PangoScript plus
`OscOutTTS` callbacks for reliable readback.

## Write Checks

Before any write check:
1. Choose the lowest-risk target zone or projector.
2. Capture baseline readback when a readback path exists.
3. Send one bounded command.
4. Confirm BEYOND changed as expected.
5. Restore the baseline or send the documented cleanup command.
6. Save the NDJSON log when the Test Console is involved.

Preview-plane writes must stay on preview-plane paths such as:

```text
/b/Zone/{zone_index}/Preview/{param}
```

Zoning/output-plane writes must follow `SPEC_23` and `SPEC_09`, including
per-zone `TestFrame` cleanup and UGC restore evidence.

Mutes workspace runtime checks must preserve the projector-vs-zone distinction:
- projector-level commands affect all BEYOND zones assigned to that physical
  projector,
- zone-level mute paths are still needed for row-specific state such as
  label/separator protection.

## Evidence Checklist

For any live BEYOND confirmation, record:
- GitHub issue number and purpose,
- BEYOND version/build when known,
- host topology, including whether BEYOND was same-machine or LAN-hosted,
- Talk UDP host/port,
- OSC In host/port,
- OSC Out destination host/port,
- exact command(s) or preset name(s),
- callback address/type/payload when applicable,
- whether the command was readback-only, preview-plane, live-output actuation,
  or output-plane/Zoning,
- cleanup/restore command when applicable,
- log filename under `logs/` when an NDJSON log was saved.

If a result changes the expected command contract, update the owning spec or
validation truth table in the same issue-scoped PR.
