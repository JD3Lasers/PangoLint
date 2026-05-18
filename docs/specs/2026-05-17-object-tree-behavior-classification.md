# Object Tree Behavior Classification

Date: 2026-05-17
Status: Proposed design for the next Object Tree metadata migration.

## Purpose

PangoLint now has full Object Tree classified coverage, but the classification
does not yet say enough about how each path behaves. A row with readback
metadata can mean either "we only read this so far" or "write attempts proved
this is not writable." A `0/1` row can be a persistent flag, a momentary action,
or a status readback. Those cases need different editor text, reference text,
runtime prompts, and follow-up tracking.

This spec defines the behavior classification model that should sit beside the
existing value and readback metadata. The goal is to make the dataset useful as
operator documentation, not only as a coverage checklist.

## Current Dataset Shape

Current checked-in Object Tree data after PR #477:

- `5375` Object Tree entries.
- `5375` entries classified, `0` unclassified gaps.
- `3190` entries with value metadata.
- `2185` entries with readback metadata.
- `0` entries with both value metadata and readback metadata.
- `6346` value metadata rows when context-specific rows are counted.
- `1747` readback rows still have baseline-only readback metadata and need
  write/readback retest before they can be called proven read-only.

The current schemas already support useful detail:

- value type: number, integer, float, string, boolean, enum, unknown.
- value range: min, max, dynamic max, unit, inclusivity, boundary behavior.
- accepted values for flags and enumerations.
- readback probe path, observed value, OSC type tag, evidence date, and notes.
- evidence reports with baseline, tested values, restore method, and defer
  reason.

The missing piece is an explicit behavior classification that separates access
mode from value shape and evidence strength.

## Design Goals

- Keep value metadata, readback metadata, and behavior classification separate.
- Do not promote baseline reads into writable range metadata.
- Do not call a row read-only until write attempts or documentation prove that
  status.
- Do not treat every `0/1` path as the same thing.
- Make tracking reports list the next evidence needed for each unresolved row.
- Keep public data free of private lab identifiers and raw maintainer tooling
  paths.
- Let old consumers continue to read value and readback metadata during the
  migration.

## Non-Goals

- This spec does not change runtime safety tiers.
- This spec does not retest the remaining baseline-only rows.
- This spec does not remove existing value or readback metadata fields.
- This spec does not infer behavior from path names alone.

## Behavior Model

Add an optional `classification` object to each Object Tree entry. The object
should be generated into `object-property-index.json` from overlay data and
audit results.

```json
{
  "classification": {
    "accessMode": "read-write",
    "behaviorKind": "state-value",
    "writeTestStatus": "write-readback-tested",
    "readbackStatus": "readback-tested",
    "evidenceLevel": "observed",
    "notes": "Runtime SetProp write/readback accepted values 0..300 and restored the baseline."
  }
}
```

### accessMode

`accessMode` describes what PangoScript can do with the path.

- `read-write`: Writes are accepted and readback shows the resulting state.
- `read-only`: Readback is useful, and write attempts are no-op, rejected, or
  documented as not supported.
- `write-only`: Writes are useful, but readback is absent or not useful.
- `read-mostly`: Some writes are accepted, but readback is derived from runtime
  state or does not reliably echo the input.
- `unknown`: The path exists, but access behavior is not proven.

`read-only` requires stronger evidence than a baseline read. A row with only a
successful readback probe should remain `unknown` with `readbackStatus:
readback-tested` until a write test or documentation proves read-only behavior.

### behaviorKind

`behaviorKind` describes what the value means.

- `state-value`: A writable value that changes stored or runtime state, such as
  BPM, size, position, time, or speed.
- `flag-state`: A persistent boolean or `0/1` state, such as enabled, visible,
  mute, active, or selected when the readback reflects the state.
- `momentary-action`: A write triggers an action or edge event. The value is not
  a persistent state, even when the accepted input looks like `1` or `0/1`.
- `enum-state`: A writable state selected from named values.
- `string-state`: A writable string field such as a name, caption, or script
  text when writes persist or read back.
- `computed-status`: A readback derived from BEYOND runtime state, hardware
  state, show content, playback, or counters.
- `alias-status`: A showfile-specific alias or user-configured object name that
  needs address context to interpret.
- `fixture-dependent`: A path whose behavior depends on a populated cue,
  QuickFX slot, hardware instance, universe panel, or loaded show element.
- `unknown`: The path exists, but behavior is not proven.

`fixture-dependent` can be combined with a more specific behavior in notes or a
future array field if needed. For the first migration, use the most actionable
classification and keep fixture details in `locationContext`.

### writeTestStatus

`writeTestStatus` records how much write evidence exists.

- `not-tested`: No checked-in write attempt.
- `write-readback-tested`: A write was sent and readback was captured.
- `command-readback-tested`: A command changed the value and readback was
  captured.
- `write-no-op-tested`: A write was sent, readback stayed at baseline, and the
  evidence supports no-op behavior.
- `write-rejected-tested`: A write was sent and rejected or produced no accepted
  readback.
- `documented-writable`: Documentation supports writing, but local runtime
  evidence is not checked in.
- `documented-read-only`: Documentation supports read-only behavior.
- `not-applicable`: Writes do not apply to this path class.

### readbackStatus

`readbackStatus` records the read evidence separately from write evidence.

- `not-tested`: No checked-in readback probe.
- `readback-tested`: A readback probe returned a value.
- `readback-not-available`: Readback did not return a useful value.
- `documented-readable`: Documentation supports readback, but local runtime
  evidence is not checked in.
- `not-applicable`: Readback does not apply to this path class.

### evidenceLevel

`evidenceLevel` describes the evidence behind the behavior classification, not
the evidence behind every individual metadata field. It is required when a
`classification` object exists.

- `observed`: Checked-in runtime evidence proves the declared `accessMode` and
  `behaviorKind`.
- `documented`: BEYOND documentation or another public reference proves the
  declared behavior, but local runtime evidence is not checked in.
- `inferred`: The declared behavior is derived from adjacent indexed paths,
  known object structure, or prior grouped results. Use this for tracking only,
  not for final public documentation.
- `unverified`: The row is unresolved. Use this for unknown, deferred, and
  baseline-only readback rows.

A baseline readback alone can set `readbackStatus: readback-tested`, but it must
not set `evidenceLevel: observed` for `read-only` unless a write-no-op,
write-rejected, or documentation source proves the access behavior.

## Required Data By Classification

### read-write state-value

Required data:

- `accessMode: read-write`
- `behaviorKind: state-value`
- `valueType`
- `valueRange` with min and max, or `acceptedValues`
- `boundaryBehavior`
- write input samples and readback results in an evidence report
- baseline restore result or reason restore was not needed
- `locationContext` when the path is indexed, showfile-specific, or
  fixture-dependent

### read-write flag-state

Required data:

- `accessMode: read-write`
- `behaviorKind: flag-state`
- `valueType: boolean` or integer accepted values that represent false and true
- `acceptedValues` with labels for false and true
- readback proof that the value remains set after write
- behavior for out-of-domain samples when tested

### momentary-action

Required data:

- `accessMode: write-only`, `read-mostly`, or `read-write`, depending on
  evidence
- `behaviorKind: momentary-action`
- accepted trigger value or command form
- whether `0`, `false`, or an empty string has meaning
- observed side effect or documented action
- readback behavior after the action, if any
- restore or safety notes when the action affects playback, output, routing,
  zoning, geometry, or show state

Momentary actions must not be documented as persistent flags unless readback
proves they are persistent.

### read-only computed-status

Required data:

- `accessMode: read-only`
- `behaviorKind: computed-status`
- `valueType`
- `probePath`
- observed value and OSC type tag when available
- proof source for read-only behavior: write-no-op, write-rejected, or
  documented-read-only
- volatility notes when the value changes with playback, hardware, loaded show,
  counters, or current selection

### write-only control

Required data:

- `accessMode: write-only`
- `behaviorKind` matching the control behavior
- accepted write values or command form
- observed side effect or documentation
- readback-not-available evidence, or reason readback is not useful
- restore or safety notes

### unknown or deferred row

Required data:

- `accessMode: unknown`
- `behaviorKind: unknown` or the best safe partial value
- reason it is unresolved
- next probe needed
- location or fixture dependency when known

Unknown rows should be allowed in audit reports, but should not be presented as
complete documentation.

## Audit Report Shape

Add a generated report under `data/pangoscript/object-tree/audits/behavior/`.

The first report should be named:

```text
data/pangoscript/object-tree/audits/behavior/issue-216-object-behavior-audit.json
```

Suggested top-level shape:

```json
{
  "schemaVersion": 1,
  "parentIssue": 216,
  "generatedAt": "2026-05-17T00:00:00.000Z",
  "summary": {
    "totalEntries": 5375,
    "classifiedEntries": 5375,
    "accessModeKnownEntries": 0,
    "behaviorKnownEntries": 0,
    "needsWriteTestRows": 1747,
    "needsActionFlagReviewRows": 0,
    "needsBoundaryProofRows": 0
  },
  "byRoot": [],
  "trackingBuckets": []
}
```

Each tracking bucket should include:

- `bucket`: stable bucket name.
- `count`: number of rows.
- `roots`: counts by root.
- `examples`: representative object paths.
- `nextAction`: the next test or schema work needed.

Initial tracking buckets:

- `baseline-readback-needs-write-test`
- `write-tested-no-op-readback`
- `proven-read-write-state`
- `proven-flag-state`
- `possible-momentary-action`
- `range-needs-boundary-proof`
- `context-dependent`
- `classification-missing`

The report should be deterministic and covered by a focused test that compares
the report to the current object index and overlay files.

## Migration Plan

### Phase 1: Spec and Tracking Report

- Add this spec.
- Add an audit generator that reads `object-property-index.json`, value
  overlays, readback overlays, and evidence reports.
- Produce the first Object Tree behavior audit report.
- Do not change shipped metadata shape yet.

### Phase 2: Schema Fields

- Add optional `classification` to TypeScript types and JSON schemas.
- Add overlay schema support for explicit classification entries.
- Generate `classification` into `object-property-index.json`.
- Keep existing `valueMetadata` and `readbackMetadata` unchanged.

### Phase 3: Public Surfaces

- Show behavior classification in sidebar object details and reference output.
- Expose behavior classification through MCP lookup and search results.
- Keep wording conservative when `accessMode` or `behaviorKind` is unknown.

### Phase 4: Retest Backlog

- Work one root or category at a time.
- For every baseline-only readback row, perform write/readback testing before
  marking it read-only.
- For every `0/1` path, decide whether it is a flag-state or
  momentary-action based on readback and side effect evidence.
- Update the behavior audit after each merged slice.

## Acceptance Criteria

- The spec defines access, behavior, write evidence, and readback evidence as
  separate concepts.
- The first audit report can be generated without live BEYOND access.
- Baseline-only readback rows remain visible as debt until write/readback
  evidence exists.
- Existing extension, MCP, and reference consumers keep working during the
  migration.
- `npm run check` remains the completion gate for every implementation slice.

## Open Questions

- Should `fixture-dependent` be a `behaviorKind`, or should it only live in
  `locationContext`?
- Should `read-mostly` be part of `accessMode`, or should it be represented as
  `read-write` plus a readback note?
- Should behavior classification live directly on `ObjectPropertyEntry`, or in
  a nested `classification` object only?
- Should action side effects get a structured field in this migration, or stay
  in evidence notes until enough examples exist?
