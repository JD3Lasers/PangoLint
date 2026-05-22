import type { ReferenceObject, ReferenceObjectProperty, ReferenceUniverseComponent } from "../types";
import type {
  ObjectPropertyReferenceDetail,
  ObjectPropertyReferenceRow,
  ObjectPropertySection,
  UniverseComponentReference,
} from "./objectTreeTypes";

export function buildUniverseComponentReference(
  objects: ReferenceObject[],
  components: ReferenceUniverseComponent[] = [],
): UniverseComponentReference {
  const universe = objects.find((objectSchema) => objectSchema.name === "Universe");
  if (!universe || components.length === 0) return { rows: [], details: [], componentCount: 0 };

  const propertyByPath = new Map(universe.properties.map((property) => [property.path, property]));
  const entries: Array<{
    componentIndex: number;
    group: string;
    row: ObjectPropertyReferenceRow;
    detail: ObjectPropertyReferenceDetail;
  }> = [];

  for (const component of [...components].sort((a, b) => a.componentIndex - b.componentIndex)) {
    const properties = component.properties
      .map((property) => findUniverseComponentProperty(property.objectPaths, component.defaultName, propertyByPath))
      .filter((property): property is ReferenceObjectProperty => Boolean(property));
    if (!properties.length) continue;

    const group = universeComponentGroup(component, properties);
    const label = `Universe ${component.label}`;
    const pathDisplayPrefix = `Universe.N.${component.defaultName}`;
    entries.push({
      componentIndex: component.componentIndex,
      group,
      row: {
        id: component.id,
        label,
        description: pathDisplayPrefix,
        group,
        propertyCount: properties.length,
      },
      detail: {
        id: component.id,
        label,
        description: `${group} / ${pathDisplayPrefix}`,
        root: "Universe",
        detailKind: "universe component",
        propertyCount: properties.length,
        sections: universeComponentPropertySections(properties, pathDisplayPrefix),
      },
    });
  }
  entries.sort(
    (a, b) =>
      universeComponentGroupOrder(a.group) - universeComponentGroupOrder(b.group) ||
      a.componentIndex - b.componentIndex,
  );

  return {
    rows: entries.map((entry) => entry.row),
    details: entries.map((entry) => entry.detail),
    componentCount: entries.length,
  };
}

function findUniverseComponentProperty(
  objectPaths: string[],
  defaultName: string,
  propertyByPath: Map<string, ReferenceObjectProperty>,
): ReferenceObjectProperty | null {
  const normalizedPaths = objectPaths.map(normalizeNumericSegments);
  const preferredPaths = [
    ...normalizedPaths.filter((path) => path.includes(`.${defaultName}.`)),
    ...normalizedPaths.filter((path) => !path.includes(`.${defaultName}.`)),
  ];
  for (const path of preferredPaths) {
    const property = propertyByPath.get(path);
    if (property) return property;
  }
  return null;
}

function universeComponentGroup(component: ReferenceUniverseComponent, properties: ReferenceObjectProperty[]): string {
  if (
    properties.some((property) =>
      componentRelativePath(property.path, `Universe.N.${component.defaultName}`).startsWith("Zone."),
    )
  ) {
    return "Projection Zones";
  }
  if (
    properties.some((property) =>
      componentRelativePath(property.path, `Universe.N.${component.defaultName}`).startsWith("Effect."),
    )
  ) {
    return "Effect Components";
  }
  return "Standard Components";
}

function universeComponentGroupOrder(group: string): number {
  switch (group) {
    case "Standard Components":
      return 0;
    case "Effect Components":
      return 1;
    case "Projection Zones":
      return 2;
    default:
      return 3;
  }
}

function universeComponentPropertySections(
  properties: ReferenceObjectProperty[],
  pathDisplayPrefix: string,
): ObjectPropertySection[] {
  const buckets: Array<{
    label: string;
    match: (relativePath: string) => boolean;
    properties: ReferenceObjectProperty[];
  }> = [
    { label: "Component controls", match: (relativePath) => !relativePath.includes("."), properties: [] },
    { label: "Effect controls", match: (relativePath) => relativePath.startsWith("Effect."), properties: [] },
    {
      label: "Zone controls",
      match: (relativePath) =>
        relativePath.startsWith("Zone.") &&
        !relativePath.startsWith("Zone.UGC.") &&
        !relativePath.startsWith("Zone.Effect."),
      properties: [],
    },
    { label: "Zone UGC controls", match: (relativePath) => relativePath.startsWith("Zone.UGC."), properties: [] },
    { label: "Zone effect controls", match: (relativePath) => relativePath.startsWith("Zone.Effect."), properties: [] },
  ];
  const otherProperties: ReferenceObjectProperty[] = [];

  for (const property of properties) {
    const relativePath = componentRelativePath(property.path, pathDisplayPrefix);
    const bucket = buckets.find((candidate) => candidate.match(relativePath));
    if (bucket) {
      bucket.properties.push(property);
    } else {
      otherProperties.push(property);
    }
  }

  const sections = buckets
    .filter((bucket) => bucket.properties.length > 0)
    .map((bucket) => ({ label: bucket.label, properties: bucket.properties }));
  if (otherProperties.length) sections.push({ label: "Other component controls", properties: otherProperties });
  return sections;
}

function componentRelativePath(path: string, prefix: string): string {
  return path.startsWith(`${prefix}.`) ? path.slice(prefix.length + 1) : path;
}

function normalizeNumericSegments(path: string): string {
  return path
    .split(".")
    .map((part, index) => (index > 0 && /^\d+$/.test(part) ? "N" : part))
    .join(".");
}
