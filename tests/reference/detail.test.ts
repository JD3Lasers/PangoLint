import { describe, expect, it } from "vitest";
import {
  buildObjectValueCardSummaryText,
  buildObjectValueSummaryText,
  hasAnyMeaningfulParam,
  objectBehaviorSummary,
  objectPropertyPathDisplay,
  objectReadbackCardSummary,
} from "../../src/reference/bundle/detail";
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
    ).toBe("boolean; 0..1; clamps outside range; 2 accepted values");
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
});

describe("object readback card summary text", () => {
  it("does not present status-only readback test state as a value", () => {
    expect(objectReadbackCardSummary({ status: "readback-tested", evidenceLevel: "observed" })).toBeNull();
  });

  it("summarizes readback data when a readable value shape is present", () => {
    expect(objectReadbackCardSummary({ status: "readable", valueType: "float", observedValue: 1.5 })).toBe(
      "readback; float; observed 1.5",
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
});
