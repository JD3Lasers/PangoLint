import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect } from "vitest";

export const dataDir = path.join(process.cwd(), "data", "pangoscript");

export function readJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(path.join(dataDir, runtimeIndexPath(fileName)), "utf8")) as T;
}

export function runtimeIndexPath(fileName: string): string {
  if (fileName === "known-properties.json" || fileName === "object-property-index.json") {
    return path.join("object-tree", "runtime-indexes", fileName);
  }
  return objectTreeSourceFactPath(fileName);
}

export function objectTreeSourceFactPath(fileName: string): string {
  if (fileName === "object-range-evidence.schema.json") {
    return path.join("object-tree", "evidence", "value.schema.json");
  }
  if (fileName.startsWith("object-range-evidence/")) {
    return path.join("object-tree", "evidence", "value", fileName.slice("object-range-evidence/".length));
  }
  if (fileName === "object-readback-evidence.schema.json") {
    return path.join("object-tree", "evidence", "readback.schema.json");
  }
  if (fileName.startsWith("object-readback-evidence/")) {
    return path.join("object-tree", "evidence", "readback", fileName.slice("object-readback-evidence/".length));
  }
  if (fileName.startsWith("object-behavior-evidence/")) {
    return path.join("object-tree", "evidence", "behavior", fileName.slice("object-behavior-evidence/".length));
  }
  if (fileName === "object-behavior-audits/issue-216-object-behavior-audit.json") {
    return path.join("object-tree", "audits", "behavior", "issue-216-object-behavior-audit.json");
  }
  if (fileName === "object-behavior-audits/final-object-data-quality-audit.json") {
    return path.join("object-tree", "audits", "data-quality", "final-object-data-quality-audit.json");
  }
  if (fileName.startsWith("object-readback-audits/")) {
    return path.join("object-tree", "audits", "readback", fileName.slice("object-readback-audits/".length));
  }
  if (fileName === "object-property-ranges.json") {
    return path.join("object-tree", "source-facts", "value-metadata", "root.json");
  }
  if (fileName === "object-property-ranges.schema.json") {
    return path.join("object-tree", "source-facts", "value-metadata.schema.json");
  }
  if (fileName.startsWith("object-property-ranges/")) {
    const childPath =
      fileName === "object-property-ranges/zone/direct-leftover-controls.json"
        ? path.join("zone", "visualization-id-range.json")
        : fileName.slice("object-property-ranges/".length);
    return path.join("object-tree", "source-facts", "value-metadata", childPath);
  }
  if (fileName === "object-property-readbacks.json") {
    return path.join("object-tree", "source-facts", "readback-metadata", "root.json");
  }
  if (fileName === "object-property-readbacks.schema.json") {
    return path.join("object-tree", "source-facts", "readback-metadata.schema.json");
  }
  if (fileName.startsWith("object-property-readbacks/")) {
    return path.join(
      "object-tree",
      "source-facts",
      "readback-metadata",
      fileName.slice("object-property-readbacks/".length),
    );
  }
  if (fileName === "object-property-classifications.json") {
    return path.join("object-tree", "source-facts", "behavior-metadata", "root.json");
  }
  if (fileName === "object-property-classifications.schema.json") {
    return path.join("object-tree", "source-facts", "behavior-metadata.schema.json");
  }
  if (fileName.startsWith("object-property-classifications/")) {
    return path.join(
      "object-tree",
      "source-facts",
      "behavior-metadata",
      fileName.slice("object-property-classifications/".length),
    );
  }
  return fileName;
}

export function readObjectPropertyRangeOverlayFiles(): Array<{
  relativePath: string;
  overlay: ObjectPropertyRangeOverlayFile;
}> {
  const rootOverlayPath = path.join(dataDir, "object-tree", "source-facts", "value-metadata", "root.json");
  return [
    rootOverlayPath,
    ...objectPropertyRangeOverlayPaths(path.join(dataDir, "object-tree", "source-facts", "value-metadata")).filter(
      (filePath) => filePath !== rootOverlayPath,
    ),
  ].map((filePath) => ({
    relativePath: path.relative(dataDir, filePath),
    overlay: JSON.parse(readFileSync(filePath, "utf8")) as ObjectPropertyRangeOverlayFile,
  }));
}

export function objectPropertyRangeOverlayPaths(directoryPath: string): string[] {
  if (!existsSync(directoryPath)) return [];
  return readdirSync(directoryPath, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) return objectPropertyRangeOverlayPaths(entryPath);
      return entry.isFile() && entry.name.endsWith(".json") ? [entryPath] : [];
    })
    .sort((a, b) => a.localeCompare(b));
}

export function readObjectPropertyReadbackOverlayFiles(): Array<{
  relativePath: string;
  overlay: ObjectPropertyReadbackOverlayFile;
}> {
  const rootOverlayPath = path.join(dataDir, "object-tree", "source-facts", "readback-metadata", "root.json");
  const filePaths = [
    ...(existsSync(rootOverlayPath) ? [rootOverlayPath] : []),
    ...objectPropertyReadbackOverlayPaths(
      path.join(dataDir, "object-tree", "source-facts", "readback-metadata"),
    ).filter((filePath) => filePath !== rootOverlayPath),
  ];
  return filePaths.map((filePath) => ({
    relativePath: path.relative(dataDir, filePath),
    overlay: JSON.parse(readFileSync(filePath, "utf8")) as ObjectPropertyReadbackOverlayFile,
  }));
}

export function objectPropertyReadbackOverlayPaths(directoryPath: string): string[] {
  if (!existsSync(directoryPath)) return [];
  return readdirSync(directoryPath, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) return objectPropertyReadbackOverlayPaths(entryPath);
      return entry.isFile() && entry.name.endsWith(".json") ? [entryPath] : [];
    })
    .sort((a, b) => a.localeCompare(b));
}

export function readObjectPropertyClassificationOverlayFiles(): Array<{
  relativePath: string;
  overlay: ObjectPropertyBehaviorClassificationOverlayFile;
}> {
  const rootOverlayPath = path.join(dataDir, "object-tree", "source-facts", "behavior-metadata", "root.json");
  const filePaths = [
    ...(existsSync(rootOverlayPath) ? [rootOverlayPath] : []),
    ...objectPropertyClassificationOverlayPaths(
      path.join(dataDir, "object-tree", "source-facts", "behavior-metadata"),
    ).filter((filePath) => filePath !== rootOverlayPath),
  ];
  return filePaths.map((filePath) => ({
    relativePath: path.relative(dataDir, filePath),
    overlay: JSON.parse(readFileSync(filePath, "utf8")) as ObjectPropertyBehaviorClassificationOverlayFile,
  }));
}

export function objectPropertyClassificationOverlayPaths(directoryPath: string): string[] {
  if (!existsSync(directoryPath)) return [];
  return readdirSync(directoryPath, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) return objectPropertyClassificationOverlayPaths(entryPath);
      return entry.isFile() && entry.name.endsWith(".json") ? [entryPath] : [];
    })
    .sort((a, b) => a.localeCompare(b));
}

export function readObjectReadbackEvidenceFiles(): Array<{
  relativePath: string;
  report: ObjectReadbackEvidenceReport;
}> {
  const evidenceDirectory = path.join(dataDir, "object-tree", "evidence", "readback");
  return objectReadbackEvidencePaths(evidenceDirectory).map((filePath) => ({
    relativePath: path.relative(dataDir, filePath),
    report: JSON.parse(readFileSync(filePath, "utf8")) as ObjectReadbackEvidenceReport,
  }));
}

export function objectReadbackEvidencePaths(directoryPath: string): string[] {
  if (!existsSync(directoryPath)) return [];
  return readdirSync(directoryPath, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) return objectReadbackEvidencePaths(entryPath);
      return entry.isFile() && entry.name.endsWith(".json") ? [entryPath] : [];
    })
    .sort((a, b) => a.localeCompare(b));
}

export function fxProps(suffix: string, count = 6): string[] {
  return Array.from({ length: count }, (_, index) => `Master.FX${index + 1}${suffix}`);
}

export function effectActionProps(): string[] {
  return [
    "Master.EffectChannelAction",
    ...Array.from({ length: 8 }, (_, index) => `Master.EffectChannelAction${index + 1}`),
  ];
}

export interface CommandPropertyCoverageFile {
  schemaVersion: 1;
  generatedAt: string;
  summary: {
    total: number;
    mapped: number;
    noDirectProperty: number;
    deferred: number;
    unknown: number;
  };
  commands: Record<
    string,
    {
      canonical: string;
      category: string;
      status: "mapped" | "no-direct-property" | "deferred" | "unknown";
      evidenceLevel: string;
      safetyTier: string;
      setsProperty?: string[];
      notes?: string;
      probe?: {
        setupScript?: string;
        triggerScript?: string;
        readbackPaths?: string[];
        restoreScript?: string;
        notes?: string;
      };
    }
  >;
}

export interface ObjectPropertyRangeOverlayFile {
  schemaVersion: 1;
  entries: Array<ObjectPropertyValueMetadata & { contextId?: string; path: string }>;
}

export interface ObjectPropertyReadbackOverlayFile {
  schemaVersion: 1;
  entries: Array<ObjectPropertyReadbackMetadata & { path: string }>;
}

export interface ObjectPropertyBehaviorClassificationOverlayFile {
  schemaVersion: 1;
  entries: Array<ObjectPropertyBehaviorClassification & { path: string }>;
}

export interface ObjectReadbackEvidenceReport {
  schemaVersion: 1;
  parentIssue?: number;
  batchIssue?: number;
  runtime: {
    observedAt: string;
    beyondVersion?: string;
    operatorSupervised: boolean;
    noLaserConnected?: boolean;
    talkHost?: string;
    talkPort?: number;
    oscListenHost?: string;
    oscListenPort?: number;
    notes?: string;
  };
  entries: ObjectReadbackEvidenceEntry[];
}

export interface ObjectReadbackEvidenceEntry {
  objectPath: string;
  probePath: string;
  probeMode: "readback-only";
  valueType: string;
  baseline: {
    value: string | number | boolean | null;
    typeTag?: string;
  };
  evidenceNote: string;
  locationAware: boolean;
  locationContext?: {
    kind: string;
    populationDependent?: boolean;
    concreteContext?: string;
    notes?: string;
  };
  restore: {
    strategy: string;
    restoredValue?: string | number | boolean | null;
    notes: string;
  };
}

export interface ObjectPropertyProbeContext {
  id: string;
  kind: string;
  label: string;
  parentLabel?: string;
  normalizedPrefix: string;
  probePrefix: string;
  probeOscPrefix?: string;
  populationDependent?: boolean;
  notes?: string;
}

export interface ObjectPropertyValueMetadata {
  valueType?: string;
  valueRange?: {
    min?: number;
    max?: number;
    dynamicMax?: {
      expression: string;
      sourcePaths?: string[];
      notes?: string;
    };
    minInclusive?: boolean;
    maxInclusive?: boolean;
    unit?: string;
    boundaryBehavior?: string;
    evidenceLevel?: string;
    notes?: string;
  };
  acceptedValues?: Array<{
    value: string | number | boolean;
    label?: string;
    description?: string;
  }>;
  unit?: string;
  defaultValue?: string | number | boolean;
  evidenceLevel: string;
  notes?: string;
  locationContext?: {
    kind: string;
    populationDependent?: boolean;
    indexBasis?: string;
    notes?: string;
  };
}

export interface ObjectPropertyReadbackMetadata {
  readable: true;
  valueType?: string;
  probePath: string;
  probeMode: "readback-only";
  observedValue?: string | number | boolean | null;
  typeTag?: string;
  evidenceLevel: string;
  observedAt?: string;
  notes?: string;
  locationContext?: {
    kind: string;
    populationDependent?: boolean;
    indexBasis?: string;
    notes?: string;
  };
}

export interface ObjectPropertyBehaviorClassification {
  accessMode: string;
  behaviorKind: string;
  writeTestStatus: string;
  readbackStatus: string;
  evidenceLevel: string;
  notes?: string;
}

export function assertObjectPropertyValueMetadata(metadata: ObjectPropertyValueMetadata): void {
  expect(["documented", "observed", "inferred", "unverified"]).toContain(metadata.evidenceLevel);
  if (metadata.valueType !== undefined) {
    expect(["number", "integer", "float", "string", "boolean", "enum", "unknown"]).toContain(metadata.valueType);
  }
  if (metadata.valueRange) {
    const { min, max, dynamicMax, boundaryBehavior, evidenceLevel } = metadata.valueRange;
    if (min !== undefined && max !== undefined) expect(min).toBeLessThanOrEqual(max);
    if (dynamicMax !== undefined) {
      expect(dynamicMax.expression.trim().length).toBeGreaterThan(0);
      if (dynamicMax.sourcePaths !== undefined) {
        expect(dynamicMax.sourcePaths.length).toBeGreaterThan(0);
        for (const sourcePath of dynamicMax.sourcePaths) expect(sourcePath.trim().length).toBeGreaterThan(0);
      }
    }
    if (boundaryBehavior !== undefined) {
      expect(["clamp", "reject", "no-op", "wrap", "pass-through", "unknown"]).toContain(boundaryBehavior);
    }
    if (evidenceLevel !== undefined) {
      expect(["documented", "observed", "inferred", "unverified"]).toContain(evidenceLevel);
    }
  }
  for (const accepted of metadata.acceptedValues ?? []) {
    expect(["string", "number", "boolean"]).toContain(typeof accepted.value);
  }
  if (metadata.locationContext) {
    expect(["indexed-root", "workspace-slot", "quickfx-slot", "showfile-alias", "hardware-instance"]).toContain(
      metadata.locationContext.kind,
    );
  }
}

export function assertObjectPropertyReadbackMetadata(metadata: ObjectPropertyReadbackMetadata): void {
  expect(metadata.readable).toBe(true);
  expect(metadata.probeMode).toBe("readback-only");
  expect(metadata.probePath.trim().length).toBeGreaterThan(0);
  expect(["documented", "observed", "inferred", "unverified"]).toContain(metadata.evidenceLevel);
  if (metadata.valueType !== undefined) {
    expect(["number", "integer", "float", "string", "boolean", "enum", "unknown"]).toContain(metadata.valueType);
  }
  if (metadata.observedValue !== undefined && metadata.observedValue !== null) {
    expect(["string", "number", "boolean"]).toContain(typeof metadata.observedValue);
  }
  if (metadata.typeTag !== undefined) expect(["f", "i", "s"]).toContain(metadata.typeTag);
  if (metadata.observedAt !== undefined) expect(metadata.observedAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
  if (metadata.notes !== undefined) expect(metadata.notes.trim().length).toBeGreaterThan(0);
  if (metadata.locationContext) {
    expect(["indexed-root", "workspace-slot", "quickfx-slot", "showfile-alias", "hardware-instance"]).toContain(
      metadata.locationContext.kind,
    );
  }
}

export function assertObjectPropertyBehaviorClassification(metadata: ObjectPropertyBehaviorClassification): void {
  expect(["read-write", "read-only", "write-only", "read-mostly", "unknown"]).toContain(metadata.accessMode);
  expect([
    "state-value",
    "flag-state",
    "momentary-action",
    "enum-state",
    "string-state",
    "computed-status",
    "alias-status",
    "fixture-dependent",
    "unknown",
  ]).toContain(metadata.behaviorKind);
  expect([
    "not-tested",
    "write-readback-tested",
    "command-readback-tested",
    "write-no-op-tested",
    "write-rejected-tested",
    "documented-writable",
    "documented-read-only",
    "not-applicable",
  ]).toContain(metadata.writeTestStatus);
  expect([
    "not-tested",
    "readback-tested",
    "readback-not-available",
    "documented-readable",
    "not-applicable",
  ]).toContain(metadata.readbackStatus);
  expect(["documented", "observed", "inferred", "unverified"]).toContain(metadata.evidenceLevel);
  expect(metadata.notes?.trim().length ?? 0).toBeGreaterThan(0);
}

export function hasManualReadyValueMetadata(metadata: ObjectPropertyValueMetadata): boolean {
  return (
    (metadata.valueRange?.min !== undefined && metadata.valueRange.max !== undefined) ||
    (metadata.valueRange?.min !== undefined && metadata.valueRange.dynamicMax !== undefined) ||
    Boolean(metadata.acceptedValues?.length)
  );
}

export function findPropertyPaths(value: unknown, propertyName: string, prefix = "$"): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findPropertyPaths(item, propertyName, `${prefix}[${index}]`));
  }
  if (!value || typeof value !== "object") return [];

  const paths: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    const path = `${prefix}.${key}`;
    if (key === propertyName) paths.push(path);
    paths.push(...findPropertyPaths(child, propertyName, path));
  }
  return paths;
}

const forbiddenDescriptionVerificationPatterns: Array<[string, RegExp]> = [
  ["positive verified wording", /\b(?:runtime-)?verified\b|\bverification\[\]|by visual observation/i],
  [
    "runtime proof wording",
    /\b(?:Runtime readback|readback probe confirmed|probe confirmed|readback probe observed|Fresh MCP probe|MCP probe|Probed live|freshly observed|operator confirmation|tested span)\b/i,
  ],
  ["dated proof wording", /\b\d{4}-\d{2}-\d{2}\b/],
  ["private build label", /\b(?:post-)?build-\d{4}\b/i],
  ["observed proof wording", /\bobserved\b/i],
];

const forbiddenDescriptionSourcePatterns: Array<[string, RegExp]> = [
  ["Pangolin Wiki source label", /\bPangolin Wiki\b/i],
  ["BEYOND export source label", /\bBEYOND export\b|\bexport\b/i],
  ["private doc cache label", /\b(?:local help doc|doc[- ]cache|documentation cache|commands doc cache)\b/i],
  ["private source line label", /\b(?:line|lines)\s+\d{2,}\b/i],
];

export function findForbiddenDescriptionClaims(value: unknown, prefix = "$", key = ""): string[] {
  if (typeof value === "string") {
    if (key !== "description") return [];
    const normalized = stripNegativeVerificationWording(value);
    return [...forbiddenDescriptionVerificationPatterns, ...forbiddenDescriptionSourcePatterns]
      .filter(([, pattern]) => pattern.test(normalized))
      .map(([label]) => `${prefix}: ${label}`);
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findForbiddenDescriptionClaims(item, `${prefix}[${index}]`, String(index)));
  }
  if (!value || typeof value !== "object") return [];

  return Object.entries(value).flatMap(([childKey, child]) =>
    findForbiddenDescriptionClaims(child, `${prefix}.${childKey}`, childKey),
  );
}

export function stripNegativeVerificationWording(value: string): string {
  return value
    .replace(/\bunverified\b/gi, "")
    .replace(/\bnot verified\b/gi, "")
    .replace(/\bnot directly verified\b/gi, "")
    .replace(/\bcannot be directly verified\b/gi, "")
    .replace(/\bhas not been verified\b/gi, "");
}
