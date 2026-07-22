import { describe, expect, it } from "vitest";

import {
  buildObjectPropertyCard,
  OBJECT_PROPERTY_DETAIL_LIMITS,
  pageItems,
  resolveObjectPropertyDetailOptions,
} from "../../src/knowledge/objectPropertyCards";
import type { ObjectPropertyEntry } from "../../src/knowledge/objectPropertyIndex";

const entry: ObjectPropertyEntry = {
  path: "FX.N.N.N.Oscillator.Period",
  normalizedPath: "FX.N.N.N.Oscillator.Period",
  root: "FX",
  property: "Oscillator.Period",
  kind: "fx",
  confidence: "observed",
  osc: "/b/FX/0/0/0/Oscillator/Period",
  searchText: "fx oscillator period timing",
  variantCount: 12,
  variants: Array.from({ length: 12 }, (_, index) => ({
    path: `FX.0.0.${index}.Oscillator.Period`,
    osc: `/b/FX/0/0/${index}/Oscillator/Period`,
  })),
  probeContexts: Array.from({ length: 9 }, (_, index) => ({
    id: `quickfx:oscillator:${index}`,
    kind: "quickfx-effect",
    label: `Oscillator ${index}`,
    normalizedPrefix: "FX.N.N.N",
    probePrefix: `FX.0.0.${index}`,
    probeOscPrefix: `/b/FX/0/0/${index}`,
  })),
  valueMetadata: {
    valueType: "float",
    valueRange: {
      min: 0,
      max: 10,
      dynamicMax: {
        expression: "selected QuickFX effect period maximum",
      },
      minInclusive: true,
      maxInclusive: true,
      unit: "seconds",
      boundaryBehavior: "clamp",
      evidenceLevel: "observed",
    },
    acceptedValues: [
      { value: 0, label: "Stopped" },
      { value: 1, label: "Slow" },
    ],
    unit: "seconds",
    evidenceLevel: "observed",
    locationContext: {
      kind: "quickfx-slot",
      populationDependent: true,
    },
  },
  readbackMetadata: {
    readable: true,
    accessMechanism: "pangoscript-expression",
    valueType: "float",
    probePath: "FX.0.0.0.Oscillator.Period",
    probeMode: "readback-only",
    observedValue: 1.5,
    typeTag: "f",
    evidenceLevel: "observed",
  },
  contextValueMetadata: Array.from({ length: 9 }, (_, index) => ({
    contextId: `quickfx:oscillator:${index}`,
    valueType: "float",
    evidenceLevel: "observed",
  })),
  classification: {
    accessMode: "read-write",
    behaviorKind: "state-value",
    writeTestStatus: "write-readback-tested",
    readbackStatus: "readback-tested",
    evidenceLevel: "observed",
  },
};

describe("Object Tree property cards", () => {
  it("builds compact cards by default", () => {
    const card = buildObjectPropertyCard(entry);

    expect(card.path).toBe("FX.N.N.N.Oscillator.Period");
    expect(card).not.toHaveProperty("variants");
    expect(card).not.toHaveProperty("probeContexts");
    expect(card).not.toHaveProperty("contextValueMetadata");
    expect(card).not.toHaveProperty("details");
    expect(card.detailAvailable).toEqual({
      variants: 12,
      probeContexts: 9,
      contextValueMetadata: 9,
    });
    expect(card.valueSummary).toMatchObject({
      valueType: "float",
      acceptedValueCount: 2,
      unit: "seconds",
      evidenceLevel: "observed",
      locationKind: "quickfx-slot",
      contextValueMetadataCount: 9,
      range: {
        min: 0,
        max: 10,
        dynamicMaxExpression: "selected QuickFX effect period maximum",
        boundaryBehavior: "clamp",
      },
    });
    expect(card.readbackSummary).toEqual({
      status: "readable",
      accessMechanism: "pangoscript-expression",
      probePath: "FX.0.0.0.Oscillator.Period",
      valueType: "float",
      typeTag: "f",
      evidenceLevel: "observed",
      observedValue: 1.5,
    });
    expect(card.classification?.accessMode).toBe("read-write");
  });

  it("summarizes consistent context value metadata when root value metadata is absent", () => {
    const card = buildObjectPropertyCard({
      ...entry,
      path: "FX.N.N.N.Enabled",
      normalizedPath: "FX.N.N.N.Enabled",
      property: "Enabled",
      valueMetadata: undefined,
      readbackMetadata: undefined,
      contextValueMetadata: Array.from({ length: 2 }, (_, index) => ({
        contextId: `quickfx:enabled:${index}`,
        valueType: "boolean",
        valueRange: {
          min: 0,
          max: 1,
          boundaryBehavior: "clamp",
          evidenceLevel: "observed",
        },
        acceptedValues: [
          { value: 0, label: "OFF" },
          { value: 1, label: "ON" },
        ],
        evidenceLevel: "observed",
        locationContext: {
          kind: "quickfx-slot",
          populationDependent: true,
        },
      })),
    });

    expect(card.valueSummary).toMatchObject({
      valueType: "boolean",
      acceptedValueCount: 2,
      evidenceLevel: "observed",
      locationKind: "quickfx-slot",
      contextValueMetadataCount: 2,
      range: {
        min: 0,
        max: 1,
        boundaryBehavior: "clamp",
        evidenceLevel: "observed",
      },
    });
  });

  it("expands detail arrays only when requested and applies hard caps", () => {
    const card = buildObjectPropertyCard(entry, {
      includeDetails: true,
      variantLimit: 500,
      probeContextLimit: 500,
      contextValueLimit: 500,
    });

    expect(card.details?.variants).toHaveLength(OBJECT_PROPERTY_DETAIL_LIMITS.maxVariantLimit);
    expect(card.details?.probeContexts).toHaveLength(OBJECT_PROPERTY_DETAIL_LIMITS.maxProbeContextLimit);
    expect(card.details?.contextValueMetadata).toHaveLength(OBJECT_PROPERTY_DETAIL_LIMITS.maxContextValueLimit);
    expect(card.details?.limits).toEqual({
      variantLimit: OBJECT_PROPERTY_DETAIL_LIMITS.maxVariantLimit,
      probeContextLimit: OBJECT_PROPERTY_DETAIL_LIMITS.maxProbeContextLimit,
      contextValueLimit: OBJECT_PROPERTY_DETAIL_LIMITS.maxContextValueLimit,
    });
    expect(card.details?.omitted).toEqual({
      variants: 2,
      probeContexts: 1,
      contextValueMetadata: 1,
    });
  });

  it("uses default detail limits for invalid detail inputs", () => {
    expect(
      resolveObjectPropertyDetailOptions({
        includeDetails: true,
        variantLimit: -1,
        probeContextLimit: Number.NaN,
        contextValueLimit: 0,
      }),
    ).toEqual({
      includeDetails: true,
      variantLimit: OBJECT_PROPERTY_DETAIL_LIMITS.defaultVariantLimit,
      probeContextLimit: OBJECT_PROPERTY_DETAIL_LIMITS.defaultProbeContextLimit,
      contextValueLimit: OBJECT_PROPERTY_DETAIL_LIMITS.defaultContextValueLimit,
    });
  });

  it("pages broad lists with a fixed maximum", () => {
    const page = pageItems(
      Array.from({ length: 150 }, (_, index) => index),
      3,
      500,
    );

    expect(page.items[0]).toBe(3);
    expect(page.items).toHaveLength(OBJECT_PROPERTY_DETAIL_LIMITS.maxPageLimit);
    expect(page.nextOffset).toBe(103);
  });
});
