# Object Range Batch Probes

Use this runbook for larger Object Tree range/domain PRs tracked from issue
#216. The goal is to make each PR reviewable while still shipping verified data
only.

## Batch Shape

Prefer one issue branch and one PR per evidence family. A larger PR is
appropriate when every row in the batch uses the same probe method, has fresh
write/readback evidence from the current pass, and can be restored cleanly:

- one small root family such as `Config`, `VideoOutput1`, or `TouchPoints`
- one repeated behavior family such as Master color fields
- one concrete WS cue type from a populated workspace slot
- one concrete FX effect type from a populated QuickFX slot
- one Universe control type from the loaded show

Do not mix unrelated roots just to increase PR size. A larger PR is useful only
when the evidence can be read as one coherent report. Checked-in metadata from
older passes can guide sample selection, but it must not be used as proof for a
new behavior classification when fresh spot checks show discrepancies.

## Evidence File

For each batch, keep a JSON evidence report while probing. Validate it with:

```bash
npm run validate:object-range-evidence -- path/to/evidence.json
```

The evidence report follows
`data/pangoscript/object-tree/evidence/value.schema.json`. Each entry records:

- normalized `objectPath`
- concrete `probePath`
- probe mode: readback-only, write-readback, command-readback, or command-write-readback
- observed baseline
- tested values and readbacks
- accepted min/max or enum/domain when metadata will ship
- boundary behavior
- restore strategy and restored value
- runtime date and evidence note
- whether the path is location-aware

Entries with `"shipsMetadata": true` must include either `valueRange.min` and
`valueRange.max`, or non-empty `acceptedValues`. Baseline-only entries must use
`"shipsMetadata": false` and include `deferReason`.

## Probe Rules

- Call `getServerConfig` before runtime reads or writes.
- Use populated concrete paths for `WS.N.N` and `FX.N.N.N` probes.
- Do not infer ranges from matching names.
- Do not treat a missing value at one location as proof that a type lacks a property.
- Restore any changed value, selected view, playlist state, cue state, or FX state.
- If a write and readback can race, send the write and `OscOutTTS` readback in the same Talk batch.

## PR Rules

Each PR should include:

- issue link
- evidence report summary
- list of shipped `[object] [type] [range/domain]` rows
- list of probed but deferred rows
- validation commands

Run the normal gate before merge:

```bash
npm run build:object-properties
npm run validate:object-range-evidence -- path/to/evidence.json
npm run check
```

Merge only after hosted CI passes and Codex review reports no major issues on
the current PR head.
