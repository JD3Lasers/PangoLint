# Object Tree Testing Methodology

Last updated: 2026-05-17

## Purpose

Use this runbook when extending Object Tree value metadata, readback metadata,
or behavior classification for issue #216. It explains how to test a path so
another agent can resume the work without repeating the same probes or shipping
baseline-only data as if it proved behavior.

This document works with:

- `docs/specs/2026-05-17-object-tree-behavior-classification.md`
- `docs/runbooks/object-range-batch-probes.md`
- `docs/runbooks/beyond-runtime-command-runbook.md`
- `data/pangoscript/object-tree/audits/readback/issue-216-readback-write-audit.json`

## Core Rules

- Work one root, category, or repeated behavior family per PR.
- Read the current `object-property-index.json` and current audit reports before
  choosing rows.
- Do not infer behavior from names alone.
- Do not infer new behavior classifications from checked-in value or readback
  metadata that predates the behavior-classification workflow. Existing
  metadata can guide probe selection, but each new behavior classification needs
  fresh BEYOND write/readback evidence from the current pass.
- If a fresh spot check disagrees with checked-in metadata, stop using that
  metadata as proof for related rows. Record the discrepancy, update the stale
  metadata when the new evidence is strong enough, or leave the row unresolved.
- Do not call a row `read-only` from a successful readback alone.
- Do not ship writable value metadata unless the accepted domain is supported by
  write/readback, command/readback, or equivalent concrete evidence.
- If the row is indexed, showfile-specific, or hardware-dependent, record the
  exact concrete probe path and loaded context.
- Restore changed values unless restore is not needed, impossible, or the path
  is a documented momentary action. Record that decision.
- Keep public metadata free of private machine paths and raw local tooling
  names.

## Before Probing

Start from a clean branch based on current `main`.

```bash
git status --short --branch
git branch --show-current
npm run build:object-properties
```

Confirm runtime capability before live reads or writes:

- Call `getServerConfig`.
- Confirm `runtimeReadEnabled` before readback probes.
- Confirm `runtimeWriteEnabled` before write tests.
- Use `healthCheck` when available.
- Confirm the BEYOND test bench has the expected show, cue, QuickFX, hardware,
  or universe setup for the paths being tested.

If local git state changes unexpectedly, stop and re-check:

```powershell
Get-CimInstance Win32_Process -Filter "name = 'git.exe'"
git status --short --branch
git branch --show-current
```

Only stop stale git processes when they are clearly orphaned read-only monitor
commands or stuck commands from the current session.

## Choose A Batch

Use the largest coherent batch that answers one question and can be freshly
verified in the current pass:

- one Object Tree root such as `Master`, `FX`, `WS`, `Hardware`, or `QShift`
- one concrete cue or QuickFX type from a populated slot
- one repeated indexed family that shares the same observed behavior
- one audit bucket such as baseline-only readbacks for a single source file

Small batches are acceptable when runtime setup or fixture context is narrow.
When the remaining rows share one probe method and can be restored cleanly,
prefer a larger PR so issue #216 reaches final documentation in fewer review
cycles.

Before editing data, make a grouped inventory:

- total rows in the batch
- rows with shipped value metadata
- rows with shipped readback metadata
- rows with write-tested readback evidence
- rows with baseline-only readback evidence
- rows with no current metadata
- rows that require populated locations or fixture setup

## Probe Shape

For each object path, collect a baseline first:

- normalized `objectPath`
- concrete `probePath`
- root and source file
- current readback value
- OSC type tag when available
- BEYOND build or runtime date when known
- loaded context, such as page/cue, QuickFX slot, projector index, hardware
  type, selected item, or universe panel

When testing a write, prefer one Talk batch that writes the value and then emits
an `OscOutTTS` readback. This avoids timing artifacts from separate write and
readback calls.

For each tested value, record:

- input text sent to BEYOND
- parsed input type, such as integer, float, string, boolean, or enum
- readback value and type tag
- accepted, rejected, clamped, pass-through, no-op, or transformed behavior
- side effect when the path is an action or runtime control
- restore value and restore readback

## Value Samples

Do not use the same sample set blindly for every path. Start with the path
family, existing evidence, and expected value type, then record skipped samples
when they would not prove anything.

### Numeric Values

Use numeric samples to prove both accepted domain and boundary behavior:

- baseline
- `0`
- `1`
- `-1` when negative values may be valid
- a small in-domain value such as `10` or `50`
- an expected high value such as `100`, `1000`, or the documented UI maximum
- one value below the expected minimum
- one value above the expected maximum
- a float sample such as `0.5` or `1.25` when the path may accept floats

For paths that may use larger integer domains, sample-rate style values, memory
fields, counters, or signed 32 bit values, include larger probes when the test
is reversible:

- `100000`
- `120000`
- `2147483647`
- `-2147483648` when signed values are plausible

Do not assume a UI maximum is the PangoScript maximum. If BEYOND accepts a value
above the UI maximum through PangoScript, record that result explicitly.

### Integer Versus Float

If a path looks numeric, test integer and float input separately unless previous
evidence for the same family already proves the conversion rule.

Classify the result as:

- integer-only: floats reject or round in a consistent way
- float: fractional values read back with useful precision
- numeric pass-through: large or fractional values read back without meaningful
  bounds
- transformed: input is accepted but readback changes by rounding, scaling, or
  clamping

### Boolean And Flag Values

For `0/1` candidates, test behavior, not just accepted values:

- baseline
- `0`
- `1`
- repeat the baseline value
- one out-of-domain value such as `2` or `-1`
- string forms such as `"0"` or `"1"` only when the path may accept strings or
  previous evidence shows type conversion

Classify as `flag-state` only when readback proves the value persists as state.
If a write triggers an edge event and readback does not persist the input,
classify it as `momentary-action` or keep it unresolved.

### Strings

For string-like paths, use plain ASCII samples first:

- baseline
- empty string
- short plain string such as `PangoLintTest`
- string with spaces such as `PangoLint Test`
- longer string that stays readable in the UI
- punctuation only when the path is meant to store names, captions, file paths,
  or script text

Record whether BEYOND preserves case, trims whitespace, rejects empty strings,
escapes quotes, or changes the readback.

### Enums And Named Domains

For enum-like paths:

- test every documented or observed accepted value when the set is small
- test representative values when the set is large
- test one invalid value
- record labels separately from numeric storage values

Do not turn an observed current value into an enum domain unless writes prove
the accepted set or public documentation defines it.

## Classify Behavior

Use the behavior classification spec terms.

### read-write state-value

Use when writes change stored or runtime state and readback shows the resulting
value. Required evidence:

- baseline readback
- at least two accepted writes unless the domain is boolean
- min/max, accepted values, or a documented dynamic max
- boundary behavior
- restore readback

### flag-state

Use when `0/1`, true/false, or equivalent values persist as state. Required
evidence:

- write false value and read back false state
- write true value and read back true state
- restore original state
- out-of-domain behavior when tested

### momentary-action

Use when the write triggers an action rather than storing the input as state.
Required evidence:

- accepted trigger value or command form
- observed side effect or public documentation
- readback after trigger, if useful
- whether `0`, false, or an empty string has meaning
- restore or cleanup note when the action changes playback, routing, output,
  geometry, zoning, selection, or show state

Do not document a momentary action as a persistent flag.

### read-only computed-status

Use when readback is useful and write attempts prove the path does not accept
state changes. Required evidence:

- successful readback
- write-no-op, write-rejected, or public documentation proving read-only status
- observed type and volatility notes

A baseline readback without a write test stays unresolved.

### write-only control

Use when writes have useful side effects but readback is absent or not useful.
Required evidence:

- accepted write value or command form
- observed side effect or public documentation
- failed or meaningless readback evidence
- restore or cleanup note

### unknown

Use when the path exists but access or behavior is not proven. Required record:

- why it is unresolved
- next probe needed
- context needed, such as populated cue, loaded QuickFX type, hardware instance,
  selected object, or universe setup

## No-Op And Pass-Through Results

No-op and pass-through are useful findings, but they are not automatically
shippable value metadata.

Use `write-no-op-tested` when:

- baseline was captured
- a write was sent
- readback stayed at baseline
- a nearby control or repeated sample proves the test path was addressed
- the evidence report records the input and readback

Use pass-through only when BEYOND accepts broad inputs and readback echoes them
without a proven meaningful domain. Pass-through can support a behavior audit,
but do not ship a min/max range unless the accepted domain is actually bounded
or documented.

If a surprising readback appears, bracket it immediately with nearby probes
before recording a conclusion.

## Evidence Files

Use existing evidence schemas until the behavior audit generator lands.

For writable value metadata:

- write an evidence report in `data/pangoscript/object-tree/evidence/value/`
- validate it with `npm run validate:object-range-evidence -- path/to/file.json`
- add source metadata under `data/pangoscript/object-tree/source-facts/value-metadata/`

For readback metadata:

- write evidence under `data/pangoscript/object-tree/evidence/readback/`
- add readback metadata under `data/pangoscript/object-tree/source-facts/readback-metadata/`
- keep baseline-only rows visible in
  `data/pangoscript/object-tree/audits/readback/issue-216-readback-write-audit.json`

For future behavior classification:

- use the generated behavior audit path from the spec:
  `data/pangoscript/object-tree/audits/behavior/issue-216-object-behavior-audit.json`
- keep `accessMode`, `behaviorKind`, `writeTestStatus`, `readbackStatus`, and
  `evidenceLevel` separate

## Resume Checklist

A new agent should be able to resume from these artifacts:

- branch name and PR number, if any
- Object Tree root or category under test
- source files edited
- evidence report path
- current audit counts for the batch
- rows completed
- rows deferred with `deferReason`
- exact runtime commands or MCP calls used
- restore status
- validation commands already run
- next concrete row or source file to test

Do not continue stale local files from another branch unless they match the
current issue, current `main`, and current audit report.

## Completion Criteria

A batch is complete when:

- every row in scope has shipped metadata or an explicit defer reason
- every shipped value row has accepted-domain evidence
- every read-only row has more than baseline readback evidence
- every `0/1` row is separated into flag-state, momentary-action, or unresolved
- generated `object-property-index.json` reflects the intended metadata
- audit reports are regenerated from current data
- `npm run check` passes
- the PR body lists shipped rows, deferred rows, evidence files, and validation

Merge only after hosted CI passes and Codex review reports no major issues on
the current PR head.
