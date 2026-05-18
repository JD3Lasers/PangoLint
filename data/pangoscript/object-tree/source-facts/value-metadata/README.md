# Object Tree Value Metadata Sources

This folder contains hand-authored value metadata files that are loaded in
addition to `root.json`.

Use this folder when a value observation belongs to a specific runtime context,
such as a Workspace cue type or a QuickFX effect placement. Keep broad,
root-level entries in the root overlay only when the value metadata is truly
generic to that normalized Object Tree path.

Recommended layout:

- `ws/cue-type.<cue-label>.json` for Workspace cue type evidence.
- `ws/cue-type.<cue-label>.<family>.json` for larger cue type families.
- `fx/<effect-label>.json` for QuickFX effect placement evidence.
- `<root>.json` for smaller non-Workspace roots.

Each file uses the same schema as `root.json`:

```json
{
  "schemaVersion": 1,
  "entries": []
}
```

Evidence rules are unchanged:

- Record the exact concrete path probed in notes.
- Use `contextId` when the metadata applies only to one probe context.
- Do not infer ranges or enums from matching property names.
- Do not copy observations between cue slots, cue types, or FX slots without
  direct evidence.
