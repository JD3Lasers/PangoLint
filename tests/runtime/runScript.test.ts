import { describe, expect, it, vi } from "vitest";

import { runScript } from "../../src/runtime/commandBatch/runScript";

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

  it("refuses control-flow scripts before sending BEYOND Talk", async () => {
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
    expect(result.error).toMatch(/BEYOND Talk.*straight-line command batches/i);
    expect(result.error).not.toMatch(/Talk UDP/i);
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

  it("uses Talk TCP when TCP transport is selected", async () => {
    const result = await runScript("Hello", {
      talkHost: "127.0.0.1",
      talkPort: 16062,
      talkTransport: "tcp",
      talkTcpHost: "127.0.0.1",
      talkTcpPort: 16063,
      sendTcp: async (options) => {
        expect(options.commands).toEqual(["Hello"]);
        return {
          ok: true,
          transport: "tcp",
          talkStatus: "ok",
          talkGreeting: "Welcome to BEYOND!",
          talkReplies: [
            { commandText: "Echo 1", status: "ok", replyLines: ["OK"], redacted: false },
            { lineNumber: 1, commandText: "Hello", status: "ok", replyLines: ["Hello!", "OK"], redacted: false },
          ],
          linesSent: 1,
          payloadsSent: 0,
          bytesSent: 15,
        };
      },
      send: async () => {
        throw new Error("UDP fallback should not run");
      },
    });

    expect(result).toMatchObject({
      ok: true,
      transport: "tcp",
      talkStatus: "ok",
      talkGreeting: "Welcome to BEYOND!",
      linesSent: 1,
      payloadsSent: 0,
    });
    expect(result.talkReplies?.[1].replyLines).toEqual(["Hello!", "OK"]);
  });

  it("does not apply UDP datagram sizing to TCP-only sends", async () => {
    const longCommand = `DisplayPopup "${"x".repeat(80)}"`;
    const result = await runScript(longCommand, {
      talkHost: "127.0.0.1",
      talkPort: 16062,
      talkTransport: "tcp",
      talkTcpHost: "127.0.0.1",
      talkTcpPort: 16063,
      maxPayloadBytes: 20,
      sendTcp: async (options) => {
        expect(options.commands).toEqual([longCommand]);
        return {
          ok: true,
          transport: "tcp",
          talkStatus: "ok",
          talkReplies: [{ lineNumber: 1, commandText: longCommand, status: "ok", replyLines: ["OK"], redacted: false }],
          linesSent: 1,
          payloadsSent: 0,
          bytesSent: Buffer.byteLength(`${longCommand}\r\n`, "ascii"),
        };
      },
      send: async () => {
        throw new Error("UDP fallback should not run");
      },
    });

    expect(result.ok).toBe(true);
    expect(result.transport).toBe("tcp");
    expect(result.linesSent).toBe(1);
  });

  it("falls back from auto TCP to UDP only when fallback is explicitly allowed before TCP replies", async () => {
    const udpPayloads: Buffer[] = [];
    const result = await runScript("Hello", {
      talkHost: "127.0.0.1",
      talkPort: 16062,
      talkTransport: "auto",
      talkTcpHost: "127.0.0.1",
      talkTcpPort: 16063,
      talkUdpFallbackAllowed: true,
      sendTcp: async () => ({
        ok: false,
        transport: "tcp",
        talkStatus: "closed",
        talkReplies: [],
        linesSent: 0,
        payloadsSent: 0,
        bytesSent: 0,
        error: "ECONNREFUSED",
      }),
      send: async (_host, _port, payload) => {
        udpPayloads.push(payload);
      },
    });

    expect(result.ok).toBe(true);
    expect(result.transport).toBe("udp");
    expect(result.talkStatus).toBe("send-only");
    expect(udpPayloads).toHaveLength(1);
  });

  it("does not fall back to UDP after TCP returns a BEYOND error", async () => {
    const send = vi.fn(async () => {});
    const result = await runScript("badcommand 123", {
      talkHost: "127.0.0.1",
      talkPort: 16062,
      talkTransport: "auto",
      talkTcpHost: "127.0.0.1",
      talkTcpPort: 16063,
      talkUdpFallbackAllowed: true,
      sendTcp: async () => ({
        ok: false,
        transport: "tcp",
        talkStatus: "error",
        talkReplies: [
          { commandText: "Echo 1", status: "ok", replyLines: ["OK"], redacted: false },
          {
            lineNumber: 1,
            commandText: "badcommand 123",
            status: "error",
            replyLines: ["ERROR Line: 1, Error: Unknown command: badcommand"],
            redacted: false,
          },
        ],
        beyondError: {
          lineNumber: 1,
          message: "Unknown command: badcommand",
          replyLine: "ERROR Line: 1, Error: Unknown command: badcommand",
          redacted: false,
        },
        linesSent: 1,
        payloadsSent: 0,
        bytesSent: 29,
        error: "Unknown command: badcommand",
      }),
      send,
    });

    expect(result.ok).toBe(false);
    expect(result.transport).toBe("tcp");
    expect(result.talkStatus).toBe("error");
    expect(result.beyondError?.message).toBe("Unknown command: badcommand");
    expect(send).not.toHaveBeenCalled();
  });
});
