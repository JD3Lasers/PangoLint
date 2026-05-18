import { describe, expect, it, vi } from "vitest";

import { runScript } from "../../src/runtime/runScript";

describe("runScript", () => {
  it("strips blank lines and full-line comments before sending", async () => {
    const calls: { host: string; port: number; payload: Buffer }[] = [];
    const result = await runScript(
      ["// header comment", "", "Brightness 50", "  // indented comment", "SelectZone 1", ""].join("\n"),
      {
        talkHost: "127.0.0.1",
        talkPort: 16062,
        send: async (host, port, payload) => {
          calls.push({ host, port, payload });
        },
      },
    );
    expect(result.ok).toBe(true);
    expect(result.linesSent).toBe(2);
    expect(calls).toHaveLength(1);
    const text = calls[0].payload.toString("ascii");
    expect(text).toContain("Brightness 50");
    expect(text).toContain("SelectZone 1");
    expect(text).not.toContain("// header");
  });

  it("returns ok=false with a clear error when the script is empty after stripping", async () => {
    const result = await runScript(["// only comments", "", "  // more"].join("\n"), {
      talkHost: "127.0.0.1",
      talkPort: 16062,
      send: async () => {
        throw new Error("should not send");
      },
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no executable lines/i);
    expect(result.linesSent).toBe(0);
  });

  it("refuses control-flow scripts before sending Talk UDP", async () => {
    let sends = 0;
    const result = await runScript(
      [
        'OscOutTTS "/pangolint/test/start", "s", "control-flow-001"',
        "if (1 = 1) goto Done",
        'OscOutTTS "/pangolint/test/skipped", "s", "control-flow-001"',
        "Done:",
        "exit",
      ].join("\n"),
      {
        talkHost: "127.0.0.1",
        talkPort: 16062,
        send: async () => {
          sends++;
        },
      },
    );

    expect(result.ok).toBe(false);
    expect(result.linesSent).toBe(0);
    expect(result.payloadsSent).toBe(0);
    expect(result.bytesSent).toBe(0);
    expect(result.error).toMatch(/Talk UDP.*straight-line command batches/i);
    expect(result.error).toMatch(/line 2/i);
    expect(result.error).toMatch(/paste.*BEYOND/i);
    expect(sends).toBe(0);
  });

  it("refuses for-loop syntax even when the line contains an assignment operator", async () => {
    const send = vi.fn(async () => {});
    const result = await runScript(["var index", "For index = 1 To 3", "Next"].join("\n"), {
      talkHost: "127.0.0.1",
      talkPort: 16062,
      send,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/For control flow at line 2/i);
    expect(send).not.toHaveBeenCalled();
  });

  it("splits across datagrams when payload exceeds maxPayloadBytes", async () => {
    const lines = Array.from({ length: 20 }, (_, i) => `Brightness ${i}`);
    const calls: Buffer[] = [];
    const result = await runScript(lines.join("\n"), {
      talkHost: "127.0.0.1",
      talkPort: 16062,
      maxPayloadBytes: 50,
      send: async (_h, _p, payload) => {
        calls.push(payload);
      },
    });
    expect(result.ok).toBe(true);
    expect(result.payloadsSent).toBeGreaterThan(1);
    expect(calls.length).toBe(result.payloadsSent);
  });

  it("propagates send errors and reports bytesSent up to the failure", async () => {
    let count = 0;
    const result = await runScript(["A", "B", "C"].join("\n"), {
      talkHost: "127.0.0.1",
      talkPort: 16062,
      maxPayloadBytes: 3, // forces a payload per line
      send: async (_h, _p, _payload) => {
        count++;
        if (count === 2) throw new Error("simulated network failure");
        // first send succeeds, second throws
        return Promise.resolve();
      },
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("simulated network failure");
    expect(result.payloadsSent).toBe(1);
    expect(result.bytesSent).toBeGreaterThan(0);
  });

  it("preserves inline comments (BEYOND parses them out)", async () => {
    const calls: Buffer[] = [];
    await runScript("Brightness 50  // dim it", {
      talkHost: "127.0.0.1",
      talkPort: 16062,
      send: async (_h, _p, payload) => {
        calls.push(payload);
      },
    });
    expect(calls[0].toString("ascii")).toContain("Brightness 50  // dim it");
  });
});
