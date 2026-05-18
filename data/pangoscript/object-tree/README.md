# Object Tree Data Architecture

Issue #530 created the tracked contract for the Object Tree data migration.

The target data root is:

```text
data/pangoscript/object-tree/
```

## Folder Roles

| Folder | Role | Package policy |
| --- | --- | --- |
| `source-facts/` | Public-safe source facts for Object Tree path existence, value metadata, readback metadata, and behavior metadata | Not packaged directly |
| `runtime-indexes/` | Generated indexes consumed by the extension, MCP, sidebar, diagnostics, and reference site | Approved package surface only after the runtime move issue updates package checks |
| `evidence/` | Runtime evidence that supports source facts | Not packaged |
| `audits/` | Generated review reports for Object Tree data quality and remaining work | Not packaged |
| `package-projections/` | Compact package-specific data surfaces when a consumer needs less than the full runtime index | Only approved projection files may ship |

## Current Status

Tracked Object Tree path source facts now live at
`source-facts/object-paths.json`. Generated runtime indexes now live under
`runtime-indexes/`. Active value, readback, and behavior metadata now live under
`source-facts/value-metadata/`, `source-facts/readback-metadata/`, and
`source-facts/behavior-metadata/`. Active evidence and audit outputs now live
under `evidence/` and `audits/`. The manifest in `data-groups.json` names each
current path, target path, consumer, generator, package surface, and retirement
policy.

## Rollout Order

1. Issue #530: create this contract and the migration map.
2. Issue #531: generate Object Tree data from tracked source facts.
3. Issue #532: move runtime indexes and update package consumers. Done for `runtime-indexes/`.
4. Issue #533: move value, readback, and behavior metadata to product-shaped paths. Done for source metadata paths.
5. Issue #534: move evidence and audit outputs. Done for evidence and audit paths.
6. Issue #535: add a shared compact property-card lookup surface.
7. Issue #536: lock package checks and remove retired paths.

## Rules

- Do not remove active data before replacement paths exist and consumers move.
- Do not ship `source-facts/`, `evidence/`, or `audits/` in VSIX or MCP
  packages.
- Keep generated files reproducible from tracked source facts.
- Keep file names about product facts, such as Object Tree path, value range,
  readback, behavior, or package projection.
