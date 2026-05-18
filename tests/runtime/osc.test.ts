import { describe, expect, it } from "vitest";

import {
  buildOscMessage,
  decodeOscPacket,
  OscDecodeError,
  OscEncodeError,
  sourceMatchesExpectedHost,
} from "../../src/runtime/osc";

describe("OSC helpers", () => {
  it("round-trips supported OSC argument types", () => {
    const payload = buildOscMessage("/pangolint/ping", "sif", ["hello", 7, 1.5]);
    const decoded = decodeOscPacket(payload);

    expect(decoded).toEqual({
      address: "/pangolint/ping",
      typeTags: "sif",
      args: ["hello", 7, expect.closeTo(1.5, 0.0001)],
    });
  });

  it("rejects malformed OSC addresses", () => {
    expect(() => decodeOscPacket(Buffer.from("not-osc"))).toThrow(/invalid OSC address/);
  });

  it("rejects non-printable characters in address during encode", () => {
    expect(() => buildOscMessage("/bad\x01", "i", [0])).toThrow(OscEncodeError);
  });

  it("rejects null bytes in address during encode", () => {
    expect(() => buildOscMessage("/bad\0addr", "i", [0])).toThrow(OscEncodeError);
  });

  it("rejects non-numeric arguments for numeric tags", () => {
    expect(() => buildOscMessage("/x", "i", ["1" as unknown as number])).toThrow(OscEncodeError);
    expect(() => buildOscMessage("/x", "f", [Number.NaN])).toThrow(OscEncodeError);
    expect(() => buildOscMessage("/x", "i", [1.5])).toThrow(OscEncodeError);
    expect(() => buildOscMessage("/x", "r", [-1])).toThrow(OscEncodeError);
  });

  it("rejects non-string arguments for tag 's'", () => {
    expect(() => buildOscMessage("/x", "s", [42 as unknown as string])).toThrow(OscEncodeError);
  });

  it("rejects mismatched tag and argument counts", () => {
    expect(() => buildOscMessage("/x", "ii", [1])).toThrow(OscEncodeError);
  });

  it("decodes T/F/N argument-less tags", () => {
    const payload = buildOscMessage("/flags", "TFN", [true, false, null]);
    const decoded = decodeOscPacket(payload);

    expect(decoded.typeTags).toBe("TFN");
    expect(decoded.args).toEqual([true, false, null]);
  });

  it("rejects truncated int32 payloads", () => {
    const truncated = Buffer.concat([buildOscMessage("/x", "i", [1]).subarray(0, -1)]);
    expect(() => decodeOscPacket(truncated)).toThrow(OscDecodeError);
  });

  it("rejects unsupported type tags during decode", () => {
    const original = buildOscMessage("/x", "i", [1]);
    // Replace the 'i' (0x69) in ",i\0\0" with 'q' (0x71) to produce an unsupported tag.
    const tampered = Buffer.from(original);
    const tagIndex = tampered.indexOf(Buffer.from(",i"));
    tampered[tagIndex + 1] = 0x71;
    expect(() => decodeOscPacket(tampered)).toThrow(/unsupported OSC type tag/);
  });

  it("matches OSC source addresses only when the configured BEYOND host is an IP literal", () => {
    expect(
      sourceMatchesExpectedHost({ address: "/x", typeTags: "", args: [], sourceAddress: "192.0.2.147" }, "192.0.2.147"),
    ).toBe(true);
    expect(
      sourceMatchesExpectedHost({ address: "/x", typeTags: "", args: [], sourceAddress: "192.0.2.200" }, "192.0.2.147"),
    ).toBe(false);
    expect(
      sourceMatchesExpectedHost(
        { address: "/x", typeTags: "", args: [], sourceAddress: "::ffff:127.0.0.1" },
        "127.0.0.1",
      ),
    ).toBe(true);
    expect(
      sourceMatchesExpectedHost(
        { address: "/x", typeTags: "", args: [], sourceAddress: "192.0.2.200" },
        "beyond.local",
      ),
    ).toBe(true);
    expect(sourceMatchesExpectedHost({ address: "/x", typeTags: "", args: [] }, "192.0.2.147")).toBe(true);
  });
});
