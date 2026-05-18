import { describe, expect, it } from "vitest";

import { formatParameterRangeMetadata } from "../../src/knowledge/parameterMetadata";

describe("parameter metadata formatting", () => {
  it("renders structured numeric bounds when no legacy range string exists", () => {
    expect(
      formatParameterRangeMetadata({
        valueRange: {
          min: 1,
          max: 600,
          unit: "bpm",
          boundaryBehavior: "clamp",
        },
      }),
    ).toBe("1..600; bpm; clamps outside range");
  });

  it("avoids duplicating bounds already present in the legacy range string", () => {
    expect(
      formatParameterRangeMetadata({
        range: "1..600",
        valueRange: {
          min: 1,
          max: 600,
          unit: "bpm",
          boundaryBehavior: "clamp",
        },
      }),
    ).toBe("1..600 · bpm; clamps outside range");
  });

  it("renders accepted value labels with structured range details", () => {
    expect(
      formatParameterRangeMetadata({
        valueRange: {
          min: 0,
          max: 1,
          maxInclusive: false,
        },
        acceptedValues: [
          { value: 0, label: "OFF" },
          { value: 1, label: "ON" },
        ],
      }),
    ).toBe(">= 0 and < 1 · 0=OFF, 1=ON");
  });
});
