import type { ReferenceObject, ReferenceObjectProperty } from "../types";
import { propertySectionsWithCommonControls, sortObjectProperties } from "./objectPropertySections";
import type {
  CueTypePropertySections,
  CueTypeReference,
  ObjectPropertyReferenceDetail,
  ObjectPropertyReferenceRow,
  ObjectPropertySection,
} from "./objectTreeTypes";

interface CueTypePropertyGroups {
  propertiesByCueType: Map<string, ReferenceObjectProperty[]>;
  cueTypesByPath: Map<string, Set<string>>;
  cueTypeLabels: string[];
}

export function buildCueTypeReference(objects: ReferenceObject[]): CueTypeReference {
  const wsObj = objects.find((o) => o.name === "WS");
  if (!wsObj) return { rows: [], details: [], uniquePropertyCount: 0, typeCount: 0 };

  const { propertiesByCueType, cueTypesByPath, cueTypeLabels } = cueTypePropertyGroups(wsObj);
  if (!cueTypeLabels.length) return { rows: [], details: [], uniquePropertyCount: 0, typeCount: 0 };

  const commonProperties = sortObjectProperties(
    wsObj.properties.filter((prop) => cueTypesByPath.get(prop.path)?.size === cueTypeLabels.length),
  );
  const commonPaths = new Set(commonProperties.map((prop) => prop.path));

  const rows: ObjectPropertyReferenceRow[] = [];
  const details: ObjectPropertyReferenceDetail[] = [];
  for (const label of cueTypeLabels) {
    const typeProperties = sortObjectProperties(propertiesByCueType.get(label) ?? []);
    const nonCommonProperties = typeProperties.filter((prop) => !commonPaths.has(prop.path));
    const sections = propertySectionsWithCommonControls("Common cue controls", commonProperties, `${label} controls`, [
      ...nonCommonProperties,
    ]);
    rows.push({
      id: label,
      label,
      propertyCount: typeProperties.length,
    });
    details.push({
      id: label,
      label,
      root: "WS",
      propertyCount: typeProperties.length,
      sections,
    });
  }

  return {
    rows,
    details,
    uniquePropertyCount: cueTypesByPath.size,
    typeCount: cueTypeLabels.length,
  };
}

export function buildCueTypePropertySections(objects: ReferenceObject[]): CueTypePropertySections {
  const wsObj = objects.find((o) => o.name === "WS");
  if (!wsObj) return { sections: [], uniquePropertyCount: 0, typeCount: 0 };

  const { propertiesByCueType, cueTypesByPath, cueTypeLabels } = cueTypePropertyGroups(wsObj);
  if (!cueTypeLabels.length) return { sections: [], uniquePropertyCount: 0, typeCount: 0 };

  const commonProperties = wsObj.properties.filter(
    (prop) => cueTypesByPath.get(prop.path)?.size === cueTypeLabels.length,
  );
  const commonPaths = new Set(commonProperties.map((prop) => prop.path));
  const sections: ObjectPropertySection[] = [];
  if (commonProperties.length) {
    sections.push({
      label: "Common cue controls",
      description: `${cueTypeLabels.length} ${cueTypeLabels.length === 1 ? "cue type" : "cue types"}`,
      properties: sortObjectProperties(commonProperties),
    });
  }

  for (const label of cueTypeLabels) {
    const properties = sortObjectProperties(
      (propertiesByCueType.get(label) ?? []).filter((prop) => !commonPaths.has(prop.path)),
    );
    if (!properties.length) continue;
    sections.push({ label, properties });
  }

  return {
    sections,
    uniquePropertyCount: cueTypesByPath.size,
    typeCount: cueTypeLabels.length,
  };
}

function cueTypePropertyGroups(wsObj: ReferenceObject): CueTypePropertyGroups {
  const propertiesByCueType = new Map<string, ReferenceObjectProperty[]>();
  const cueTypesByPath = new Map<string, Set<string>>();

  for (const prop of wsObj.properties) {
    const labels = new Set(prop.probeContexts?.filter((c) => c.kind === "cue-type").map((c) => c.label) ?? []);
    if (!labels.size) continue;
    cueTypesByPath.set(prop.path, labels);
    for (const label of labels) {
      const bucket = propertiesByCueType.get(label) ?? [];
      bucket.push(prop);
      propertiesByCueType.set(label, bucket);
    }
  }

  return {
    propertiesByCueType,
    cueTypesByPath,
    cueTypeLabels: [...propertiesByCueType.keys()].sort((a, b) => a.localeCompare(b)),
  };
}
