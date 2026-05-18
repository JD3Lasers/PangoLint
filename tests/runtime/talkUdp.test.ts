import { describe, expect, it } from "vitest";

import { buildTalkPayloads } from "../../src/runtime/talkUdp";

describe("Talk UDP payloads", () => {
  it("renders ASCII command lines with CRLF terminators", () => {
    const payloads = buildTalkPayloads(["SelectZone 1", "Brightness 50\r\n"]);

    expect(payloads.map((payload) => payload.toString("ascii"))).toEqual(["SelectZone 1\r\nBrightness 50\r\n"]);
  });

  it("chunks payloads by byte limit", () => {
    const payloads = buildTalkPayloads(["SelectZone 1", "SelectZone 2"], {
      maxPayloadBytes: 16,
    });

    expect(payloads).toHaveLength(2);
    expect(payloads.every((payload) => payload.length <= 16)).toBe(true);
  });

  it("rejects non-ASCII command text with line context", () => {
    expect(() => buildTalkPayloads(["SelectZoneName café"])).toThrow(/line 1.*non-ASCII/);
  });

  it("rejects embedded line breaks inside a command argument", () => {
    expect(() => buildTalkPayloads(['Zone.0.Name = "Main"\r\nDisableLaserOutput'])).toThrow(/line 1.*single line/i);
  });
});
