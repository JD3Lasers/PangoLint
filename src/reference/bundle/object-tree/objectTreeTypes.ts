import type { ReferenceObjectProperty } from "../types";

export interface ObjectTreeNode {
  label: string;
  description?: string;
  path?: string;
  osc?: string;
  setters?: string[];
  children?: ObjectTreeNode[];
}

export interface ObjectPropertySection {
  label: string;
  description?: string;
  properties: ReferenceObjectProperty[];
}

export interface CueTypePropertySections {
  sections: ObjectPropertySection[];
  uniquePropertyCount: number;
  typeCount: number;
}

export interface FxEffectPropertySections {
  sections: ObjectPropertySection[];
  uniquePropertyCount: number;
  effectCount: number;
}

export interface ObjectPropertyReferenceRow {
  id: string;
  label: string;
  description?: string;
  group?: string;
  propertyCount: number;
}

export interface ObjectPropertyReferenceDetail {
  id: string;
  label: string;
  description?: string;
  root: string;
  detailKind?: string;
  propertyCount: number;
  sections: ObjectPropertySection[];
}

export interface CueTypeReference {
  rows: ObjectPropertyReferenceRow[];
  details: ObjectPropertyReferenceDetail[];
  uniquePropertyCount: number;
  typeCount: number;
}

export interface FxEffectReference {
  rows: ObjectPropertyReferenceRow[];
  details: ObjectPropertyReferenceDetail[];
  uniquePropertyCount: number;
  effectCount: number;
}

export interface UniverseComponentReference {
  rows: ObjectPropertyReferenceRow[];
  details: ObjectPropertyReferenceDetail[];
  componentCount: number;
}
