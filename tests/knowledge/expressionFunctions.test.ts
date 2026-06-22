import { describe, expect, it } from "vitest";

import { EXPRESSION_FUNCTIONS, expressionFunctionAtPosition } from "../../src/knowledge/expressionFunctions";

function registryNames(): string[] {
  return EXPRESSION_FUNCTIONS.map((entry) => entry.canonical.toLowerCase()).sort();
}

describe("expression function knowledge", () => {
  it("includes external-control delta helpers and rounding helpers", () => {
    expect(registryNames()).toEqual(expect.arrayContaining(["deltavalue", "extdelta", "extvalue", "round"]));
  });

  it("includes Timeline editor tab readbacks", () => {
    expect(registryNames()).toEqual(expect.arrayContaining(["gettimelinetabindex", "gettimelinetabname"]));
  });

  it("matches known expression functions in command/property argument positions", () => {
    const deltaValueLine = "Master.PhFriction deltavalue (-1,1)";
    const extDeltaLine = "SetBpmDelta extdelta (-1)";
    const roundLine = "shift = round(extvalue(0,2)*10)/10";
    const timelineReadbackLine =
      'OscOutTTS "/pangolint/timeline-tab/current", "si", GetTimelineTabName, GetTimelineTabIndex';

    expect(
      expressionFunctionAtPosition(deltaValueLine, deltaValueLine.indexOf("deltavalue") + 2)?.entry.canonical,
    ).toBe("DeltaValue");
    expect(expressionFunctionAtPosition(extDeltaLine, extDeltaLine.indexOf("extdelta") + 2)?.entry.canonical).toBe(
      "ExtDelta",
    );
    expect(expressionFunctionAtPosition(roundLine, roundLine.indexOf("round") + 2)?.entry.canonical).toBe("round");
    expect(
      expressionFunctionAtPosition(timelineReadbackLine, timelineReadbackLine.indexOf("GetTimelineTabName") + 2)?.entry
        .canonical,
    ).toBe("GetTimelineTabName");
    expect(
      expressionFunctionAtPosition(timelineReadbackLine, timelineReadbackLine.indexOf("GetTimelineTabIndex") + 2)?.entry
        .canonical,
    ).toBe("GetTimelineTabIndex");
  });

  it("does not match Timeline editor tab readbacks with parentheses", () => {
    const invalidLine = 'OscOutTTS "/pangolint/timeline-tab/current", "s", GetTimelineTabName()';

    expect(expressionFunctionAtPosition(invalidLine, invalidLine.indexOf("GetTimelineTabName") + 2)).toBeUndefined();
  });

  it("records observed ExtDelta editor-default behavior without overstating trigger support", () => {
    const extDelta = EXPRESSION_FUNCTIONS.find((entry) => entry.canonical === "ExtDelta");

    expect(extDelta).toMatchObject({
      evidenceLevel: "observed",
      confidence: "medium",
    });
    expect(extDelta?.notes?.[0]?.text).toContain("returned 1.000000");
    expect(extDelta?.notes?.[0]?.text).toContain("remain unvalidated");
  });

  it("records the ExtValue property-assignment runtime writeback observation", () => {
    const extValue = EXPRESSION_FUNCTIONS.find((entry) => entry.canonical === "ExtValue");

    expect(extValue?.notes?.[0]?.text).toContain("Master.PhFriction = ExtValue (1,2)");
    expect(extValue?.notes?.[0]?.text).toContain("changed Master.PhFriction from 10.000000 to 1.000000");
  });

  it("records DeltaValue as MIDI-slot scoped while preserving direct editor rejection", () => {
    const deltaValue = EXPRESSION_FUNCTIONS.find((entry) => entry.canonical === "DeltaValue");

    expect(deltaValue).toMatchObject({
      evidenceLevel: "observed",
      confidence: "medium",
    });
    expect(deltaValue?.forms[0].description).toContain("APC40 MIDI-to-PangoScript slot");
    expect(deltaValue?.forms[0].description).toContain("Master.PhFriction deltavalue (-1,1)");
    expect(deltaValue?.notes?.[0]?.text).toContain("direct editor property probes");
    expect(deltaValue?.notes?.[0]?.text).toContain("Operation expected: (");
    expect(deltaValue?.notes?.[0]?.text).toContain("Master.PhFriction DeltaValue(-1, 1)");
    expect(deltaValue?.notes?.[0]?.text).toContain("Master.PhFriction deltavalue (-1,1)");
    expect(deltaValue?.notes?.[0]?.text).toContain("DefineMidiTrigger/InRangeTrigger handler");
  });

  it("records observed int, intstr, and max nesting behavior", () => {
    for (const name of ["int", "intstr", "max"]) {
      const entry = EXPRESSION_FUNCTIONS.find((candidate) => candidate.canonical === name);

      expect(entry).toMatchObject({
        evidenceLevel: "observed",
        confidence: "high",
      });
    }

    expect(EXPRESSION_FUNCTIONS.find((entry) => entry.canonical === "int")?.notes?.[0]?.text).toContain(
      "emitted integer callback value 3",
    );
    expect(EXPRESSION_FUNCTIONS.find((entry) => entry.canonical === "intstr")?.notes?.[0]?.text).toContain('"int=3"');
    expect(EXPRESSION_FUNCTIONS.find((entry) => entry.canonical === "max")?.notes?.[0]?.text).toContain(
      "callback value 8",
    );
  });

  it("records Timeline editor tab readback evidence without modeling the readbacks as commands", () => {
    const tabName = EXPRESSION_FUNCTIONS.find((entry) => entry.canonical === "GetTimelineTabName");
    const tabIndex = EXPRESSION_FUNCTIONS.find((entry) => entry.canonical === "GetTimelineTabIndex");

    expect(tabName).toMatchObject({
      evidenceLevel: "observed",
      confidence: "high",
      forms: [
        expect.objectContaining({
          signature: "GetTimelineTabName",
          parameters: [],
        }),
      ],
      tags: expect.arrayContaining(["timeline", "tab", "readback"]),
    });
    expect(tabName?.description).toContain("without parentheses");
    expect(tabName?.notes?.[0]?.text).toContain("GetTimelineTabName()");

    expect(tabIndex).toMatchObject({
      evidenceLevel: "observed",
      confidence: "high",
      forms: [
        expect.objectContaining({
          signature: "GetTimelineTabIndex",
          parameters: [],
        }),
      ],
      tags: expect.arrayContaining(["timeline", "tab", "readback"]),
    });
    expect(tabIndex?.description).toContain("zero-based integer");
    expect(tabIndex?.notes?.[1]?.text).toContain("one-based argument");
  });
});
