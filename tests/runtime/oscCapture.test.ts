import dgram from "node:dgram";
import { afterEach, describe, expect, it } from "vitest";

import { buildOscMessage } from "../../src/runtime/osc/osc";
import { startOscCapture } from "../../src/runtime/osc/oscCapture";

const sockets: dgram.Socket[] = [];

afterEach(() => {
  for (const socket of sockets.splice(0)) {
    try {
      socket.close();
    } catch {
      // The socket may already be closed by the test.
    }
  }
});

describe("startOscCapture", () => {
  it("captures exact address and prefix matches while ignoring unrelated OSC packets", async () => {
    const listenPort = await getFreeUdpPort();
    const capture = await startOscCapture({
      listenHost: "127.0.0.1",
      listenPort,
      timeoutMs: 1000,
      addresses: ["/pangolint/keep"],
      addressPrefix: "/pangolint/events/",
      expectedSourceHost: "127.0.0.1",
      maxMessages: 2,
    });
    await capture.ready;

    const sender = dgram.createSocket("udp4");
    sockets.push(sender);
    await sendOsc(sender, listenPort, "/pangolint/drop", "s", ["drop"]);
    await sendOsc(sender, listenPort, "/pangolint/events/zone", "s", ["prefix"]);
    await sendOsc(sender, listenPort, "/pangolint/keep", "i", [7]);

    const result = await capture.done;

    expect(result.ok).toBe(true);
    expect(result.timedOut).toBe(false);
    expect(result.messages.map((message) => message.address)).toEqual(["/pangolint/events/zone", "/pangolint/keep"]);
    expect(result.messages[0].args).toEqual(["prefix"]);
    expect(result.messages[1].args).toEqual([7]);
  });
});

async function getFreeUdpPort(): Promise<number> {
  const socket = dgram.createSocket("udp4");
  sockets.push(socket);
  await new Promise<void>((resolve) => {
    socket.bind(0, "127.0.0.1", resolve);
  });
  const address = socket.address();
  if (typeof address === "string") throw new Error(`unexpected UDP socket address: ${address}`);
  await new Promise<void>((resolve) => {
    socket.close(resolve);
  });
  sockets.splice(sockets.indexOf(socket), 1);
  return address.port;
}

async function sendOsc(
  socket: dgram.Socket,
  listenPort: number,
  address: string,
  typeTags: string,
  args: Parameters<typeof buildOscMessage>[2],
): Promise<void> {
  const payload = buildOscMessage(address, typeTags, args);
  await new Promise<void>((resolve, reject) => {
    socket.send(payload, listenPort, "127.0.0.1", (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
