import type {
  ObjectPropertyAcceptedValue,
  ObjectPropertyAddressMetadata,
  ObjectPropertyBehaviorClassification,
  ObjectPropertyProbeContext,
  ObjectPropertyReadbackMetadata,
  ObjectPropertyValueMetadata,
  ObjectPropertyValueRange,
} from "../../src/knowledge/objectPropertyIndex";

export interface CachePathEntry {
  path: string;
  normalizedPath: string;
  root: string;
  property?: string;
  kind: "object" | "fx";
  osc?: string;
  searchText?: string;
  segments: string[];
  variantCount?: number;
  fx?: {
    qfxPanel?: string;
    cellCaption?: string;
    label?: string;
    channel?: string;
  };
}

export interface CacheObjectTree {
  paths: CachePathEntry[];
  fxLabels?: FxEffectLabelFile;
}

export interface FxEffectLabelFile {
  cells?: Record<
    string,
    {
      qfx_panel?: string;
      qfxPanel?: string;
      caption?: string;
      cellCaption?: string;
      effects?: Array<{
        index: number;
        label?: string;
        channel?: string;
      }>;
    }
  >;
}

export interface FxCellLabel {
  qfxPanel?: string;
  cellCaption?: string;
}

export interface FxEffectTypeReferenceEntry {
  addressForms?: string[];
  group?: string | null;
  label?: string;
  lookup?: {
    label?: string;
    group?: string;
  };
}

export interface FxEffectMenuEntry {
  label?: string;
  group?: string;
}

export interface NormalizedPathEntry {
  path: string;
  normalizedPath: string;
  root: string;
  kind: "object" | "fx";
  osc?: string;
  searchText?: string;
  observedCount: number;
  isGenericAlias: boolean;
  fx?: CachePathEntry["fx"];
}

export interface OutputEntry {
  path: string;
  normalizedPath: string;
  root: string;
  property: string;
  kind: "object" | "fx";
  confidence: "observed";
  osc?: string;
  searchText: string;
  variantCount: number;
  variants: Array<{
    path: string;
    osc?: string;
    fx?: {
      qfxPanel?: string;
      cellCaption?: string;
      label?: string;
      channel?: string;
    };
  }>;
  fx?: {
    qfxPanel?: string;
    cellCaption?: string;
    label?: string;
    channel?: string;
  };
  addressMetadata?: ObjectPropertyAddressMetadata;
  probeContexts?: ObjectPropertyProbeContext[];
  valueMetadata?: ObjectPropertyValueMetadata;
  readbackMetadata?: ObjectPropertyReadbackMetadata;
  contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
  classification?: ObjectPropertyBehaviorClassification;
}

export interface RangeOverlayFile {
  schemaVersion: 1;
  entries: RangeOverlayEntry[];
}

export interface RangeOverlayEntry extends ObjectPropertyValueMetadata {
  path: string;
  contextId?: string;
}

export interface ReadbackOverlayFile {
  schemaVersion: 1;
  entries: ReadbackOverlayEntry[];
}

export interface ReadbackOverlayEntry extends ObjectPropertyReadbackMetadata {
  path: string;
}

export interface ClassificationOverlayFile {
  schemaVersion: 1;
  entries: ClassificationOverlayEntry[];
}

export interface ClassificationOverlayEntry extends ObjectPropertyBehaviorClassification {
  path: string;
}

export interface CommandKnowledgeFile {
  commands: Record<string, CommandRangeCommand>;
}

export interface CommandRangeCommand {
  canonical: string;
  evidenceLevel?: string;
  forms?: CommandRangeForm[];
  setsProperty?: string[];
}

export interface CommandRangeForm {
  parameters?: CommandRangeParameter[];
}

export interface CommandRangeParameter {
  name: string;
  type: "number" | "integer" | "float" | "string" | "boolean" | "variadic" | "unknown";
  range?: string;
  valueRange?: ObjectPropertyValueRange & { evidenceLevel?: string };
  acceptedValues?: ObjectPropertyAcceptedValue[];
}

export interface CommandRangeCandidate {
  path: string;
  command: string;
  parameter: CommandRangeParameter;
}
