import { describe, expect, it } from "vitest";

import { buildObjectValueAssignment } from "../../src/runtime/commandBatch/objectValueAssignment";

describe("object value assignment serialization", () => {
  it("serializes numbers as a single assignment", () => {
    expect(buildObjectValueAssignment("Master.Brightness", " 50 ")).toEqual({
      command: "Master.Brightness = 50",
      expectedValue: 50,
      typeTag: "f",
    });
  });

  it("quotes unquoted strings and preserves the expected value", () => {
    expect(buildObjectValueAssignment("Zone.0.Name", "Main stage")).toEqual({
      command: 'Zone.0.Name = "Main stage"',
      expectedValue: "Main stage",
      typeTag: "s",
    });
  });

  it("escapes embedded quotes without accepting pre-quoted values", () => {
    expect(buildObjectValueAssignment("Zone.0.Name", 'Main "A"')).toEqual({
      command: 'Zone.0.Name = "Main \\"A\\""',
      expectedValue: 'Main "A"',
      typeTag: "s",
    });
    expect(buildObjectValueAssignment("Zone.0.Name", '"Main"')).toMatchObject({
      error: expect.stringContaining("without wrapping quotes"),
    });
  });

  it("rejects multiline or control-character values before command construction", () => {
    expect(buildObjectValueAssignment("Zone.0.Name", "Main\r\nDisableLaserOutput")).toMatchObject({
      error: expect.stringContaining("single line"),
    });
    expect(buildObjectValueAssignment("Zone.0.Name", "Main\u0000Stage")).toMatchObject({
      error: expect.stringContaining("single line"),
    });
  });
});
