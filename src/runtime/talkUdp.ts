import dgram from "node:dgram";

export interface TalkPayloadOptions {
  maxPayloadBytes?: number;
}

export function buildTalkPayloads(commands: string[], options: TalkPayloadOptions = {}): Buffer[] {
  const maxPayloadBytes = Math.max(1, options.maxPayloadBytes ?? 1200);
  const payloads: Buffer[] = [];
  let current = Buffer.alloc(0);

  commands.forEach((command, index) => {
    const line = normalizeTalkLine(command, index + 1);
    assertAscii(line, index + 1);
    const encoded = Buffer.from(line, "ascii");

    if (encoded.length > maxPayloadBytes) {
      throw new Error(
        `Talk command line ${index + 1} exceeds max payload bytes (${encoded.length} > ${maxPayloadBytes}).`,
      );
    }

    if (current.length > 0 && current.length + encoded.length > maxPayloadBytes) {
      payloads.push(current);
      current = Buffer.alloc(0);
    }
    current = Buffer.concat([current, encoded]);
  });

  if (current.length > 0) {
    payloads.push(current);
  }

  return payloads;
}

export async function sendTalkUdp(host: string, port: number, payload: Buffer): Promise<void> {
  const socket = dgram.createSocket("udp4");
  let settled = false;
  try {
    await new Promise<void>((resolve, reject) => {
      const settle = (fn: () => void): void => {
        if (settled) {
          return;
        }
        settled = true;
        fn();
      };

      socket.on("error", (error) => {
        const wrapped = error instanceof Error ? error : new Error(String(error));
        settle(() => reject(wrapped));
      });

      socket.send(payload, Number(port), host, (error) => {
        if (error) {
          settle(() => reject(error));
        } else {
          settle(() => resolve());
        }
      });
    });
  } finally {
    try {
      socket.close();
    } catch {
      // Socket may already be closed if an error event closed it.
    }
  }
}

function normalizeTalkLine(command: string, lineNumber: number): string {
  const trimmed = command.replace(/\r?\n$/, "");
  if (/[\r\n]/.test(trimmed)) {
    throw new Error(`Talk command line ${lineNumber} must be a single line.`);
  }
  return `${trimmed}\r\n`;
}

function assertAscii(value: string, lineNumber: number): void {
  for (const char of value) {
    if (char.charCodeAt(0) > 0x7f) {
      throw new Error(`Talk command line ${lineNumber} contains non-ASCII characters.`);
    }
  }
}
