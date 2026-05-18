# Object Control Reference

This folder contains a generated object-control reference dataset for BEYOND
Workspace cues, Parametric Image variants, Universe components, FX effects, and
global object roots.

The dataset is organized for two uses:

- user-facing reference documentation, so an operator can find object paths and
  OSC paths without drilling through the BEYOND Object Tree
- linting and validation, so PangoLint can check object paths against the
  object type or effect type that makes those paths available

Use the object paths, OSC paths, labels, address forms, status, and property
sets as the reference surface.

## Files

- `summary.json`: counts, status totals, and high-level dataset notes
- `workspace-cue-types.json`: cue-type entries from Workspace page 0
- `workspace-parametric-image-types.json`: Parametric Image variant entries
- `universe-component-types.json`: Universe component entries
- `fx-effect-types.json`: FX effect entries joined to menu labels and cells
- `nested-cue-type-projections.json`: inherited child cue properties under
  Synthesized Image nested cue prefixes
- `global-object-roots.json`: broad object-root entries not tied to one placed type
- `property-sets.json`: shared property-list shapes across entries
- `property-index.json`: lookup from relative property path to typed entries
- `object-path-index.jsonl`: one JSON line per concrete object path and OSC path
- `object-path-pattern-index.jsonl`: one JSON line per generated object path
  pattern

## Record Notes

- `addressForms` are PangoScript-style object addresses.
- `oscAddressForms` are the matching OSC address prefixes.
- `binding` explains whether a type is placement-bound or portable.
- `lookup` gives sidebar and documentation labels without parsing addresses.
- `properties[].path` is relative to an entry address form.
- `properties[].objectPaths` and `properties[].oscPaths` list concrete paths.
- `properties[].objectPathPatterns` and `properties[].oscPathPatterns` list
  generated validation patterns.
- `propertySetId` groups entries with identical relative property lists.
- Cue records use `binding.kind: locationBoundCue` because their object
  trees depend on the concrete `WS.N.N` placement.
- `Synthesized Image` records include `nestedCueContainer` because they can
  contain child cue types.
- Cue records that can be added inside a `Synthesized Image` include
  `nestedPlacement`.
- Nested cue type projections use the direct Workspace cue property set behind
  the `Image.LIST.N` relative prefix.
- `Parametric-Image` records include `parametricFormContainer` because a
  Parametric Image cue can contain multiple internal form types.
- Parametric Image form entries use `binding.kind:
  portableParametricImageForm` and retain the page 1 sample address as sample
  evidence for the single-form property tree.
- FX records use `binding.kind: portableEffectType` because the same effect
  type can appear under multiple container prefixes.
- `status: captured` means the property tree was present in the current capture.
- `status: operatorConfirmed` means the tree shape was supplied by an operator
  note and modeled from an equivalent captured tree.

## Known Normalizations

- The Timeline Video component is named `TlVideo1`.
- `ZonePad2` uses the same property tree as `ZonePad1`, with
  `targetAddressMode: zoneName`.
