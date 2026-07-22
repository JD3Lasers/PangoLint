import type {
  ObjectPropertyBehaviorClassification,
  ObjectPropertyProbeContext,
  ObjectPropertyReadbackMetadata,
  ObjectPropertyValueMetadata,
} from "../../../src/knowledge/objectPropertyIndex";
import { compareDottedPath } from "./objectPropertyIndexPaths";
import type { NormalizedPathEntry } from "./objectPropertyIndexTypes";

export function compareProbeContexts(left: ObjectPropertyProbeContext, right: ObjectPropertyProbeContext): number {
  return (
    compareDottedPath(left.probePrefix, right.probePrefix) ||
    left.kind.localeCompare(right.kind) ||
    (left.parentLabel ?? "").localeCompare(right.parentLabel ?? "") ||
    left.label.localeCompare(right.label) ||
    left.probePrefix.localeCompare(right.probePrefix, undefined, { numeric: true })
  );
}

export function probePath(context: ObjectPropertyProbeContext, property: string): string {
  return `${context.probePrefix}.${property}`;
}

export function probeOsc(context: ObjectPropertyProbeContext, property: string): string | undefined {
  return context.probeOscPrefix ? `${context.probeOscPrefix}/${property.replaceAll(".", "/")}` : undefined;
}

export function probeContextSearchText(contexts: readonly ObjectPropertyProbeContext[]): string {
  return contexts
    .flatMap((context) => [
      context.id,
      context.kind,
      context.label,
      context.parentLabel,
      context.normalizedPrefix,
      context.probePrefix,
      context.probeOscPrefix,
      context.qfxPanel,
      context.cellCaption,
      context.channel,
      context.notes,
      context.populationDependent ? "population dependent sample probe location" : undefined,
    ])
    .filter((value): value is string => Boolean(value))
    .join(" ");
}

export function buildSearchText(normalizedPath: string, group: NormalizedPathEntry[]): string {
  const tokens = new Set<string>();
  const add = (value: string | undefined) => {
    if (!value) return;
    for (const token of tokenize(value)) tokens.add(token);
  };

  add(normalizedPath);
  add(splitCamel(normalizedPath));
  for (const entry of group) {
    add(entry.path);
    if (!entry.isGenericAlias) {
      add(entry.osc);
      add(entry.searchText);
    }
    add(entry.root);
    add(entry.fx?.qfxPanel);
    add(entry.fx?.cellCaption);
    add(entry.fx?.label);
    add(entry.fx?.channel);
  }
  return [...tokens].join(" ");
}

export function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9#]+/)
    .filter(Boolean);
}

export function mergeSearchText(left: string, right: string): string {
  return [...new Set(tokenize(`${left} ${right}`))].join(" ");
}

export function splitCamel(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
}

export function slug(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "unnamed"
  );
}

export function valueMetadataSearchText(metadata: ObjectPropertyValueMetadata): string {
  return [
    metadata.valueType,
    metadata.unit,
    metadata.valueRange?.unit,
    metadata.valueRange?.dynamicMax?.expression,
    ...(metadata.valueRange?.dynamicMax?.sourcePaths ?? []),
    metadata.valueRange?.dynamicMax?.notes,
    metadata.valueRange?.boundaryBehavior,
    metadata.valueRange?.notes,
    metadata.evidenceLevel,
    metadata.notes,
    metadata.locationContext?.kind,
    metadata.locationContext?.indexBasis,
    metadata.locationContext?.notes,
    ...(metadata.locationContext?.populationDependent ? ["population dependent populated slot location aware"] : []),
    ...(metadata.acceptedValues ?? []).flatMap((value) => [String(value.value), value.label, value.description]),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");
}

export function readbackMetadataSearchText(metadata: ObjectPropertyReadbackMetadata): string {
  return [
    "readback",
    metadata.accessMechanism,
    metadata.valueType,
    metadata.probePath,
    metadata.probeMode,
    metadata.typeTag,
    metadata.evidenceLevel,
    metadata.notes,
    metadata.locationContext?.kind,
    metadata.locationContext?.indexBasis,
    metadata.locationContext?.notes,
    ...(metadata.locationContext?.populationDependent ? ["population dependent populated slot location aware"] : []),
    metadata.observedValue === undefined ? undefined : String(metadata.observedValue),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");
}

export function behaviorClassificationSearchText(metadata: ObjectPropertyBehaviorClassification): string {
  return [
    "behavior classification access mode",
    metadata.accessMode,
    metadata.behaviorKind,
    metadata.writeTestStatus,
    metadata.readbackStatus,
    metadata.evidenceLevel,
    metadata.notes,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");
}
