import {
  type RunScriptWithOscCaptureResult,
  runScriptWithOscCapture,
} from "../../src/runtime/commandBatch/runScriptWithOscCapture";
import { checkBeyondConnection, readBeyondProperty } from "../../src/runtime/readback/beyondReadback";
import type {
  ConnectionCheckResult,
  PropertyReadbackOptions,
  PropertyReadbackResult,
  ReadbackOptions,
} from "../../src/runtime/readback/readbackTypes";
import {
  type SendTalkTcpCommandsOptions,
  type SendTalkTcpCommandsResult,
  sendTalkTcpCommands,
} from "../../src/runtime/talk/talkTcp";

export type LiveBeyondSmokeMode = "all" | "connection" | "readback" | "udp";
export type LiveBeyondReadbackTypeTag = "f" | "i" | "s";

export interface LiveBeyondSmokeArgs {
  help: boolean;
  mode: LiveBeyondSmokeMode;
}

export interface LiveBeyondSmokeConfig {
  mode: LiveBeyondSmokeMode;
  talkTcpHost: string;
  talkTcpPort: number;
  talkUdpHost: string;
  talkUdpPort: number;
  talkTcpPassword: string;
  listenHost: string;
  listenPort: number;
  timeoutMs: number;
  propertyPath: string;
  propertyTypeTag: LiveBeyondReadbackTypeTag;
}

export interface RedactedLiveBeyondSmokeConfig extends Omit<LiveBeyondSmokeConfig, "talkTcpPassword"> {
  talkTcpPasswordConfigured: boolean;
}

export interface LiveBeyondSmokeStep {
  name: string;
  ok: boolean;
  detail: string;
  durationMs: number;
  error?: string;
}

export interface LiveBeyondSmokeResult {
  ok: boolean;
  steps: LiveBeyondSmokeStep[];
  config: RedactedLiveBeyondSmokeConfig;
}

export interface LiveBeyondSmokeRuntime {
  sendTalkTcpCommands(options: SendTalkTcpCommandsOptions): Promise<SendTalkTcpCommandsResult>;
  checkBeyondConnection(options: ReadbackOptions): Promise<ConnectionCheckResult>;
  readBeyondProperty(options: PropertyReadbackOptions): Promise<PropertyReadbackResult>;
  runScriptWithOscCapture(
    text: string,
    options: Parameters<typeof runScriptWithOscCapture>[1],
  ): Promise<RunScriptWithOscCaptureResult>;
}

const DEFAULT_MODE: LiveBeyondSmokeMode = "all";
const DEFAULT_TALK_HOST = "127.0.0.1";
const DEFAULT_TALK_TCP_PORT = 16063;
const DEFAULT_TALK_UDP_PORT = 16062;
const DEFAULT_LISTEN_HOST = "0.0.0.0";
const DEFAULT_LISTEN_PORT = 7000;
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_PROPERTY_PATH = "Master.Brightness";
const DEFAULT_PROPERTY_TYPE_TAG: LiveBeyondReadbackTypeTag = "f";

const SMOKE_MODES: readonly LiveBeyondSmokeMode[] = ["all", "connection", "readback", "udp"];
const READBACK_TYPE_TAGS: readonly LiveBeyondReadbackTypeTag[] = ["f", "i", "s"];

const defaultRuntime: LiveBeyondSmokeRuntime = {
  sendTalkTcpCommands,
  checkBeyondConnection,
  readBeyondProperty,
  runScriptWithOscCapture,
};

export function usage(): string {
  return [
    "Usage:",
    "  npm run smoke:live-beyond -- [--mode all|connection|readback|udp]",
    "",
    "Environment:",
    "  PANGOLINT_LIVE_BEYOND_HOST",
    "  PANGOLINT_LIVE_BEYOND_TALK_TCP_HOST",
    "  PANGOLINT_LIVE_BEYOND_TALK_TCP_PORT",
    "  PANGOLINT_LIVE_BEYOND_TALK_UDP_HOST",
    "  PANGOLINT_LIVE_BEYOND_TALK_UDP_PORT",
    "  PANGOLINT_LIVE_BEYOND_TCP_PASSWORD",
    "  PANGOLINT_LIVE_BEYOND_OSC_LISTEN_HOST",
    "  PANGOLINT_LIVE_BEYOND_OSC_LISTEN_PORT",
    "  PANGOLINT_LIVE_BEYOND_READBACK_TIMEOUT_MS",
    "  PANGOLINT_LIVE_BEYOND_READBACK_PATH",
    "  PANGOLINT_LIVE_BEYOND_READBACK_TYPE",
  ].join("\n");
}

export function parseLiveBeyondSmokeArgs(argv: readonly string[]): LiveBeyondSmokeArgs {
  const args: LiveBeyondSmokeArgs = {
    help: false,
    mode: DEFAULT_MODE,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }
    if (arg === "--mode") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("Missing value for --mode.");
      }
      args.mode = parseSmokeMode(value);
      index += 1;
      continue;
    }
    if (arg.startsWith("--mode=")) {
      args.mode = parseSmokeMode(arg.slice("--mode=".length));
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

export function liveBeyondSmokeConfigFromEnv(
  env: Record<string, string | undefined>,
  args: LiveBeyondSmokeArgs = { help: false, mode: DEFAULT_MODE },
): LiveBeyondSmokeConfig {
  const talkTcpHost = readEnvText(env, "PANGOLINT_LIVE_BEYOND_TALK_TCP_HOST", DEFAULT_TALK_HOST);
  const sharedTalkHost = readEnvText(env, "PANGOLINT_LIVE_BEYOND_HOST", talkTcpHost);
  return {
    mode: args.mode,
    talkTcpHost: readEnvText(env, "PANGOLINT_LIVE_BEYOND_TALK_TCP_HOST", sharedTalkHost),
    talkTcpPort: readEnvNumber(env, "PANGOLINT_LIVE_BEYOND_TALK_TCP_PORT", DEFAULT_TALK_TCP_PORT),
    talkUdpHost: readEnvText(env, "PANGOLINT_LIVE_BEYOND_TALK_UDP_HOST", sharedTalkHost),
    talkUdpPort: readEnvNumber(env, "PANGOLINT_LIVE_BEYOND_TALK_UDP_PORT", DEFAULT_TALK_UDP_PORT),
    talkTcpPassword: readEnvText(env, "PANGOLINT_LIVE_BEYOND_TCP_PASSWORD", ""),
    listenHost: readEnvText(env, "PANGOLINT_LIVE_BEYOND_OSC_LISTEN_HOST", DEFAULT_LISTEN_HOST),
    listenPort: readEnvNumber(env, "PANGOLINT_LIVE_BEYOND_OSC_LISTEN_PORT", DEFAULT_LISTEN_PORT),
    timeoutMs: readEnvNumber(env, "PANGOLINT_LIVE_BEYOND_READBACK_TIMEOUT_MS", DEFAULT_TIMEOUT_MS),
    propertyPath: readEnvText(env, "PANGOLINT_LIVE_BEYOND_READBACK_PATH", DEFAULT_PROPERTY_PATH),
    propertyTypeTag: parseReadbackTypeTag(
      readEnvText(env, "PANGOLINT_LIVE_BEYOND_READBACK_TYPE", DEFAULT_PROPERTY_TYPE_TAG),
    ),
  };
}

export function redactedLiveBeyondSmokeConfig(config: LiveBeyondSmokeConfig): RedactedLiveBeyondSmokeConfig {
  const { talkTcpPassword, ...rest } = config;
  return {
    ...rest,
    talkTcpPasswordConfigured: talkTcpPassword.length > 0,
  };
}

export async function runLiveBeyondSmokeChecks(
  config: LiveBeyondSmokeConfig,
  runtime: LiveBeyondSmokeRuntime = defaultRuntime,
  log: (line: string) => void = console.log,
): Promise<LiveBeyondSmokeResult> {
  const redactedConfig = redactedLiveBeyondSmokeConfig(config);
  log(`[live-beyond-smoke] mode=${config.mode}`);
  log(`[live-beyond-smoke] Talk TCP ${config.talkTcpHost}:${config.talkTcpPort}`);
  log(`[live-beyond-smoke] Talk UDP ${config.talkUdpHost}:${config.talkUdpPort}`);
  log(`[live-beyond-smoke] OSC listener ${config.listenHost}:${config.listenPort}`);
  log(`[live-beyond-smoke] readback path ${config.propertyPath}`);

  const steps: LiveBeyondSmokeStep[] = [];
  if (config.mode === "all" || config.mode === "connection" || config.mode === "readback") {
    steps.push(await runStep("Talk TCP Hello and Version", () => runTalkTcpCheck(config, runtime), log));
    steps.push(await runStep("OSC callback ping over Talk TCP", () => runOscPingCheck(config, runtime), log));
  }
  if (config.mode === "all" || config.mode === "readback") {
    steps.push(await runStep("Property readback over Talk TCP", () => runPropertyReadbackCheck(config, runtime), log));
  }
  if (config.mode === "all" || config.mode === "udp") {
    steps.push(await runStep("Talk UDP callback smoke", () => runTalkUdpCallbackCheck(config, runtime), log));
  }

  const ok = steps.every((step) => step.ok);
  log(`[live-beyond-smoke] ${ok ? "passed" : "failed"} ${steps.filter((step) => step.ok).length}/${steps.length}`);
  return { ok, steps, config: redactedConfig };
}

function readEnvText(env: Record<string, string | undefined>, key: string, fallback: string): string {
  const value = env[key]?.trim();
  return value ? value : fallback;
}

function readEnvNumber(env: Record<string, string | undefined>, key: string, fallback: number): number {
  const raw = env[key]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer.`);
  }
  return parsed;
}

function parseSmokeMode(value: string): LiveBeyondSmokeMode {
  if (SMOKE_MODES.includes(value as LiveBeyondSmokeMode)) {
    return value as LiveBeyondSmokeMode;
  }
  throw new Error(`Unsupported smoke mode: ${value}`);
}

function parseReadbackTypeTag(value: string): LiveBeyondReadbackTypeTag {
  if (READBACK_TYPE_TAGS.includes(value as LiveBeyondReadbackTypeTag)) {
    return value as LiveBeyondReadbackTypeTag;
  }
  throw new Error(`PANGOLINT_LIVE_BEYOND_READBACK_TYPE must be one of: ${READBACK_TYPE_TAGS.join(", ")}`);
}

async function runStep(
  name: string,
  run: () => Promise<Omit<LiveBeyondSmokeStep, "name" | "durationMs">>,
  log: (line: string) => void,
): Promise<LiveBeyondSmokeStep> {
  const startedAt = Date.now();
  try {
    const result = await run();
    const step = { ...result, name, durationMs: Date.now() - startedAt };
    log(formatStep(step));
    return step;
  } catch (error) {
    const step = {
      name,
      ok: false,
      detail: "Unexpected live smoke failure.",
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
    log(formatStep(step));
    return step;
  }
}

function formatStep(step: LiveBeyondSmokeStep): string {
  const status = step.ok ? "PASS" : "FAIL";
  const error = step.error ? ` error=${step.error}` : "";
  return `[live-beyond-smoke] ${status} ${step.name} (${step.durationMs} ms): ${step.detail}${error}`;
}

async function runTalkTcpCheck(
  config: LiveBeyondSmokeConfig,
  runtime: LiveBeyondSmokeRuntime,
): Promise<Omit<LiveBeyondSmokeStep, "name" | "durationMs">> {
  const result = await runtime.sendTalkTcpCommands({
    host: config.talkTcpHost,
    port: config.talkTcpPort,
    commands: ["Hello", "Version"],
    password: config.talkTcpPassword,
    timeoutMs: config.timeoutMs,
  });
  return {
    ok: result.ok,
    detail: `status=${result.talkStatus}; greeting=${result.talkGreeting ?? "none"}; replies=${result.talkReplies.length}`,
    error: talkResultError(result),
  };
}

async function runOscPingCheck(
  config: LiveBeyondSmokeConfig,
  runtime: LiveBeyondSmokeRuntime,
): Promise<Omit<LiveBeyondSmokeStep, "name" | "durationMs">> {
  const result = await runtime.checkBeyondConnection(readbackOptions(config));
  return {
    ok: result.ok,
    detail: `transport=${result.transport ?? "unknown"}; talkStatus=${result.talkStatus ?? "unknown"}; requestId=${result.requestId}`,
    error: result.error ?? result.beyondError?.message,
  };
}

async function runPropertyReadbackCheck(
  config: LiveBeyondSmokeConfig,
  runtime: LiveBeyondSmokeRuntime,
): Promise<Omit<LiveBeyondSmokeStep, "name" | "durationMs">> {
  const result = await runtime.readBeyondProperty({
    ...readbackOptions(config),
    propertyPath: config.propertyPath,
    typeTag: config.propertyTypeTag,
  });
  return {
    ok: result.ok,
    detail: `path=${result.propertyPath}; value=${result.value ?? "none"}; requestId=${result.requestId}`,
    error: result.error ?? result.beyondError?.message,
  };
}

async function runTalkUdpCallbackCheck(
  config: LiveBeyondSmokeConfig,
  runtime: LiveBeyondSmokeRuntime,
): Promise<Omit<LiveBeyondSmokeStep, "name" | "durationMs">> {
  const requestId = createSmokeRequestId();
  const address = `/pangolint/live-smoke/udp/${requestId}`;
  const command = `OscOutTTS "${address}", "s", "${requestId}"`;
  const result = await runtime.runScriptWithOscCapture(command, {
    talkHost: config.talkUdpHost,
    talkPort: config.talkUdpPort,
    talkTransport: "udp",
    talkTcpHost: config.talkTcpHost,
    talkTcpPort: config.talkTcpPort,
    talkUdpHost: config.talkUdpHost,
    talkUdpPort: config.talkUdpPort,
    commandTimeoutMs: config.timeoutMs,
    listenHost: config.listenHost,
    listenPort: config.listenPort,
    timeoutMs: config.timeoutMs,
    capturePrefix: "/pangolint/live-smoke/",
    maxCallbackMessages: 1,
  });
  const callbackCount = result.callbacks?.messages.length ?? 0;
  const callbackOk = result.callbacks?.ok === true && callbackCount > 0;
  return {
    ok: result.ok && callbackOk,
    detail: `talkStatus=${result.talkStatus ?? "unknown"}; payloads=${result.payloadsSent}; callbacks=${callbackCount}; requestId=${requestId}`,
    error: result.error ?? result.callbacks?.error ?? (callbackOk ? undefined : "OSC callback was not received."),
  };
}

function readbackOptions(config: LiveBeyondSmokeConfig): ReadbackOptions {
  return {
    talkHost: config.talkTcpHost,
    talkPort: config.talkTcpPort,
    talkTransport: "tcp",
    talkTcpHost: config.talkTcpHost,
    talkTcpPort: config.talkTcpPort,
    talkUdpHost: config.talkUdpHost,
    talkUdpPort: config.talkUdpPort,
    talkUdpFallbackAllowed: false,
    talkTcpPassword: config.talkTcpPassword,
    commandTimeoutMs: config.timeoutMs,
    listenHost: config.listenHost,
    listenPort: config.listenPort,
    timeoutMs: config.timeoutMs,
  };
}

function talkResultError(result: SendTalkTcpCommandsResult): string | undefined {
  return result.error ?? result.beyondError?.message;
}

function createSmokeRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`;
}
