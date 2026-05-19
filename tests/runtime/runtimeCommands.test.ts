import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as vscode from "vscode";

const {
  commandHandlers,
  createOutputChannelMock,
  outputChannelMock,
  registerCommandMock,
  runScriptWithOscCaptureMock,
  showErrorMessageMock,
  showInformationMessageMock,
  showWarningMessageMock,
  vscodeState,
} = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const output = {
    appendLine: vi.fn(),
    clear: vi.fn(),
    dispose: vi.fn(),
    show: vi.fn(),
  };
  return {
    commandHandlers: handlers,
    createOutputChannelMock: vi.fn(() => output),
    outputChannelMock: output,
    registerCommandMock: vi.fn((command: string, callback: (...args: unknown[]) => unknown) => {
      handlers.set(command, callback);
      return { dispose: vi.fn() };
    }),
    runScriptWithOscCaptureMock: vi.fn(),
    showErrorMessageMock: vi.fn(),
    showInformationMessageMock: vi.fn(),
    showWarningMessageMock: vi.fn(),
    vscodeState: {
      activeTextEditor: undefined as unknown,
      config: new Map<string, unknown>(),
      isTrusted: true,
    },
  };
});

vi.mock("vscode", () => ({
  StatusBarAlignment: { Right: 2 },
  commands: {
    registerCommand: registerCommandMock,
  },
  ProgressLocation: { Notification: 15 },
  workspace: {
    get isTrusted() {
      return vscodeState.isTrusted;
    },
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key: string, fallback: unknown) =>
        vscodeState.config.has(key) ? vscodeState.config.get(key) : fallback,
      ),
    })),
  },
  window: {
    get activeTextEditor() {
      return vscodeState.activeTextEditor;
    },
    createOutputChannel: createOutputChannelMock,
    createStatusBarItem: vi.fn(() => ({ show: vi.fn(), dispose: vi.fn() })),
    setStatusBarMessage: vi.fn(),
    showErrorMessage: showErrorMessageMock,
    showInformationMessage: showInformationMessageMock,
    showWarningMessage: showWarningMessageMock,
    withProgress: vi.fn((_options, task: () => unknown) => task()),
  },
}));

vi.mock("../../src/runtime/beyondReadback", () => ({
  checkBeyondConnection: vi.fn(),
  readBeyondProperty: vi.fn(),
  verifyCommandWrite: vi.fn(),
}));

vi.mock("../../src/runtime/runScriptWithOscCapture", () => ({
  runScriptWithOscCapture: runScriptWithOscCaptureMock,
}));

import { readBeyondProperty } from "../../src/runtime/beyondReadback";
import { registerBeyondRuntimeCommands } from "../../src/runtime/runtimeCommands";

describe("registerBeyondRuntimeCommands", () => {
  beforeEach(() => {
    commandHandlers.clear();
    outputChannelMock.appendLine.mockClear();
    outputChannelMock.show.mockClear();
    createOutputChannelMock.mockClear();
    registerCommandMock.mockClear();
    runScriptWithOscCaptureMock.mockReset();
    showErrorMessageMock.mockReset();
    showInformationMessageMock.mockReset();
    showWarningMessageMock.mockReset();
    showWarningMessageMock.mockResolvedValue("Run");
    vscodeState.config = new Map<string, unknown>([
      ["allowScriptExecution", true],
      ["confirmRunEachSession", true],
      ["talkTransport", "auto"],
      ["talkHost", "127.0.0.1"],
      ["talkPort", 16062],
      ["talkTcpHost", "127.0.0.1"],
      ["talkTcpPort", 16063],
      ["talkUdpHost", "127.0.0.1"],
      ["talkUdpPort", 16062],
      ["talkUdpFallbackAllowed", false],
      ["talkTcpPassword", ""],
      ["oscListenHost", "0.0.0.0"],
      ["oscListenPort", 7000],
      ["readbackTimeoutMs", 3000],
    ]);
    vscodeState.isTrusted = true;
    vscodeState.activeTextEditor = {
      document: {
        languageId: "pangoscript",
        getText: vi.fn(() => "Brightness 50"),
      },
      selection: { isEmpty: true },
    };
  });

  it("registers all BEYOND runtime command handlers with a shared output channel", () => {
    const context = { subscriptions: [] } as unknown as vscode.ExtensionContext;

    registerBeyondRuntimeCommands(context);

    expect(createOutputChannelMock).toHaveBeenCalledWith("PangoLint: Run");
    expect(registerCommandMock.mock.calls.map((call) => call[0])).toEqual([
      "pangolint.checkBeyondConnection",
      "pangolint.runScript",
      "pangolint.runSelection",
      "pangolint.fetchObjectValue",
      "pangolint.setObjectValue",
      "pangolint.replayLastScript",
      "pangolint.validateObjectsAgainstBeyond",
    ]);
    expect(context.subscriptions).toHaveLength(8);
  });

  it("blocks Talk sends when the lint gate returns an error diagnostic", async () => {
    const context = { subscriptions: [] } as unknown as vscode.ExtensionContext;
    registerBeyondRuntimeCommands(context, {
      validatedRootsCache: new Map(),
      getPropertyIndex: vi.fn(),
      onValidatedRootsChanged: vi.fn(),
      lintScriptText: () => [
        {
          line: 0,
          start: 0,
          length: 1,
          severity: "error",
          code: "unclosed-string",
          message: "Unclosed string",
        },
      ],
    });

    await commandHandlers.get("pangolint.runScript")?.();

    expect(runScriptWithOscCaptureMock).not.toHaveBeenCalled();
    expect(showWarningMessageMock).not.toHaveBeenCalledWith(
      expect.stringContaining("Send 1 executable line"),
      {
        modal: true,
      },
      "Run",
    );
    expect(showErrorMessageMock).toHaveBeenCalledWith(expect.stringContaining("Lint gate refused send"));
    expect(outputChannelMock.appendLine).toHaveBeenCalledWith(expect.stringContaining("lint gate refused"));
  });

  it("sends Talk batches after a clean lint gate and explicit confirmation", async () => {
    runScriptWithOscCaptureMock.mockResolvedValue({
      ok: true,
      linesSent: 1,
      payloadsSent: 1,
      bytesSent: 15,
      callbackAddresses: [],
    });
    const context = { subscriptions: [] } as unknown as vscode.ExtensionContext;
    registerBeyondRuntimeCommands(context, {
      validatedRootsCache: new Map(),
      getPropertyIndex: vi.fn(),
      onValidatedRootsChanged: vi.fn(),
      lintScriptText: () => [],
    });

    await commandHandlers.get("pangolint.runScript")?.();

    expect(showWarningMessageMock).toHaveBeenCalledWith(
      expect.stringContaining("Send 1 executable line"),
      {
        modal: true,
      },
      "Run",
    );
    expect(runScriptWithOscCaptureMock).toHaveBeenCalledWith("Brightness 50", {
      talkTransport: "auto",
      talkHost: "127.0.0.1",
      talkPort: 16062,
      talkTcpHost: "127.0.0.1",
      talkTcpPort: 16063,
      talkUdpHost: "127.0.0.1",
      talkUdpPort: 16062,
      talkUdpFallbackAllowed: false,
      talkTcpPassword: "",
      listenHost: "0.0.0.0",
      listenPort: 7000,
      timeoutMs: 3000,
    });
  });

  it("prints Talk TCP replies in the run output channel", async () => {
    runScriptWithOscCaptureMock.mockResolvedValue({
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
      callbackAddresses: [],
    });
    vscodeState.config.set("talkTransport", "tcp");
    vscodeState.activeTextEditor = {
      document: {
        languageId: "pangoscript",
        getText: vi.fn(() => "Hello"),
      },
      selection: { isEmpty: true },
    };
    const context = { subscriptions: [] } as unknown as vscode.ExtensionContext;
    registerBeyondRuntimeCommands(context, {
      validatedRootsCache: new Map(),
      getPropertyIndex: vi.fn(),
      onValidatedRootsChanged: vi.fn(),
      lintScriptText: () => [],
    });

    await commandHandlers.get("pangolint.runScript")?.();

    expect(outputChannelMock.appendLine).toHaveBeenCalledWith(expect.stringContaining("Talk TCP -> 127.0.0.1:16063"));
    expect(outputChannelMock.appendLine).toHaveBeenCalledWith(
      expect.stringContaining("greeting <- Welcome to BEYOND!"),
    );
    expect(outputChannelMock.appendLine).toHaveBeenCalledWith(expect.stringContaining("line 1 ok <- Hello! / OK"));
    expect(outputChannelMock.appendLine).toHaveBeenCalledWith(
      expect.stringContaining("ok - 1 line sent over Talk TCP"),
    );
  });

  it("passes configured Talk TCP settings to live value fetches", async () => {
    vi.mocked(readBeyondProperty).mockResolvedValue({
      ok: true,
      requestId: "req-fetch",
      propertyPath: "Master.Brightness",
      script: "",
      value: 100,
    });
    vscodeState.config.set("talkTransport", "tcp");
    vscodeState.config.set("talkTcpHost", "192.0.2.148");
    vscodeState.config.set("talkTcpPort", 16063);
    vscodeState.activeTextEditor = {
      document: {
        languageId: "pangoscript",
        lineAt: vi.fn(() => ({ text: "Master.Brightness" })),
      },
      selection: { active: { line: 0, character: 8 } },
    };
    const context = { subscriptions: [] } as unknown as vscode.ExtensionContext;
    registerBeyondRuntimeCommands(context);

    await commandHandlers.get("pangolint.fetchObjectValue")?.();

    expect(readBeyondProperty).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyPath: "Master.Brightness",
        talkTransport: "tcp",
        talkTcpHost: "192.0.2.148",
        talkTcpPort: 16063,
        talkUdpHost: "127.0.0.1",
        talkUdpPort: 16062,
      }),
    );
  });
});
