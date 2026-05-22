import { describe, expect, it } from "vitest";
import { validateReadbackPropertyPath } from "../../../src/runtime/readback/readbackPropertyPath";
import { createReadbackRequestId } from "../../../src/runtime/readback/readbackRequestId";

describe("readback request helpers", () => {
  it("creates unpredictable request IDs for OSC correlation", () => {
    const first = createReadbackRequestId("validate");
    const second = createReadbackRequestId("validate");

    expect(first).toMatch(/^validate-[a-f0-9]{32}$/);
    expect(second).toMatch(/^validate-[a-f0-9]{32}$/);
    expect(first).not.toBe(second);
    expect(first).not.toMatch(/^validate-\d{10,}-\d+$/);
  });

  it("accepts hyphenated FB controller roots as readback property paths", () => {
    expect(validateReadbackPropertyPath("FB4-ABC123.Connected")).toBeUndefined();
  });
});
