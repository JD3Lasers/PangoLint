import net from "node:net";

export type OscArg = string | number | boolean | null;

export interface OscMessage {
  address: string;
  typeTags: string;
  args: OscArg[];
  sourceAddress?: string;
  sourcePort?: number;
}

export class OscDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OscDecodeError";
  }
}

export class OscEncodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OscEncodeError";
  }
}

export function buildOscMessage(address: string, typeTags: string, args: OscArg[]): Buffer {
  const normalizedAddress = normalizeAddress(address);
  validateAddress(normalizedAddress);
  const tags = typeTags.startsWith(",") ? typeTags.slice(1) : typeTags;

  if (tags.length !== args.length) {
    throw new OscEncodeError("OSC type tag length must match args length.");
  }

  const chunks: Buffer[] = [paddedString(normalizedAddress), paddedString(`,${tags}`)];
  tags.split("").forEach((tag, index) => {
    const arg = args[index];
    if (tag === "s") {
      if (typeof arg !== "string") {
        throw new OscEncodeError(`OSC arg ${index} for tag 's' must be a string.`);
      }
      chunks.push(paddedString(arg));
    } else if (tag === "i") {
      chunks.push(encodeInt32(arg, index));
    } else if (tag === "f") {
      chunks.push(encodeFloat32(arg, index));
    } else if (tag === "r") {
      chunks.push(encodeUInt32(arg, index));
    } else if (tag === "T" || tag === "F" || tag === "N") {
      // Argument-less tags carry no payload.
    } else {
      throw new OscEncodeError(`Unsupported OSC type tag: ${tag}`);
    }
  });

  return Buffer.concat(chunks);
}

function encodeInt32(arg: OscArg, index: number): Buffer {
  if (typeof arg !== "number" || !Number.isFinite(arg) || !Number.isInteger(arg)) {
    throw new OscEncodeError(`OSC arg ${index} for tag 'i' must be a finite integer.`);
  }
  const value = Buffer.alloc(4);
  value.writeInt32BE(arg, 0);
  return value;
}

function encodeFloat32(arg: OscArg, index: number): Buffer {
  if (typeof arg !== "number" || !Number.isFinite(arg)) {
    throw new OscEncodeError(`OSC arg ${index} for tag 'f' must be a finite number.`);
  }
  const value = Buffer.alloc(4);
  value.writeFloatBE(arg, 0);
  return value;
}

function encodeUInt32(arg: OscArg, index: number): Buffer {
  if (typeof arg !== "number" || !Number.isFinite(arg) || !Number.isInteger(arg) || arg < 0) {
    throw new OscEncodeError(`OSC arg ${index} for tag 'r' must be a non-negative integer.`);
  }
  const value = Buffer.alloc(4);
  value.writeUInt32BE(arg, 0);
  return value;
}

function validateAddress(address: string): void {
  if (!address.startsWith("/")) {
    throw new OscEncodeError("OSC address must start with '/'.");
  }
  if (address.includes("\0")) {
    throw new OscEncodeError("OSC address must not contain null bytes.");
  }
  for (let i = 0; i < address.length; i++) {
    const code = address.charCodeAt(i);
    if (code < 0x20 || code > 0x7e) {
      throw new OscEncodeError("OSC address must contain only printable ASCII characters.");
    }
  }
}

export function decodeOscPacket(payload: Buffer): OscMessage {
  if (payload.length === 0 || payload[0] !== 0x2f) {
    throw new OscDecodeError("invalid OSC address");
  }

  let offset = 0;
  const addressRead = readPaddedString(payload, offset);
  const address = addressRead.value;
  offset = addressRead.nextOffset;
  if (!address.startsWith("/")) {
    throw new OscDecodeError("invalid OSC address");
  }

  const tagsRead = readPaddedString(payload, offset);
  const tagString = tagsRead.value;
  offset = tagsRead.nextOffset;
  if (!tagString.startsWith(",")) {
    throw new OscDecodeError("missing type tag string");
  }

  const typeTags = tagString.slice(1);
  const args: OscMessage["args"] = [];
  for (const tag of typeTags) {
    if (tag === "s") {
      const read = readPaddedString(payload, offset);
      args.push(read.value);
      offset = read.nextOffset;
    } else if (tag === "i") {
      requireBytes(payload, offset, 4, "int32 truncated");
      args.push(payload.readInt32BE(offset));
      offset += 4;
    } else if (tag === "f") {
      requireBytes(payload, offset, 4, "float32 truncated");
      args.push(payload.readFloatBE(offset));
      offset += 4;
    } else if (tag === "r") {
      requireBytes(payload, offset, 4, "uint32 truncated");
      args.push(payload.readUInt32BE(offset));
      offset += 4;
    } else if (tag === "T" || tag === "F") {
      args.push(tag === "T");
    } else if (tag === "N") {
      args.push(null);
    } else {
      throw new OscDecodeError(`unsupported OSC type tag: ${tag}`);
    }
  }

  return { address, typeTags, args };
}

export function sourceMatchesExpectedHost(message: OscMessage, expectedHost: string | undefined): boolean {
  const expectedAddress = normalizeIpLiteral(expectedHost);
  if (!expectedAddress || !message.sourceAddress) {
    return true;
  }
  return normalizeIpLiteral(message.sourceAddress) === expectedAddress;
}

function normalizeAddress(address: string): string {
  const trimmed = address.trim() || "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function normalizeIpLiteral(host: string | undefined): string | undefined {
  const value = host?.trim();
  if (!value) return undefined;
  const withoutBrackets = value.startsWith("[") && value.endsWith("]") ? value.slice(1, -1) : value;
  const withoutIpv4MappedPrefix = withoutBrackets.toLowerCase().startsWith("::ffff:")
    ? withoutBrackets.slice("::ffff:".length)
    : withoutBrackets;
  if (net.isIP(withoutIpv4MappedPrefix) === 4) return withoutIpv4MappedPrefix;
  if (net.isIP(withoutBrackets) === 6) return withoutBrackets.toLowerCase();
  return undefined;
}

function paddedString(value: string): Buffer {
  const raw = Buffer.from(`${value}\0`, "utf8");
  const padding = (4 - (raw.length % 4)) % 4;
  return Buffer.concat([raw, Buffer.alloc(padding)]);
}

function readPaddedString(payload: Buffer, offset: number): { value: string; nextOffset: number } {
  const end = payload.indexOf(0, offset);
  if (end < 0) {
    throw new OscDecodeError("unterminated OSC string");
  }
  const raw = payload.subarray(offset, end);
  const value = raw.toString("utf8");
  const afterNul = end + 1;
  const nextOffset = afterNul + ((4 - (afterNul % 4)) % 4);
  if (nextOffset > payload.length) {
    throw new OscDecodeError("string padding truncated");
  }
  return { value, nextOffset };
}

function requireBytes(payload: Buffer, offset: number, length: number, message: string): void {
  if (offset + length > payload.length) {
    throw new OscDecodeError(message);
  }
}
