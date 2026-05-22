# Object Property Index Scripts

This folder contains the Object Tree property index generator modules.

- `objectPropertyIndexSourceFacts.ts` loads tracked Object Tree source facts and FX labels.
- `objectPropertyIndexEntries.ts` builds generated runtime index entries from source facts.
- `objectPropertyIndexCommandMetadata.ts` seeds value metadata from exact command property targets.
- `objectPropertyIndexMetadata.ts` loads and applies value, readback, and behavior metadata overlays.
- `objectPropertyIndexValidation.ts` validates metadata overlay shape before it enters the generated index.
- `objectPropertyIndexSearchText.ts` builds searchable text for generated entries and metadata.
- `objectPropertyIndexPaths.ts` owns repository paths and Object Tree path helpers.
- `objectPropertyIndexTypes.ts` keeps generator-only data contracts in one place.

`../generateObjectPropertyIndex.ts` is the command entry point. It wires these modules together and writes the generated runtime index.
