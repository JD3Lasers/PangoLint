import type { ReferenceObjectProperty } from "../types";
import type {
  ObjectPropertyReferenceDetail,
  ObjectPropertyReferenceRow,
  ObjectPropertySection,
  ObjectTreeNode,
} from "./objectTreeTypes";

export function filterObjectReferenceRows(
  rows: ObjectPropertyReferenceRow[],
  details: ObjectPropertyReferenceDetail[],
  query: string,
): ObjectPropertyReferenceRow[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return rows;
  const detailById = new Map(details.map((detail) => [detail.id, detail]));
  return rows.filter((row) => {
    if (
      [row.label, row.description, row.group, row.id].some((value) => value?.toLowerCase().includes(normalizedQuery))
    ) {
      return true;
    }
    const detail = detailById.get(row.id);
    return detail?.sections.some((section) => {
      if (objectPropertySectionMatches(section, normalizedQuery)) return true;
      return section.properties.some((property) => objectPropertyMatches(property, normalizedQuery));
    });
  });
}

export function filterObjectPropertySections(
  sections: ObjectPropertySection[],
  query: string,
): ObjectPropertySection[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return sections;

  const filtered: ObjectPropertySection[] = [];
  for (const section of sections) {
    if (objectPropertySectionMatches(section, normalizedQuery)) {
      filtered.push(section);
      continue;
    }
    const properties = section.properties.filter((property) => objectPropertyMatches(property, normalizedQuery));
    if (properties.length) filtered.push({ ...section, properties });
  }
  return filtered;
}

export function filterObjectTree(nodes: ObjectTreeNode[], query: string): ObjectTreeNode[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return nodes;

  const filtered: ObjectTreeNode[] = [];
  for (const node of nodes) {
    const next = filterObjectTreeNode(node, normalizedQuery);
    if (next) filtered.push(next);
  }
  return filtered;
}

function filterObjectTreeNode(node: ObjectTreeNode, normalizedQuery: string): ObjectTreeNode | null {
  const selfMatches = objectTreeNodeMatches(node, normalizedQuery);
  if (!node.children?.length) return selfMatches ? node : null;

  const children = selfMatches ? node.children : filterObjectTree(node.children, normalizedQuery);
  if (!children.length) return null;
  return { ...node, children };
}

function objectTreeNodeMatches(node: ObjectTreeNode, normalizedQuery: string): boolean {
  const values = [node.label, node.description, node.path, node.osc, ...(node.setters ?? [])];
  return values.some((value) => value?.toLowerCase().includes(normalizedQuery));
}

function objectPropertySectionMatches(section: ObjectPropertySection, normalizedQuery: string): boolean {
  return [section.label, section.description].some((value) => value?.toLowerCase().includes(normalizedQuery));
}

function objectPropertyMatches(property: ReferenceObjectProperty, normalizedQuery: string): boolean {
  const values = [property.path, property.property, property.osc, ...(property.setters ?? [])];
  return values.some((value) => value?.toLowerCase().includes(normalizedQuery));
}
