import { CUE_COMMON_PROPERTIES } from "./cueCommonProperties";
import type { CueTypeEntry, ParametricImageShape } from "./cuePropertyTypes";

export function getCueTypeProperties(entry: CueTypeEntry): string[] {
  const unique = entry.uniqueProperties.map((p) => `WS.N.N.${p}`);
  const common = CUE_COMMON_PROPERTIES.map((p) => `WS.N.N.${p}`);
  return [...unique, ...common];
}

export function getCueShapeProperties(shape: ParametricImageShape, cueEntry: CueTypeEntry): string[] {
  // Shape-specific, type-level shared, then common cue properties.
  const shapeProps = shape.uniqueProperties.map((p) => `WS.N.N.${p}`);
  const typeProps = cueEntry.uniqueProperties.map((p) => `WS.N.N.${p}`);
  const common = CUE_COMMON_PROPERTIES.map((p) => `WS.N.N.${p}`);
  return [...shapeProps, ...typeProps, ...common];
}
