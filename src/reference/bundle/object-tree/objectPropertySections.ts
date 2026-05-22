import type { ReferenceObjectProperty } from "../types";
import type { ObjectPropertySection } from "./objectTreeTypes";

export function sortObjectProperties(properties: ReferenceObjectProperty[]): ReferenceObjectProperty[] {
  return [...properties].sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
}

export function propertySectionsWithCommonControls(
  commonLabel: string,
  commonProperties: ReferenceObjectProperty[],
  specificLabel: string,
  specificProperties: ReferenceObjectProperty[],
): ObjectPropertySection[] {
  const sections: ObjectPropertySection[] = [];
  if (commonProperties.length) {
    sections.push({ label: commonLabel, properties: commonProperties });
  }
  if (specificProperties.length) {
    sections.push({ label: specificLabel, properties: sortObjectProperties(specificProperties) });
  }
  return sections;
}
