export const objectRangeEvidenceBoundaryBehaviors = [
  "clamp",
  "reject",
  "no-op",
  "wrap",
  "pass-through",
  "unknown",
] as const;
export const objectRangeEvidenceLevels = ["documented", "observed", "inferred", "unverified"] as const;
export const objectRangeEvidenceProbeModes = [
  "readback-only",
  "write-readback",
  "command-readback",
  "command-write-readback",
] as const;
export const objectRangeEvidenceValueTypes = [
  "number",
  "integer",
  "float",
  "string",
  "boolean",
  "enum",
  "unknown",
] as const;

type BoundaryBehavior = (typeof objectRangeEvidenceBoundaryBehaviors)[number];
type EvidenceLevel = (typeof objectRangeEvidenceLevels)[number];
type ProbeMode = (typeof objectRangeEvidenceProbeModes)[number];
type ValueType = (typeof objectRangeEvidenceValueTypes)[number];

const objectRangeEvidenceReportKeys = ["schemaVersion", "runtime", "parentIssue", "batchIssue", "entries"] as const;
const objectRangeEvidenceRuntimeKeys = [
  "observedAt",
  "beyondVersion",
  "operatorSupervised",
  "noLaserConnected",
  "notes",
] as const;
const objectRangeEvidenceEntryKeys = [
  "objectPath",
  "probePath",
  "probeMode",
  "shipsMetadata",
  "valueType",
  "evidenceLevel",
  "boundaryBehavior",
  "baseline",
  "valueRange",
  "acceptedValues",
  "testedValues",
  "restore",
  "evidenceNote",
  "deferReason",
  "locationAware",
  "locationContext",
] as const;
const objectRangeEvidenceBaselineKeys = ["value", "typeTag"] as const;
const objectRangeEvidenceValueRangeKeys = ["min", "max", "dynamicMax", "unit", "minInclusive", "maxInclusive"] as const;
const objectRangeEvidenceDynamicBoundKeys = ["expression", "sourcePaths", "notes"] as const;
const objectRangeEvidenceAcceptedValueKeys = ["value", "label", "description"] as const;
const objectRangeEvidenceTestedValueKeys = ["input", "command", "readback", "behavior"] as const;
const objectRangeEvidenceRestoreKeys = ["strategy", "restoredValue", "notes"] as const;
const objectRangeEvidenceLocationContextKeys = ["kind", "populationDependent", "concreteContext", "notes"] as const;

export interface ObjectRangeEvidenceReport {
  schemaVersion: 1;
  runtime: {
    observedAt: string;
    beyondVersion?: string;
    operatorSupervised: boolean;
    noLaserConnected?: boolean;
    notes?: string;
  };
  parentIssue?: number;
  batchIssue?: number;
  entries: ObjectRangeEvidenceEntry[];
}

export interface ObjectRangeEvidenceEntry {
  objectPath: string;
  probePath: string;
  probeMode: ProbeMode;
  shipsMetadata: boolean;
  valueType: ValueType;
  evidenceLevel: EvidenceLevel;
  boundaryBehavior?: BoundaryBehavior;
  baseline: {
    value: string | number | boolean | null;
    typeTag?: "f" | "i" | "s";
  };
  valueRange?: {
    min?: number;
    max?: number;
    dynamicMax?: {
      expression: string;
      sourcePaths?: string[];
      notes?: string;
    };
    unit?: string;
    minInclusive?: boolean;
    maxInclusive?: boolean;
  };
  acceptedValues?: Array<{
    value: string | number | boolean;
    label?: string;
    description?: string;
  }>;
  testedValues: Array<{
    input?: string | number | boolean;
    command?: string;
    readback: string | number | boolean | null;
    behavior: BoundaryBehavior;
  }>;
  restore: {
    strategy: "not-needed" | "restored-baseline" | "command-restore" | "manual-restore" | "prefix-retired";
    restoredValue?: string | number | boolean | null;
    notes: string;
  };
  evidenceNote: string;
  deferReason?: string;
  locationAware: boolean;
  locationContext?: {
    kind: "indexed-root" | "workspace-slot" | "quickfx-slot" | "showfile-alias" | "hardware-instance";
    populationDependent?: boolean;
    concreteContext?: string;
    notes?: string;
  };
}

export function validateObjectRangeEvidenceReport(report: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(report)) return ["report must be a JSON object"];

  rejectUnknownKeys(report, objectRangeEvidenceReportKeys, "report", errors);
  if (report.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  validateRuntime(report.runtime, errors);

  if (report.parentIssue !== undefined && !Number.isInteger(report.parentIssue)) {
    errors.push("parentIssue must be an integer when present");
  }
  if (report.batchIssue !== undefined && !Number.isInteger(report.batchIssue)) {
    errors.push("batchIssue must be an integer when present");
  }

  if (!Array.isArray(report.entries) || report.entries.length === 0) {
    errors.push("entries must be a non-empty array");
    return errors;
  }

  report.entries.forEach((entry, index) => {
    validateEntry(entry, `entries[${index}]`, errors);
  });
  return errors;
}

function validateRuntime(runtime: unknown, errors: string[]): void {
  if (!isRecord(runtime)) {
    errors.push("runtime must be an object");
    return;
  }
  rejectUnknownKeys(runtime, objectRangeEvidenceRuntimeKeys, "runtime", errors);
  if (!isNonEmptyString(runtime.observedAt)) {
    errors.push("runtime.observedAt must be a non-empty string");
  } else if (!/^\d{4}-\d{2}-\d{2}/.test(runtime.observedAt)) {
    errors.push("runtime.observedAt must start with YYYY-MM-DD");
  }
  if (runtime.beyondVersion !== undefined && !isNonEmptyString(runtime.beyondVersion)) {
    errors.push("runtime.beyondVersion must be a non-empty string when present");
  }
  if (runtime.operatorSupervised !== true) {
    errors.push("runtime.operatorSupervised must be true");
  }
  if (runtime.noLaserConnected !== undefined && typeof runtime.noLaserConnected !== "boolean") {
    errors.push("runtime.noLaserConnected must be boolean when present");
  }
  if (runtime.notes !== undefined && !isNonEmptyString(runtime.notes)) {
    errors.push("runtime.notes must be a non-empty string when present");
  }
}

function validateEntry(entry: unknown, path: string, errors: string[]): void {
  if (!isRecord(entry)) {
    errors.push(`${path} must be an object`);
    return;
  }

  rejectUnknownKeys(entry, objectRangeEvidenceEntryKeys, path, errors);
  requireString(entry.objectPath, `${path}.objectPath`, errors);
  requireString(entry.probePath, `${path}.probePath`, errors);
  requireOneOf(entry.probeMode, objectRangeEvidenceProbeModes, `${path}.probeMode`, errors);
  requireOneOf(entry.valueType, objectRangeEvidenceValueTypes, `${path}.valueType`, errors);
  requireOneOf(entry.evidenceLevel, objectRangeEvidenceLevels, `${path}.evidenceLevel`, errors);

  if (typeof entry.shipsMetadata !== "boolean") errors.push(`${path}.shipsMetadata must be boolean`);
  if (entry.boundaryBehavior !== undefined) {
    requireOneOf(entry.boundaryBehavior, objectRangeEvidenceBoundaryBehaviors, `${path}.boundaryBehavior`, errors);
  }

  validateBaseline(entry.baseline, `${path}.baseline`, errors);
  validateValueRange(entry.valueRange, `${path}.valueRange`, errors);
  validateAcceptedValues(entry.acceptedValues, `${path}.acceptedValues`, errors);
  validateTestedValues(entry.testedValues, `${path}.testedValues`, errors);
  validateRestore(entry.restore, `${path}.restore`, errors);
  requireString(entry.evidenceNote, `${path}.evidenceNote`, errors);

  if (entry.shipsMetadata === true) {
    if (!hasManualReadyMetadata(entry)) {
      errors.push(`${path} ships metadata but has neither valueRange.min/max nor acceptedValues`);
    }
    if (entry.boundaryBehavior === undefined) {
      errors.push(`${path} ships metadata but boundaryBehavior is missing`);
    }
  } else if (!isNonEmptyString(entry.deferReason)) {
    errors.push(`${path} does not ship metadata and must include deferReason`);
  }

  if (typeof entry.locationAware !== "boolean") {
    errors.push(`${path}.locationAware must be boolean`);
  }
  if (entry.locationAware === true) {
    if (!isRecord(entry.locationContext)) {
      errors.push(`${path}.locationContext is required when locationAware is true`);
    } else {
      validateLocationContext(entry.locationContext, `${path}.locationContext`, errors);
    }
    if (isNonEmptyString(entry.probePath) && entry.probePath.split(".").includes("N")) {
      errors.push(`${path}.probePath must be a concrete populated path when locationAware is true`);
    }
  } else if (entry.locationContext !== undefined) {
    if (!isRecord(entry.locationContext)) {
      errors.push(`${path}.locationContext must be an object when present`);
    } else {
      validateLocationContext(entry.locationContext, `${path}.locationContext`, errors);
    }
  }
}

function validateBaseline(baseline: unknown, path: string, errors: string[]): void {
  if (!isRecord(baseline)) {
    errors.push(`${path} must be an object`);
    return;
  }
  rejectUnknownKeys(baseline, objectRangeEvidenceBaselineKeys, path, errors);
  if (!isJsonScalarOrNull(baseline.value)) errors.push(`${path}.value must be string, number, boolean, or null`);
  if (baseline.typeTag !== undefined)
    requireOneOf(baseline.typeTag, ["f", "i", "s"] as const, `${path}.typeTag`, errors);
}

function validateValueRange(valueRange: unknown, path: string, errors: string[]): void {
  if (valueRange === undefined) return;
  if (!isRecord(valueRange)) {
    errors.push(`${path} must be an object when present`);
    return;
  }
  rejectUnknownKeys(valueRange, objectRangeEvidenceValueRangeKeys, path, errors);
  if (valueRange.min !== undefined && typeof valueRange.min !== "number") errors.push(`${path}.min must be number`);
  if (valueRange.max !== undefined && typeof valueRange.max !== "number") errors.push(`${path}.max must be number`);
  if (typeof valueRange.min === "number" && typeof valueRange.max === "number" && valueRange.min > valueRange.max) {
    errors.push(`${path}.min must be less than or equal to max`);
  }
  validateDynamicBound(valueRange.dynamicMax, `${path}.dynamicMax`, errors);
  if (valueRange.unit !== undefined && !isNonEmptyString(valueRange.unit)) {
    errors.push(`${path}.unit must be a non-empty string when present`);
  }
  if (valueRange.minInclusive !== undefined && typeof valueRange.minInclusive !== "boolean") {
    errors.push(`${path}.minInclusive must be boolean when present`);
  }
  if (valueRange.maxInclusive !== undefined && typeof valueRange.maxInclusive !== "boolean") {
    errors.push(`${path}.maxInclusive must be boolean when present`);
  }
}

function validateDynamicBound(dynamicBound: unknown, path: string, errors: string[]): void {
  if (dynamicBound === undefined) return;
  if (!isRecord(dynamicBound)) {
    errors.push(`${path} must be an object when present`);
    return;
  }
  rejectUnknownKeys(dynamicBound, objectRangeEvidenceDynamicBoundKeys, path, errors);
  requireString(dynamicBound.expression, `${path}.expression`, errors);
  if (dynamicBound.sourcePaths !== undefined) {
    if (!Array.isArray(dynamicBound.sourcePaths) || dynamicBound.sourcePaths.length === 0) {
      errors.push(`${path}.sourcePaths must be a non-empty array when present`);
      return;
    }
    dynamicBound.sourcePaths.forEach((sourcePath, index) => {
      requireString(sourcePath, `${path}.sourcePaths[${index}]`, errors);
    });
  }
  if (dynamicBound.notes !== undefined && !isNonEmptyString(dynamicBound.notes)) {
    errors.push(`${path}.notes must be a non-empty string when present`);
  }
}

function validateAcceptedValues(acceptedValues: unknown, path: string, errors: string[]): void {
  if (acceptedValues === undefined) return;
  if (!Array.isArray(acceptedValues) || acceptedValues.length === 0) {
    errors.push(`${path} must be a non-empty array when present`);
    return;
  }
  acceptedValues.forEach((accepted, index) => {
    const acceptedPath = `${path}[${index}]`;
    if (!isRecord(accepted)) {
      errors.push(`${acceptedPath} must be an object`);
      return;
    }
    rejectUnknownKeys(accepted, objectRangeEvidenceAcceptedValueKeys, acceptedPath, errors);
    if (!isJsonScalar(accepted.value)) errors.push(`${acceptedPath}.value must be string, number, or boolean`);
    if (accepted.label !== undefined && !isNonEmptyString(accepted.label)) {
      errors.push(`${acceptedPath}.label must be a non-empty string when present`);
    }
    if (accepted.description !== undefined && !isNonEmptyString(accepted.description)) {
      errors.push(`${acceptedPath}.description must be a non-empty string when present`);
    }
  });
}

function validateTestedValues(testedValues: unknown, path: string, errors: string[]): void {
  if (!Array.isArray(testedValues) || testedValues.length === 0) {
    errors.push(`${path} must be a non-empty array`);
    return;
  }
  testedValues.forEach((tested, index) => {
    const testedPath = `${path}[${index}]`;
    if (!isRecord(tested)) {
      errors.push(`${testedPath} must be an object`);
      return;
    }
    rejectUnknownKeys(tested, objectRangeEvidenceTestedValueKeys, testedPath, errors);
    if (tested.input !== undefined && !isJsonScalar(tested.input)) {
      errors.push(`${testedPath}.input must be string, number, or boolean when present`);
    }
    if (tested.command !== undefined && !isNonEmptyString(tested.command)) {
      errors.push(`${testedPath}.command must be a non-empty string when present`);
    }
    if (!isJsonScalarOrNull(tested.readback)) {
      errors.push(`${testedPath}.readback must be string, number, boolean, or null`);
    }
    requireOneOf(tested.behavior, objectRangeEvidenceBoundaryBehaviors, `${testedPath}.behavior`, errors);
  });
}

function validateRestore(restore: unknown, path: string, errors: string[]): void {
  if (!isRecord(restore)) {
    errors.push(`${path} must be an object`);
    return;
  }
  rejectUnknownKeys(restore, objectRangeEvidenceRestoreKeys, path, errors);
  requireOneOf(
    restore.strategy,
    ["not-needed", "restored-baseline", "command-restore", "manual-restore", "prefix-retired"] as const,
    `${path}.strategy`,
    errors,
  );
  if (restore.restoredValue !== undefined && !isJsonScalarOrNull(restore.restoredValue)) {
    errors.push(`${path}.restoredValue must be string, number, boolean, or null when present`);
  }
  requireString(restore.notes, `${path}.notes`, errors);
}

function validateLocationContext(locationContext: Record<string, unknown>, path: string, errors: string[]): void {
  rejectUnknownKeys(locationContext, objectRangeEvidenceLocationContextKeys, path, errors);
  requireOneOf(
    locationContext.kind,
    ["indexed-root", "workspace-slot", "quickfx-slot", "showfile-alias", "hardware-instance"] as const,
    `${path}.kind`,
    errors,
  );
  if (locationContext.populationDependent !== undefined && typeof locationContext.populationDependent !== "boolean") {
    errors.push(`${path}.populationDependent must be boolean when present`);
  }
  if (locationContext.concreteContext !== undefined && !isNonEmptyString(locationContext.concreteContext)) {
    errors.push(`${path}.concreteContext must be a non-empty string when present`);
  }
  if (locationContext.notes !== undefined && !isNonEmptyString(locationContext.notes)) {
    errors.push(`${path}.notes must be a non-empty string when present`);
  }
}

function hasManualReadyMetadata(entry: Record<string, unknown>): boolean {
  const range = entry.valueRange;
  const hasRange =
    isRecord(range) && typeof range.min === "number" && typeof range.max === "number" && range.min <= range.max;
  const hasDynamicMaxRange =
    isRecord(range) &&
    typeof range.min === "number" &&
    isRecord(range.dynamicMax) &&
    isNonEmptyString(range.dynamicMax.expression);
  const hasAcceptedValues = Array.isArray(entry.acceptedValues) && entry.acceptedValues.length > 0;
  return hasRange || hasDynamicMaxRange || hasAcceptedValues;
}

function requireString(value: unknown, path: string, errors: string[]): void {
  if (!isNonEmptyString(value)) errors.push(`${path} must be a non-empty string`);
}

function requireOneOf<T extends readonly string[]>(value: unknown, allowed: T, path: string, errors: string[]): void {
  if (typeof value !== "string" || !allowed.includes(value)) {
    errors.push(`${path} must be one of ${allowed.join(", ")}`);
  }
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  path: string,
  errors: string[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) errors.push(`${path}.${key} is not allowed`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isJsonScalar(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function isJsonScalarOrNull(value: unknown): value is string | number | boolean | null {
  return value === null || isJsonScalar(value);
}
