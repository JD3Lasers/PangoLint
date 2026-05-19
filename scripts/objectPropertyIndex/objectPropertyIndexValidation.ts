import type {
  ObjectPropertyBehaviorClassification,
  ObjectPropertyReadbackMetadata,
  ObjectPropertyValueMetadata,
  ObjectPropertyValueRange,
} from "../../src/knowledge/objectPropertyIndex";

export function validateReadbackMetadata(pathValue: string, metadata: ObjectPropertyReadbackMetadata): void {
  if (metadata.readable !== true) {
    throw new Error(`${pathValue} readback metadata must set readable true`);
  }
  if (metadata.probeMode !== "readback-only") {
    throw new Error(`${pathValue} readback metadata must use readback-only probeMode`);
  }
  if (typeof metadata.probePath !== "string" || metadata.probePath.trim().length === 0) {
    throw new Error(`${pathValue} readback metadata requires a non-empty probePath`);
  }
  if (!["documented", "observed", "inferred", "unverified"].includes(metadata.evidenceLevel)) {
    throw new Error(`${pathValue} has invalid readback evidenceLevel`);
  }
  if (
    metadata.valueType !== undefined &&
    !["number", "integer", "float", "string", "boolean", "enum", "unknown"].includes(metadata.valueType)
  ) {
    throw new Error(`${pathValue} has invalid readback valueType`);
  }
  if (metadata.typeTag !== undefined && !["f", "i", "s"].includes(metadata.typeTag)) {
    throw new Error(`${pathValue} has invalid readback typeTag`);
  }
  const observedValueType = typeof metadata.observedValue;
  if (
    metadata.observedValue !== undefined &&
    metadata.observedValue !== null &&
    !["string", "number", "boolean"].includes(observedValueType)
  ) {
    throw new Error(`${pathValue} observedValue must be string, number, boolean, or null`);
  }
  const locationKind = metadata.locationContext?.kind;
  if (
    locationKind !== undefined &&
    !["indexed-root", "workspace-slot", "quickfx-slot", "showfile-alias", "hardware-instance"].includes(locationKind)
  ) {
    throw new Error(`${pathValue} has invalid readback locationContext kind`);
  }
}

export function validateBehaviorClassification(
  pathValue: string,
  metadata: ObjectPropertyBehaviorClassification,
): void {
  if (!["read-write", "read-only", "write-only", "read-mostly", "unknown"].includes(metadata.accessMode)) {
    throw new Error(`${pathValue} has invalid behavior accessMode`);
  }
  if (
    ![
      "state-value",
      "flag-state",
      "momentary-action",
      "enum-state",
      "string-state",
      "computed-status",
      "alias-status",
      "fixture-dependent",
      "unknown",
    ].includes(metadata.behaviorKind)
  ) {
    throw new Error(`${pathValue} has invalid behaviorKind`);
  }
  if (
    ![
      "not-tested",
      "write-readback-tested",
      "command-readback-tested",
      "write-no-op-tested",
      "write-rejected-tested",
      "documented-writable",
      "documented-read-only",
      "not-applicable",
    ].includes(metadata.writeTestStatus)
  ) {
    throw new Error(`${pathValue} has invalid writeTestStatus`);
  }
  if (
    !["not-tested", "readback-tested", "readback-not-available", "documented-readable", "not-applicable"].includes(
      metadata.readbackStatus,
    )
  ) {
    throw new Error(`${pathValue} has invalid readbackStatus`);
  }
  if (!["documented", "observed", "inferred", "unverified"].includes(metadata.evidenceLevel)) {
    throw new Error(`${pathValue} has invalid behavior evidenceLevel`);
  }
  if (metadata.notes !== undefined && metadata.notes.trim().length === 0) {
    throw new Error(`${pathValue} behavior classification notes must be non-empty when present`);
  }
}

export function validateValueMetadata(pathValue: string, metadata: ObjectPropertyValueMetadata): void {
  if (!["documented", "observed", "inferred", "unverified"].includes(metadata.evidenceLevel)) {
    throw new Error(`${pathValue} has invalid evidenceLevel`);
  }
  if (
    metadata.valueType !== undefined &&
    !["number", "integer", "float", "string", "boolean", "enum", "unknown"].includes(metadata.valueType)
  ) {
    throw new Error(`${pathValue} has invalid valueType`);
  }
  if (metadata.valueRange) {
    const { min, max, dynamicMax, boundaryBehavior, evidenceLevel } = metadata.valueRange;
    if (min !== undefined && max !== undefined && min > max) {
      throw new Error(`${pathValue} valueRange min must be <= max`);
    }
    validateDynamicBound(pathValue, dynamicMax);
    if (
      boundaryBehavior !== undefined &&
      !["clamp", "reject", "no-op", "wrap", "pass-through", "unknown"].includes(boundaryBehavior)
    ) {
      throw new Error(`${pathValue} has invalid valueRange boundaryBehavior`);
    }
    if (evidenceLevel !== undefined && !["documented", "observed", "inferred", "unverified"].includes(evidenceLevel)) {
      throw new Error(`${pathValue} has invalid valueRange evidenceLevel`);
    }
  }
  if (metadata.acceptedValues) {
    for (const accepted of metadata.acceptedValues) {
      if (!["string", "number", "boolean"].includes(typeof accepted.value)) {
        throw new Error(`${pathValue} acceptedValues entries require string, number, or boolean value`);
      }
    }
  }
  const locationKind = metadata.locationContext?.kind;
  if (
    locationKind !== undefined &&
    !["indexed-root", "workspace-slot", "quickfx-slot", "showfile-alias", "hardware-instance"].includes(locationKind)
  ) {
    throw new Error(`${pathValue} has invalid locationContext kind`);
  }
}

function validateDynamicBound(
  pathValue: string,
  dynamicBound: ObjectPropertyValueRange["dynamicMax"] | undefined,
): void {
  if (dynamicBound === undefined) return;
  if (typeof dynamicBound.expression !== "string" || dynamicBound.expression.trim().length === 0) {
    throw new Error(`${pathValue} valueRange.dynamicMax.expression must be a non-empty string`);
  }
  if (
    dynamicBound.sourcePaths !== undefined &&
    (!Array.isArray(dynamicBound.sourcePaths) ||
      dynamicBound.sourcePaths.length === 0 ||
      !dynamicBound.sourcePaths.every((sourcePath) => typeof sourcePath === "string" && sourcePath.trim().length > 0))
  ) {
    throw new Error(`${pathValue} valueRange.dynamicMax.sourcePaths must be a non-empty string array when present`);
  }
  if (dynamicBound.notes !== undefined && dynamicBound.notes.trim().length === 0) {
    throw new Error(`${pathValue} valueRange.dynamicMax.notes must be non-empty when present`);
  }
}
