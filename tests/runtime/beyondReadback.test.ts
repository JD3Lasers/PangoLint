import { describe, expect, it, vi } from "vitest";
import type { ReadbackTransport } from "../../src/runtime/beyondReadback";
import {
  checkBeyondConnection,
  createReadbackRequestId,
  readBeyondProperty,
  validateReadbackPropertyPath,
  verifyCommandWrite,
} from "../../src/runtime/beyondReadback";
import type { SendTalkTcpCommandsOptions } from "../../src/runtime/talkTcp";

function deferred<T = void>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let i = 0; i < 20; i++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("condition was not met");
}

describe("BEYOND readback", () => {
  it("creates unpredictable request IDs for OSC correlation", () => {
    const first = createReadbackRequestId("validate");
    const second = createReadbackRequestId("validate");

    expect(first).toMatch(/^validate-[a-f0-9]{32}$/);
    expect(second).toMatch(/^validate-[a-f0-9]{32}$/);
    expect(first).not.toBe(second);
    expect(first).not.toMatch(/^validate-\d{10,}-\d+$/);
  });

  it("sends a readback-only OscOutTTS ping and matches the callback", async () => {
    const sentPayloads: string[] = [];
    const transport: ReadbackTransport = {
      sendTalk: async (_host, _port, payload) => {
        sentPayloads.push(payload.toString("ascii"));
      },
      listenForOsc: (_host, _port, predicate) => {
        const message = {
          address: "/pangolint/ping",
          typeTags: "s",
          args: ["request-123"],
        };
        expect(predicate(message)).toBe(true);
        return {
          ready: Promise.resolve(),
          message: Promise.resolve(message),
        };
      },
    };

    const result = await checkBeyondConnection(
      {
        talkHost: "192.0.2.147",
        talkPort: 16062,
        listenHost: "0.0.0.0",
        listenPort: 7000,
        requestId: "request-123",
        timeoutMs: 1000,
      },
      transport,
    );

    expect(result.ok).toBe(true);
    expect(result.message?.address).toBe("/pangolint/ping");
    expect(sentPayloads).toEqual(['OscOutTTS "/pangolint/ping", "s", "request-123"\r\n']);
  });

  it("does not send Talk UDP until the OSC listener is ready", async () => {
    const events: string[] = [];
    let resolveReady!: () => void;
    const ready = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
    const transport: ReadbackTransport = {
      sendTalk: async () => {
        events.push("send");
      },
      listenForOsc: () => ({
        ready: ready.then(() => {
          events.push("ready");
        }),
        message: Promise.resolve({
          address: "/pangolint/ping",
          typeTags: "s",
          args: ["request-123"],
        }),
      }),
    };

    const resultPromise = checkBeyondConnection(
      {
        talkHost: "192.0.2.147",
        talkPort: 16062,
        listenHost: "0.0.0.0",
        listenPort: 7000,
        requestId: "request-123",
        timeoutMs: 1000,
      },
      transport,
    );

    await Promise.resolve();
    expect(events).toEqual([]);

    resolveReady();
    const result = await resultPromise;

    expect(result.ok).toBe(true);
    expect(events).toEqual(["ready", "send"]);
  });

  it("returns a readiness failure before sending Talk UDP", async () => {
    const sends: Buffer[] = [];
    const readinessError = new Error("bind failed");
    const transport: ReadbackTransport = {
      sendTalk: async (_host, _port, payload) => {
        sends.push(payload);
      },
      listenForOsc: () => ({
        ready: Promise.reject(readinessError),
        message: Promise.reject(readinessError),
      }),
    };

    const result = await checkBeyondConnection(
      {
        talkHost: "192.0.2.147",
        talkPort: 16062,
        listenHost: "0.0.0.0",
        listenPort: 7000,
        requestId: "request-123",
        timeoutMs: 1000,
      },
      transport,
    );

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: "bind failed",
      }),
    );
    expect(sends).toEqual([]);
  });
});

describe("checkBeyondConnection logger", () => {
  const transport: ReadbackTransport = {
    sendTalk: async () => {},
    listenForOsc: () => ({
      ready: Promise.resolve(),
      message: Promise.resolve({ address: "/pangolint/ping", typeTags: "s", args: ["req-log"] }),
    }),
  };

  it("calls logger at bind, ready, send, callback, and result stages on success", async () => {
    const logs: string[] = [];
    await checkBeyondConnection(
      {
        talkHost: "127.0.0.1",
        talkPort: 16062,
        listenHost: "0.0.0.0",
        listenPort: 7000,
        requestId: "req-log",
        timeoutMs: 1000,
        logger: (msg) => logs.push(msg),
      },
      transport,
    );
    expect(logs[0]).toMatch(/binding OSC listener/);
    expect(logs[1]).toMatch(/listener ready/);
    expect(logs[2]).toMatch(/command sent/);
    expect(logs[3]).toMatch(/received callback/);
  });

  it("calls logger with failure message on error", async () => {
    const logs: string[] = [];
    const failTransport: ReadbackTransport = {
      sendTalk: async () => {},
      listenForOsc: () => ({
        ready: Promise.reject(new Error("bind EADDRINUSE")),
        message: Promise.reject(new Error("bind EADDRINUSE")),
      }),
    };
    const result = await checkBeyondConnection(
      {
        talkHost: "127.0.0.1",
        talkPort: 16062,
        listenHost: "0.0.0.0",
        listenPort: 7000,
        requestId: "req-log",
        timeoutMs: 1000,
        logger: (msg) => logs.push(msg),
      },
      failTransport,
    );
    expect(result.ok).toBe(false);
    expect(logs.at(-1)).toMatch(/failed:/);
  });
});

describe("readBeyondProperty", () => {
  const baseOptions = {
    talkHost: "192.0.2.147",
    talkPort: 16062,
    listenHost: "0.0.0.0",
    listenPort: 7000,
    timeoutMs: 3000,
    requestId: "req-abc",
  };

  it("sends a three-line read script and returns the float value", async () => {
    const sentPayloads: string[] = [];
    const transport: ReadbackTransport = {
      sendTalk: async (_host, _port, payload) => {
        sentPayloads.push(payload.toString("ascii"));
      },
      listenForOsc: (_host, _port, predicate) => {
        const message = { address: "/pangolint/readback/req-abc", typeTags: "f", args: [100] };
        expect(predicate(message)).toBe(true);
        return { ready: Promise.resolve(), message: Promise.resolve(message) };
      },
    };

    const result = await readBeyondProperty({ ...baseOptions, propertyPath: "Master.Brightness" }, transport);

    expect(result.ok).toBe(true);
    expect(result.propertyPath).toBe("Master.Brightness");
    expect(result.value).toBe(100);
    expect(sentPayloads).toEqual([
      'var v\r\nv = Master.Brightness\r\nOscOutTTS "/pangolint/readback/req-abc", "f", v\r\n',
    ]);
  });

  it("sends readback over Talk TCP when TCP transport is selected", async () => {
    const sentUdpPayloads: string[] = [];
    const tcpSends: SendTalkTcpCommandsOptions[] = [];
    let callbackAddress = "/pangolint/readback/unset";
    let sentTcp!: () => void;
    const tcpSent = new Promise<void>((resolve) => {
      sentTcp = resolve;
    });
    const transport: ReadbackTransport = {
      sendTalk: async (_host, _port, payload) => {
        sentUdpPayloads.push(payload.toString("ascii"));
      },
      sendTalkTcp: async (options) => {
        tcpSends.push(options);
        callbackAddress = options.commands[0].match(/OscOutTTS "([^"]+)"/)?.[1] ?? callbackAddress;
        sentTcp();
        return {
          ok: true,
          transport: "tcp",
          talkStatus: "ok",
          talkGreeting: "Welcome to BEYOND!",
          talkReplies: [
            { lineNumber: 1, commandText: options.commands[0], status: "ok", replyLines: ["OK"], redacted: false },
          ],
          linesSent: 1,
          payloadsSent: 0,
          bytesSent: 64,
        };
      },
      listenForOsc: (_host, _port, predicate) => ({
        ready: Promise.resolve(),
        message: tcpSent.then(() => {
          const message = {
            address: callbackAddress,
            typeTags: "f",
            args: [100],
            sourceAddress: "192.0.2.148",
          };
          expect(predicate(message)).toBe(true);
          return message;
        }),
      }),
    };

    const result = await readBeyondProperty(
      {
        ...baseOptions,
        propertyPath: "Master.Brightness",
        talkTransport: "tcp",
        talkTcpHost: "192.0.2.148",
        talkTcpPort: 16063,
      },
      transport,
    );

    expect(result.ok).toBe(true);
    expect(result.value).toBe(100);
    expect(result.transport).toBe("tcp");
    expect(result.talkStatus).toBe("ok");
    expect(sentUdpPayloads).toEqual([]);
    expect(tcpSends).toHaveLength(1);
    expect(tcpSends[0]).toEqual(
      expect.objectContaining({
        host: "192.0.2.148",
        port: 16063,
        commands: ['OscOutTTS "/pangolint/readback/req-abc", "f", Master.Brightness'],
      }),
    );
  });

  it("uses string type tag when explicitly requested", async () => {
    const sentPayloads: string[] = [];
    const transport: ReadbackTransport = {
      sendTalk: async (_host, _port, payload) => {
        sentPayloads.push(payload.toString("ascii"));
      },
      listenForOsc: (_host, _port, predicate) => {
        const message = { address: "/pangolint/readback/req-abc", typeTags: "s", args: ["zone-name"] };
        expect(predicate(message)).toBe(true);
        return { ready: Promise.resolve(), message: Promise.resolve(message) };
      },
    };

    const result = await readBeyondProperty({ ...baseOptions, propertyPath: "Zone.0.Name", typeTag: "s" }, transport);

    expect(result.ok).toBe(true);
    expect(result.value).toBe("zone-name");
    expect(sentPayloads[0]).toContain('"s", v');
  });

  it("rejects unsafe property paths before binding OSC or sending Talk UDP", async () => {
    const sends: Buffer[] = [];
    let listenCount = 0;
    const transport: ReadbackTransport = {
      sendTalk: async (_host, _port, payload) => {
        sends.push(payload);
      },
      listenForOsc: () => {
        listenCount += 1;
        return {
          ready: Promise.resolve(),
          message: Promise.resolve({ address: "/pangolint/readback/req-abc", typeTags: "f", args: [50] }),
        };
      },
    };

    const result = await readBeyondProperty(
      { ...baseOptions, propertyPath: "Master.Brightness\nDisableLaserOutput" },
      transport,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Invalid property path");
    expect(sends).toEqual([]);
    expect(listenCount).toBe(0);
  });

  it("accepts hyphenated FB controller roots as readback property paths", () => {
    expect(validateReadbackPropertyPath("FB4-ABC123.Connected")).toBeUndefined();
  });

  it("does not send Talk UDP until the OSC listener is ready", async () => {
    const events: string[] = [];
    let resolveReady!: () => void;
    const ready = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
    const transport: ReadbackTransport = {
      sendTalk: async () => {
        events.push("send");
      },
      listenForOsc: () => ({
        ready: ready.then(() => {
          events.push("ready");
        }),
        message: Promise.resolve({ address: "/pangolint/readback/req-abc", typeTags: "f", args: [50] }),
      }),
    };

    const resultPromise = readBeyondProperty({ ...baseOptions, propertyPath: "Master.Brightness" }, transport);

    await Promise.resolve();
    expect(events).toEqual([]);

    resolveReady();
    await resultPromise;
    expect(events).toEqual(["ready", "send"]);
  });

  it("serializes concurrent readbacks that share an OSC listen port", async () => {
    let activeListeners = 0;
    let maxActiveListeners = 0;
    const transport: ReadbackTransport = {
      sendTalk: async () => {},
      listenForOsc: (_host, _port, _predicate) => {
        activeListeners += 1;
        maxActiveListeners = Math.max(maxActiveListeners, activeListeners);
        const message = new Promise<{ address: string; typeTags: string; args: number[] }>((resolve) => {
          setTimeout(() => {
            activeListeners -= 1;
            resolve({ address: "/pangolint/readback/serialized", typeTags: "f", args: [activeListeners] });
          }, 10);
        });
        return { ready: Promise.resolve(), message };
      },
    };

    await Promise.all([
      readBeyondProperty({ ...baseOptions, requestId: "one", propertyPath: "Master.Brightness" }, transport),
      readBeyondProperty({ ...baseOptions, requestId: "two", propertyPath: "Master.Zoom" }, transport),
    ]);

    expect(maxActiveListeners).toBe(1);
  });

  it("returns error on transport failure", async () => {
    const transport: ReadbackTransport = {
      sendTalk: async () => {},
      listenForOsc: () => ({
        ready: Promise.reject(new Error("port in use")),
        message: Promise.reject(new Error("port in use")),
      }),
    };

    const result = await readBeyondProperty({ ...baseOptions, propertyPath: "Master.Brightness" }, transport);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("port in use");
    expect(result.propertyPath).toBe("Master.Brightness");
  });

  it("rejects non-matching OSC addresses", async () => {
    const transport: ReadbackTransport = {
      sendTalk: async () => {},
      listenForOsc: (_host, _port, predicate) => {
        const wrongAddress = { address: "/pangolint/readback/other-id", typeTags: "f", args: [0] };
        const rightAddress = { address: "/pangolint/readback/req-abc", typeTags: "f", args: [75] };
        expect(predicate(wrongAddress)).toBe(false);
        expect(predicate(rightAddress)).toBe(true);
        return { ready: Promise.resolve(), message: Promise.resolve(rightAddress) };
      },
    };

    const result = await readBeyondProperty({ ...baseOptions, propertyPath: "Master.Brightness" }, transport);
    expect(result.ok).toBe(true);
  });

  it("rejects spoofed readback callbacks with the right address but wrong shape or source", async () => {
    const transport: ReadbackTransport = {
      sendTalk: async () => {},
      listenForOsc: (_host, _port, predicate) => {
        const right = {
          address: "/pangolint/readback/req-abc",
          typeTags: "f",
          args: [75],
          sourceAddress: "192.0.2.147",
        };
        expect(predicate({ ...right, typeTags: "s", args: ["75"] })).toBe(false);
        expect(predicate({ ...right, args: [] })).toBe(false);
        expect(predicate({ ...right, sourceAddress: "192.0.2.200" })).toBe(false);
        expect(predicate(right)).toBe(true);
        return { ready: Promise.resolve(), message: Promise.resolve(right) };
      },
    };

    const result = await readBeyondProperty({ ...baseOptions, propertyPath: "Master.Brightness" }, transport);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(75);
  });
});

describe("verifyCommandWrite", () => {
  const baseOptions = {
    talkHost: "127.0.0.1",
    talkPort: 16062,
    listenHost: "0.0.0.0",
    listenPort: 7000,
    timeoutMs: 3000,
    requestId: "req-verify",
  };

  it("sends combined write+readback script in one payload", async () => {
    const sentPayloads: string[] = [];
    const transport: ReadbackTransport = {
      sendTalk: async (_host, _port, payload) => {
        sentPayloads.push(payload.toString("ascii"));
      },
      listenForOsc: (_host, _port, predicate) => {
        const message = { address: "/pangolint/verify/req-verify", typeTags: "f", args: [50] };
        expect(predicate(message)).toBe(true);
        return { ready: Promise.resolve(), message: Promise.resolve(message) };
      },
    };

    await verifyCommandWrite(
      { ...baseOptions, command: "Zoom 50", readbackPath: "Master.Zoom", expectedValue: 50 },
      transport,
    );

    expect(sentPayloads).toHaveLength(1);
    expect(sentPayloads[0]).toBe(
      'Zoom 50\r\nvar v\r\nv = Master.Zoom\r\nOscOutTTS "/pangolint/verify/req-verify", "f", v\r\n',
    );
  });

  it("sends write verification over Talk TCP when TCP transport is selected", async () => {
    const sentUdpPayloads: string[] = [];
    const tcpSends: SendTalkTcpCommandsOptions[] = [];
    let callbackAddress = "/pangolint/verify/unset";
    let sentTcp!: () => void;
    const tcpSent = new Promise<void>((resolve) => {
      sentTcp = resolve;
    });
    const transport: ReadbackTransport = {
      sendTalk: async (_host, _port, payload) => {
        sentUdpPayloads.push(payload.toString("ascii"));
      },
      sendTalkTcp: async (options) => {
        tcpSends.push(options);
        callbackAddress = options.commands.at(-1)?.match(/OscOutTTS "([^"]+)"/)?.[1] ?? callbackAddress;
        sentTcp();
        return {
          ok: true,
          transport: "tcp",
          talkStatus: "ok",
          talkReplies: options.commands.map((commandText, index) => ({
            lineNumber: index + 1,
            commandText,
            status: "ok",
            replyLines: ["OK"],
            redacted: false,
          })),
          linesSent: options.commands.length,
          payloadsSent: 0,
          bytesSent: 90,
        };
      },
      listenForOsc: (_host, _port, predicate) => ({
        ready: Promise.resolve(),
        message: tcpSent.then(() => {
          const message = {
            address: callbackAddress,
            typeTags: "f",
            args: [50],
            sourceAddress: "192.0.2.148",
          };
          expect(predicate(message)).toBe(true);
          return message;
        }),
      }),
    };

    const result = await verifyCommandWrite(
      {
        ...baseOptions,
        command: "Zoom 50",
        readbackPath: "Master.Zoom",
        expectedValue: 50,
        talkTransport: "tcp",
        talkTcpHost: "192.0.2.148",
        talkTcpPort: 16063,
      },
      transport,
    );

    expect(result.ok).toBe(true);
    expect(result.matched).toBe(true);
    expect(result.transport).toBe("tcp");
    expect(result.talkStatus).toBe("ok");
    expect(sentUdpPayloads).toEqual([]);
    expect(tcpSends).toHaveLength(1);
    expect(tcpSends[0]).toEqual(
      expect.objectContaining({
        host: "192.0.2.148",
        port: 16063,
        commands: ["Zoom 50", 'OscOutTTS "/pangolint/verify/req-verify", "f", Master.Zoom'],
      }),
    );
  });

  it("returns matched: true when readback equals expected value", async () => {
    const transport: ReadbackTransport = {
      sendTalk: async () => {},
      listenForOsc: () => ({
        ready: Promise.resolve(),
        message: Promise.resolve({ address: "/pangolint/verify/req-verify", typeTags: "f", args: [50] }),
      }),
    };

    const result = await verifyCommandWrite(
      { ...baseOptions, command: "Zoom 50", readbackPath: "Master.Zoom", expectedValue: 50 },
      transport,
    );

    expect(result.ok).toBe(true);
    expect(result.matched).toBe(true);
    expect(result.after).toBe(50);
    expect(result.expected).toBe(50);
  });

  it("returns matched: false when readback differs from expected value", async () => {
    const transport: ReadbackTransport = {
      sendTalk: async () => {},
      listenForOsc: () => ({
        ready: Promise.resolve(),
        message: Promise.resolve({ address: "/pangolint/verify/req-verify", typeTags: "f", args: [100] }),
      }),
    };

    const result = await verifyCommandWrite(
      { ...baseOptions, command: "Zoom 50", readbackPath: "Master.Zoom", expectedValue: 50 },
      transport,
    );

    expect(result.ok).toBe(true);
    expect(result.matched).toBe(false);
    expect(result.after).toBe(100);
  });

  it("sends restore command after readback and reports restored: true", async () => {
    const sentPayloads: string[] = [];
    const transport: ReadbackTransport = {
      sendTalk: async (_host, _port, payload) => {
        sentPayloads.push(payload.toString("ascii"));
      },
      listenForOsc: () => ({
        ready: Promise.resolve(),
        message: Promise.resolve({ address: "/pangolint/verify/req-verify", typeTags: "f", args: [50] }),
      }),
    };

    const result = await verifyCommandWrite(
      {
        ...baseOptions,
        command: "Zoom 50",
        readbackPath: "Master.Zoom",
        expectedValue: 50,
        restoreCommand: "Zoom 100",
      },
      transport,
    );

    expect(result.restored).toBe(true);
    expect(sentPayloads).toHaveLength(2);
    expect(sentPayloads[1]).toBe("Zoom 100\r\n");
  });

  it("reports restored: false if restore send throws", async () => {
    let callCount = 0;
    const transport: ReadbackTransport = {
      sendTalk: async () => {
        callCount += 1;
        if (callCount > 1) throw new Error("send failed");
      },
      listenForOsc: () => ({
        ready: Promise.resolve(),
        message: Promise.resolve({ address: "/pangolint/verify/req-verify", typeTags: "f", args: [50] }),
      }),
    };

    const result = await verifyCommandWrite(
      {
        ...baseOptions,
        command: "Zoom 50",
        readbackPath: "Master.Zoom",
        expectedValue: 50,
        restoreCommand: "Zoom 100",
      },
      transport,
    );

    expect(result.ok).toBe(true);
    expect(result.restored).toBe(false);
  });

  it("sends best-effort restore after the write packet when readback times out", async () => {
    const sentPayloads: string[] = [];
    const transport: ReadbackTransport = {
      sendTalk: async (_host, _port, payload) => {
        sentPayloads.push(payload.toString("ascii"));
      },
      listenForOsc: () => ({
        ready: Promise.resolve(),
        message: Promise.reject(new Error("Timed out waiting for OSC callback after 3000ms.")),
      }),
    };

    const result = await verifyCommandWrite(
      {
        ...baseOptions,
        command: "Zoom 50",
        readbackPath: "Master.Zoom",
        expectedValue: 50,
        restoreCommand: "Zoom 100",
      },
      transport,
    );

    expect(result.ok).toBe(false);
    expect(result.restored).toBe(true);
    expect(sentPayloads).toHaveLength(2);
    expect(sentPayloads[0]).toContain("Zoom 50");
    expect(sentPayloads[1]).toBe("Zoom 100\r\n");
  });

  it("keeps a timeout restore inside the OSC port lock before the next write starts", async () => {
    const events: string[] = [];
    const restoreFinished = deferred<void>();
    let listenCount = 0;
    const transport: ReadbackTransport = {
      sendTalk: async (_host, _port, payload) => {
        const text = payload.toString("ascii");
        if (text.includes("Zoom 50")) {
          events.push("first-write");
          return;
        }
        if (text === "Zoom 100\r\n") {
          events.push("restore-start");
          await restoreFinished.promise;
          events.push("restore-done");
          return;
        }
        if (text.includes("Brightness 10")) {
          events.push("second-write");
        }
      },
      listenForOsc: () => {
        listenCount += 1;
        if (listenCount === 1) {
          return {
            ready: Promise.resolve(),
            message: Promise.reject(new Error("Timed out waiting for OSC callback after 3000ms.")),
          };
        }
        return {
          ready: Promise.resolve(),
          message: Promise.resolve({ address: "/pangolint/verify/second", typeTags: "f", args: [10] }),
        };
      },
    };

    const first = verifyCommandWrite(
      {
        ...baseOptions,
        requestId: "first",
        command: "Zoom 50",
        readbackPath: "Master.Zoom",
        expectedValue: 50,
        restoreCommand: "Zoom 100",
      },
      transport,
    );
    await waitFor(() => events.includes("restore-start"));

    const second = verifyCommandWrite(
      {
        ...baseOptions,
        requestId: "second",
        command: "Brightness 10",
        readbackPath: "Master.Brightness",
        expectedValue: 10,
      },
      transport,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(events).not.toContain("second-write");

    restoreFinished.resolve();
    await Promise.all([first, second]);
    expect(events).toEqual(["first-write", "restore-start", "restore-done", "second-write"]);
  });

  it("does not send restore when listener readiness fails before the write packet", async () => {
    const sentPayloads: string[] = [];
    const transport: ReadbackTransport = {
      sendTalk: async (_host, _port, payload) => {
        sentPayloads.push(payload.toString("ascii"));
      },
      listenForOsc: () => ({
        ready: Promise.reject(new Error("bind failed")),
        message: Promise.reject(new Error("bind failed")),
      }),
    };

    const result = await verifyCommandWrite(
      {
        ...baseOptions,
        command: "Zoom 50",
        readbackPath: "Master.Zoom",
        expectedValue: 50,
        restoreCommand: "Zoom 100",
      },
      transport,
    );

    expect(result.ok).toBe(false);
    expect(result.restored).toBe(false);
    expect(sentPayloads).toEqual([]);
  });

  it("rejects multi-line write commands before binding OSC or sending Talk UDP", async () => {
    const sendTalk = vi.fn(async () => {});
    const listenForOsc = vi.fn(() => ({
      ready: Promise.resolve(),
      message: Promise.resolve({ address: "/pangolint/verify/req-verify", typeTags: "f", args: [50] }),
    }));

    const result = await verifyCommandWrite(
      {
        ...baseOptions,
        command: "Zoom 50\r\nDisableLaserOutput",
        readbackPath: "Master.Zoom",
        expectedValue: 50,
      },
      { sendTalk, listenForOsc },
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/single line/i);
    expect(sendTalk).not.toHaveBeenCalled();
    expect(listenForOsc).not.toHaveBeenCalled();
  });

  it("does not send Talk until OSC listener is ready", async () => {
    const events: string[] = [];
    let resolveReady!: () => void;
    const ready = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
    const transport: ReadbackTransport = {
      sendTalk: async () => {
        events.push("send");
      },
      listenForOsc: () => ({
        ready: ready.then(() => {
          events.push("ready");
        }),
        message: Promise.resolve({ address: "/pangolint/verify/req-verify", typeTags: "f", args: [50] }),
      }),
    };

    const resultPromise = verifyCommandWrite(
      { ...baseOptions, command: "Zoom 50", readbackPath: "Master.Zoom", expectedValue: 50 },
      transport,
    );

    await Promise.resolve();
    expect(events).toEqual([]);

    resolveReady();
    await resultPromise;
    expect(events).toEqual(["ready", "send"]);
  });

  it("returns error on transport failure", async () => {
    const transport: ReadbackTransport = {
      sendTalk: async () => {},
      listenForOsc: () => ({
        ready: Promise.reject(new Error("port in use")),
        message: Promise.reject(new Error("port in use")),
      }),
    };

    const result = await verifyCommandWrite(
      { ...baseOptions, command: "Zoom 50", readbackPath: "Master.Zoom", expectedValue: 50 },
      transport,
    );

    expect(result.ok).toBe(false);
    expect(result.matched).toBe(false);
    expect(result.restored).toBe(false);
    expect(result.error).toBe("port in use");
  });
});
