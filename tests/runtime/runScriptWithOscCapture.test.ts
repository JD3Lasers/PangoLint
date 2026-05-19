import { describe, expect, it, vi } from "vitest";

import type { OscMessage } from "../../src/runtime/osc";
import type { OscCaptureSession, StartOscCapture } from "../../src/runtime/oscCapture";
import { extractPangoLintOscAddresses, runScriptWithOscCapture } from "../../src/runtime/runScriptWithOscCapture";

function captureSession(messages: OscMessage[], events: string[]): OscCaptureSession {
  return {
    ready: Promise.resolve().then(() => {
      events.push("ready");
    }),
    done: Promise.resolve({ ok: true, messages, timedOut: false }),
    stop: vi.fn(),
  };
}

describe("extractPangoLintOscAddresses", () => {
  it("finds unique literal PangoLint OscOutTTS callback addresses and ignores comments", () => {
    const addresses = extractPangoLintOscAddresses(
      [
        'OscOutTTS "/pangolint/smoke/start", "s", requestId',
        '  OscOutTTS "/pangolint/smoke/step", "si", requestId, step',
        'OscOutTTS "/external/smoke", "s", requestId',
        '// OscOutTTS "/pangolint/commented", "s", requestId',
        'OscOutTTS "/pangolint/smoke/step", "si", requestId, step',
      ].join("\n"),
    );

    expect(addresses).toEqual(["/pangolint/smoke/start", "/pangolint/smoke/step"]);
  });

  it("finds documented parenthesized OscOutTTS callback forms", () => {
    const addresses = extractPangoLintOscAddresses(
      [
        'OscOutTTS("/pangolint/smoke/paren", "s", requestId)',
        'OscOutTTS ( "/pangolint/smoke/spaced", "s", requestId )',
      ].join("\n"),
    );

    expect(addresses).toEqual(["/pangolint/smoke/paren", "/pangolint/smoke/spaced"]);
  });
});

describe("runScriptWithOscCapture", () => {
  it("binds the OSC capture listener before sending Talk UDP", async () => {
    const events: string[] = [];
    const startCapture: StartOscCapture = vi.fn(async () =>
      captureSession([{ address: "/pangolint/smoke/done", typeTags: "s", args: ["req-1"] }], events),
    );

    const result = await runScriptWithOscCapture('OscOutTTS "/pangolint/smoke/done", "s", requestId', {
      talkHost: "192.0.2.147",
      talkPort: 16062,
      listenHost: "0.0.0.0",
      listenPort: 7000,
      timeoutMs: 1000,
      startCapture,
      send: async () => {
        events.push("send");
      },
    });

    expect(result.ok).toBe(true);
    expect(events).toEqual(["ready", "send"]);
    expect(startCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        addresses: ["/pangolint/smoke/done"],
        expectedSourceHost: "192.0.2.147",
        listenHost: "0.0.0.0",
        listenPort: 7000,
      }),
    );
    expect(result.callbacks?.messages).toEqual([{ address: "/pangolint/smoke/done", typeTags: "s", args: ["req-1"] }]);
  });

  it("does not open an OSC capture listener when the script has no PangoLint callbacks", async () => {
    const startCapture: StartOscCapture = vi.fn();

    const result = await runScriptWithOscCapture("Brightness 50", {
      talkHost: "192.0.2.147",
      talkPort: 16062,
      listenHost: "0.0.0.0",
      listenPort: 7000,
      timeoutMs: 1000,
      startCapture,
      send: async () => {},
    });

    expect(result.ok).toBe(true);
    expect(result.callbackAddresses).toEqual([]);
    expect(startCapture).not.toHaveBeenCalled();
  });

  it("does not open an OSC capture listener when Talk UDP preflight refuses control flow", async () => {
    const startCapture: StartOscCapture = vi.fn();
    const send = vi.fn(async () => {});

    const result = await runScriptWithOscCapture(
      ['OscOutTTS "/pangolint/smoke/start", "s", requestId', "if (1 = 1) goto Done", "Done:", "exit"].join("\n"),
      {
        talkHost: "192.0.2.147",
        talkPort: 16062,
        listenHost: "0.0.0.0",
        listenPort: 7000,
        timeoutMs: 1000,
        startCapture,
        send,
      },
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Talk UDP.*straight-line command batches/i);
    expect(result.callbackAddresses).toEqual(["/pangolint/smoke/start"]);
    expect(startCapture).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("uses the Talk TCP host as expected OSC source when TCP transport is selected", async () => {
    const events: string[] = [];
    const startCapture: StartOscCapture = vi.fn(async () =>
      captureSession([{ address: "/pangolint/smoke/done", typeTags: "s", args: ["req-1"] }], events),
    );

    await runScriptWithOscCapture('OscOutTTS "/pangolint/smoke/done", "s", requestId', {
      talkHost: "192.0.2.147",
      talkPort: 16062,
      talkTransport: "tcp",
      talkTcpHost: "192.0.2.148",
      talkTcpPort: 16063,
      listenHost: "0.0.0.0",
      listenPort: 7000,
      timeoutMs: 1000,
      startCapture,
      sendTcp: async () => ({
        ok: true,
        transport: "tcp",
        talkStatus: "ok",
        talkReplies: [],
        linesSent: 1,
        payloadsSent: 0,
        bytesSent: 10,
      }),
    });

    expect(startCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedSourceHost: "192.0.2.148",
      }),
    );
  });
});
