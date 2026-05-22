import type { OscArg, OscMessage } from "../osc/osc";
import { sourceMatchesExpectedHost } from "../osc/osc";
import type { ReadbackOptions } from "./readbackTypes";

interface ExpectedOscCallback {
  address: string;
  typeTags: "f" | "i" | "s";
  expectedSourceHosts: readonly string[];
  expectedArgs?: readonly OscArg[];
}

export function expectedReadbackOscSourceHosts(options: ReadbackOptions): string[] {
  const transport = options.talkTransport ?? "udp";
  if (transport === "tcp") {
    return [options.talkTcpHost ?? options.talkHost];
  }
  if (transport === "auto") {
    const tcpHost = options.talkTcpHost ?? options.talkHost;
    const udpHost = options.talkUdpHost ?? options.talkHost;
    return options.talkUdpFallbackAllowed ? uniqueDefinedHosts([tcpHost, udpHost]) : [tcpHost];
  }
  return [options.talkUdpHost ?? options.talkHost];
}

export function isExpectedOscCallback(message: OscMessage, expected: ExpectedOscCallback): boolean {
  if (message.address !== expected.address) return false;
  if (message.typeTags !== expected.typeTags) return false;
  if (!sourceMatchesAnyExpectedHost(message, expected.expectedSourceHosts)) return false;

  if (expected.expectedArgs) {
    if (message.args.length !== expected.expectedArgs.length) return false;
    return expected.expectedArgs.every((arg, index) => message.args[index] === arg);
  }

  if (message.args.length !== expected.typeTags.length) return false;
  return expected.typeTags.split("").every((tag, index) => argMatchesTypeTag(message.args[index], tag));
}

export function assertExpectedOscCallback(message: OscMessage, expected: ExpectedOscCallback): void {
  if (!isExpectedOscCallback(message, expected)) {
    throw new Error(`Unexpected OSC callback for ${expected.address}.`);
  }
}

function uniqueDefinedHosts(hosts: readonly string[]): string[] {
  return [...new Set(hosts.filter((host) => host.trim().length > 0))];
}

function sourceMatchesAnyExpectedHost(message: OscMessage, expectedHosts: readonly string[]): boolean {
  return expectedHosts.length === 0 || expectedHosts.some((host) => sourceMatchesExpectedHost(message, host));
}

function argMatchesTypeTag(arg: OscArg | undefined, tag: string): boolean {
  if (tag === "s") return typeof arg === "string";
  if (tag === "i") return typeof arg === "number" && Number.isInteger(arg);
  if (tag === "f") return typeof arg === "number" && Number.isFinite(arg);
  return false;
}
