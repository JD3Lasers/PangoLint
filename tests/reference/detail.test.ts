import { describe, expect, it } from "vitest";
import { hasAnyMeaningfulParam } from "../../src/reference/bundle/detail/commandDetail";
import { objectPropertyPathDisplay } from "../../src/reference/bundle/detail/objectDetail";
import {
  buildObjectValueCardSummaryParts,
  buildObjectValueCardSummaryText,
  buildObjectValueSummaryParts,
  buildObjectValueSummaryText,
  describeBoundaryBehavior,
  objectBehaviorSummary,
  objectBehaviorSummaryParts,
  objectReadbackCardSummary,
} from "../../src/reference/bundle/detail/objectPropertySummary";
import { formatSafetyTextForReference, formatSafetyTierLabel } from "../../src/reference/bundle/safetyTierDisplay";
import type { ReferenceParameter } from "../../src/reference/bundle/types";

function param(overrides: Partial<ReferenceParameter> = {}): ReferenceParameter {
  return { name: "arg1", type: "unknown", required: false, ...overrides };
}

describe("hasAnyMeaningfulParam", () => {
  it("returns false when all params are sparse (name + unknown type only)", () => {
    expect(hasAnyMeaningfulParam([param(), param({ name: "arg2" })])).toBe(false);
  });

  it("returns false for empty array", () => {
    expect(hasAnyMeaningfulParam([])).toBe(false);
  });

  it("returns true when a param has a non-unknown type", () => {
    expect(hasAnyMeaningfulParam([param({ type: "Integer" })])).toBe(true);
  });

  it("returns true when a param has a description", () => {
    expect(hasAnyMeaningfulParam([param({ description: "The target intensity" })])).toBe(true);
  });

  it("returns true when a param has a range string", () => {
    expect(hasAnyMeaningfulParam([param({ range: "0..255" })])).toBe(true);
  });

  it("returns true when a param has a valueRange", () => {
    expect(hasAnyMeaningfulParam([param({ valueRange: { min: 0, max: 255 } })])).toBe(true);
  });

  it("returns true when a param has accepted values", () => {
    expect(hasAnyMeaningfulParam([param({ acceptedValues: [{ value: 0 }] })])).toBe(true);
  });

  it("returns true when at least one param in a mixed list is meaningful", () => {
    expect(hasAnyMeaningfulParam([param(), param({ description: "useful" })])).toBe(true);
  });
});

describe("object value summary text", () => {
  it("does not repeat a boolean value type as the range unit", () => {
    expect(
      buildObjectValueCardSummaryText({
        valueType: "boolean",
        range: {
          min: 0,
          max: 1,
          unit: "boolean",
          boundaryBehavior: "clamp",
        },
        acceptedValueCount: 2,
      }),
    ).toBe("boolean; 0..1; clamps outside range");
  });

  it("does not repeat a boolean metadata value type as the range unit", () => {
    expect(
      buildObjectValueSummaryText({
        valueType: "boolean",
        valueRange: {
          min: 0,
          max: 1,
          unit: "boolean",
          boundaryBehavior: "clamp",
        },
        acceptedValues: [
          { value: 0, label: "OFF" },
          { value: 1, label: "ON" },
        ],
      }),
    ).toBe("boolean; 0..1; clamps outside range; 0=OFF, 1=ON");
  });

  it("splits value range facts from value format labels", () => {
    expect(
      buildObjectValueCardSummaryParts({
        valueType: "integer",
        range: {
          min: -2147483648,
          max: 2147483647,
          unit: "signed color integer",
          boundaryBehavior: "wrap",
        },
        locationKind: "indexed-root",
      }),
    ).toEqual({
      valueParts: ["integer", "-2147483648..2147483647", "wraps outside range"],
      formatParts: ["signed color integer"],
    });
  });

  it("keeps indexed root context out of public value summaries", () => {
    expect(
      buildObjectValueSummaryParts({
        valueType: "number",
        valueRange: {
          min: 1,
          max: 50,
          unit: "physics scalar",
          boundaryBehavior: "clamp",
        },
        locationContext: {
          kind: "indexed-root",
          populationDependent: true,
        },
      }),
    ).toEqual({
      valueParts: ["number", "1..50", "clamps outside range"],
      formatParts: ["physics scalar"],
    });
  });

  it("uses compact wording for unknown range behavior", () => {
    expect(describeBoundaryBehavior("unknown")).toBe("unknown");
    expect(
      buildObjectValueCardSummaryParts({
        valueType: "integer",
        range: {
          min: 256,
          max: 256,
          boundaryBehavior: "unknown",
        },
      }),
    ).toEqual({
      valueParts: ["integer", "256..256", "unknown outside range"],
      formatParts: [],
    });
  });

  it("can hide unknown range behavior for read-only object properties", () => {
    expect(
      buildObjectValueCardSummaryParts(
        {
          valueType: "integer",
          range: {
            min: 256,
            max: 256,
            boundaryBehavior: "unknown",
          },
        },
        { hideUnknownBoundaryBehavior: true },
      ),
    ).toEqual({
      valueParts: ["integer", "256..256"],
      formatParts: [],
    });
  });
});

describe("object behavior summary text", () => {
  it("keeps internal test status out of the visible behavior summary", () => {
    expect(
      objectBehaviorSummary({
        accessMode: "read-write",
        behaviorKind: "state-value",
        writeTestStatus: "write-readback-tested",
        readbackStatus: "readback-tested",
      }),
    ).toBe("read write; state value");
  });

  it("returns behavior parts for stacked table display", () => {
    expect(
      objectBehaviorSummaryParts({
        accessMode: "read-write",
        behaviorKind: "flag-state",
        writeTestStatus: "write-readback-tested",
        readbackStatus: "readback-tested",
      }),
    ).toEqual(["read write", "flag state"]);
  });

  it("uses compact wording for computed status rows", () => {
    expect(
      objectBehaviorSummaryParts({
        accessMode: "read-only",
        behaviorKind: "computed-status",
        writeTestStatus: "write-no-op-tested",
        readbackStatus: "readback-tested",
      }),
    ).toEqual(["read only", "status"]);
  });
});

describe("object readback card summary text", () => {
  it("does not present status-only readback test state as a value", () => {
    expect(objectReadbackCardSummary({ status: "readback-tested", evidenceLevel: "observed" })).toBeNull();
  });

  it("summarizes readback data without exposing observed test values", () => {
    expect(objectReadbackCardSummary({ status: "readable", valueType: "float", observedValue: 1.5 })).toBe(
      "readback; float",
    );
  });

  it("does not show observed readback values without a public value shape", () => {
    expect(objectReadbackCardSummary({ status: "readable", observedValue: 1.5 })).toBeNull();
  });
});

describe("safety tier display labels", () => {
  it("maps internal safety tiers to user-facing severity order", () => {
    expect(formatSafetyTierLabel("T4")).toBe("Safety 1");
    expect(formatSafetyTierLabel("T3")).toBe("Safety 2");
    expect(formatSafetyTierLabel("T2")).toBe("Safety 3");
    expect(formatSafetyTierLabel("T1")).toBe("Safety 4");
    expect(formatSafetyTierLabel("T0")).toBe("Offline");
    expect(formatSafetyTierLabel("unknown")).toBeNull();
  });

  it("maps internal tier tokens inside reference text", () => {
    expect(formatSafetyTextForReference("ExecCmd is T4. T1 readback remains lower risk than T3 output.")).toBe(
      "ExecCmd is Safety 1. Safety 4 readback remains lower risk than Safety 2 output.",
    );
  });
});

describe("object property path display", () => {
  it("shows effect-relative FX control names while preserving the QuickFX cell path", () => {
    expect(objectPropertyPathDisplay("FX.N.N.N.Oscillator.Period", "fx-effect")).toEqual({
      primaryPath: "Oscillator.Period",
      secondaryLabel: "QuickFX cell path",
      secondaryPath: "FX.N.N.N.Oscillator.Period",
    });
  });

  it("keeps full FX paths as the primary schema label", () => {
    expect(objectPropertyPathDisplay("FX.N.N.N.Oscillator.Period", "schema")).toEqual({
      primaryPath: "FX.N.N.N.Oscillator.Period",
      secondaryLabel: null,
      secondaryPath: null,
    });
  });

  it("shows component-relative Universe property names while preserving the Object Tree path", () => {
    expect(
      objectPropertyPathDisplay("Universe.N.DropEff1.Effect.Name", "universe-component", "Universe.N.DropEff1"),
    ).toEqual({
      primaryPath: "Effect.Name",
      secondaryLabel: "Object Tree path",
      secondaryPath: "Universe.N.DropEff1.Effect.Name",
    });
  });
});
