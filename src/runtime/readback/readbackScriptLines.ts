import type { ReadbackOptions } from "./readbackTypes";

export function propertyReadbackScriptLines(
  address: string,
  typeTag: "f" | "i" | "s",
  propertyPath: string,
  options: ReadbackOptions,
): string[] {
  if (usesStatusProducingReadbackLine(options)) {
    return [`OscOutTTS "${address}", "${typeTag}", ${propertyPath}`];
  }
  return ["var v", `v = ${propertyPath}`, `OscOutTTS "${address}", "${typeTag}", v`];
}

export function writeVerifyScriptLines(
  command: string,
  address: string,
  typeTag: "f" | "i" | "s",
  readbackPath: string,
  options: ReadbackOptions,
): string[] {
  if (usesStatusProducingReadbackLine(options)) {
    return [command, `OscOutTTS "${address}", "${typeTag}", ${readbackPath}`];
  }
  return [command, "var v", `v = ${readbackPath}`, `OscOutTTS "${address}", "${typeTag}", v`];
}

function usesStatusProducingReadbackLine(options: ReadbackOptions): boolean {
  const transport = options.talkTransport ?? "udp";
  return transport === "tcp" || transport === "auto";
}
