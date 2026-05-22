import { describe, expect, it } from "vitest";
import { readBeyondProperty } from "../../../src/runtime/readback/beyondReadback";
import type { ReadbackTransport } from "../../../src/runtime/readback/readbackTypes";
import type { SendTalkTcpCommandsOptions } from "../../../src/runtime/talk/talkTcp";

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

  it("keeps OSC source filtering to configured hosts in auto fallback mode", async () => {
    let callbackAddress = "/pangolint/readback/unset";
    let sentTcp!: () => void;
    const tcpSent = new Promise<void>((resolve) => {
      sentTcp = resolve;
    });
    const transport: ReadbackTransport = {
      sendTalk: async () => {
        throw new Error("UDP fallback should not be used when TCP succeeds");
      },
      sendTalkTcp: async (options) => {
        callbackAddress = options.commands[0].match(/OscOutTTS "([^"]+)"/)?.[1] ?? callbackAddress;
        sentTcp();
        return {
          ok: true,
          transport: "tcp",
          talkStatus: "ok",
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
          const baseMessage = {
            address: callbackAddress,
            typeTags: "f",
            args: [100],
          };
          expect(predicate({ ...baseMessage, sourceAddress: "192.0.2.200" })).toBe(false);
          expect(predicate({ ...baseMessage, sourceAddress: "192.0.2.148" })).toBe(true);
          expect(predicate({ ...baseMessage, sourceAddress: "192.0.2.149" })).toBe(true);
          return { ...baseMessage, sourceAddress: "192.0.2.148" };
        }),
      }),
    };

    const result = await readBeyondProperty(
      {
        ...baseOptions,
        propertyPath: "Master.Brightness",
        talkTransport: "auto",
        talkTcpHost: "192.0.2.148",
        talkTcpPort: 16063,
        talkUdpHost: "192.0.2.149",
        talkUdpPort: 16062,
        talkUdpFallbackAllowed: true,
      },
      transport,
    );

    expect(result.ok).toBe(true);
    expect(result.value).toBe(100);
  });

  it("closes the OSC listener when a TCP readback send fails", async () => {
    let closeCount = 0;
    const transport: ReadbackTransport = {
      sendTalk: async () => {
        throw new Error("UDP should not be used");
      },
      sendTalkTcp: async () => ({
        ok: false,
        transport: "tcp",
        talkStatus: "closed",
        talkReplies: [],
        linesSent: 0,
        payloadsSent: 0,
        bytesSent: 0,
        error: "connect ECONNREFUSED",
      }),
      listenForOsc: () => ({
        ready: Promise.resolve(),
        message: new Promise(() => {}),
        close: () => {
          closeCount += 1;
        },
      }),
    };

    const result = await readBeyondProperty(
      {
        ...baseOptions,
        propertyPath: "Master.Brightness",
        talkTransport: "tcp",
        talkTcpHost: "127.0.0.1",
        talkTcpPort: 16063,
      },
      transport,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe("connect ECONNREFUSED");
    expect(result.transport).toBe("tcp");
    expect(closeCount).toBe(1);
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
