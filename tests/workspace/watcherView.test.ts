import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as vscode from "vscode";

const { readBeyondPropertyMock, showInformationMessageMock, updateWorkspaceStateMock, workspaceConfig } = vi.hoisted(
  () => ({
    readBeyondPropertyMock: vi.fn(),
    showInformationMessageMock: vi.fn(),
    updateWorkspaceStateMock: vi.fn(),
    workspaceConfig: new Map<string, unknown>(),
  }),
);

vi.mock("vscode", () => {
  class EventEmitter<T = void> {
    readonly event = vi.fn();
    fire(_value?: T): void {}
  }

  class ThemeIcon {
    constructor(readonly id: string) {}
  }

  class TreeItem {
    description?: string;
    iconPath?: ThemeIcon;
    contextValue?: string;
    tooltip?: string;

    constructor(
      readonly label: string,
      readonly collapsibleState: number,
    ) {}
  }

  return {
    EventEmitter,
    ThemeIcon,
    TreeItem,
    TreeItemCollapsibleState: { None: 0 },
    window: {
      showInformationMessage: showInformationMessageMock,
    },
    workspace: {
      getConfiguration: () => ({
        get: (key: string, fallback: unknown) => (workspaceConfig.has(key) ? workspaceConfig.get(key) : fallback),
      }),
    },
  };
});

vi.mock("../../src/runtime/beyondReadback", () => ({
  readBeyondProperty: readBeyondPropertyMock,
}));

import { WatcherTreeProvider } from "../../src/workspace/watcherView";

describe("WatcherTreeProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workspaceConfig.clear();
  });

  it("refreshes watched properties sequentially so OSC listener binds do not overlap", async () => {
    let activeReadbacks = 0;
    let maxActiveReadbacks = 0;
    const callOrder: string[] = [];

    readBeyondPropertyMock.mockImplementation(async ({ propertyPath }: { propertyPath: string }) => {
      activeReadbacks++;
      maxActiveReadbacks = Math.max(maxActiveReadbacks, activeReadbacks);
      callOrder.push(`start:${propertyPath}`);
      await Promise.resolve();
      callOrder.push(`finish:${propertyPath}`);
      activeReadbacks--;
      return { ok: true, value: propertyPath };
    });

    const watcher = new WatcherTreeProvider(fakeContext(["Master.Brightness", "Master.Speed", "Zone.0.Red"]));

    await watcher.refresh();

    expect(maxActiveReadbacks).toBe(1);
    expect(callOrder).toEqual([
      "start:Master.Brightness",
      "finish:Master.Brightness",
      "start:Master.Speed",
      "finish:Master.Speed",
      "start:Zone.0.Red",
      "finish:Zone.0.Red",
    ]);
  });

  it("coalesces concurrent refresh requests into one in-flight refresh", async () => {
    let activeReadbacks = 0;
    let maxActiveReadbacks = 0;

    readBeyondPropertyMock.mockImplementation(async ({ propertyPath }: { propertyPath: string }) => {
      activeReadbacks++;
      maxActiveReadbacks = Math.max(maxActiveReadbacks, activeReadbacks);
      await Promise.resolve();
      activeReadbacks--;
      return { ok: true, value: propertyPath };
    });

    const watcher = new WatcherTreeProvider(fakeContext(["Master.Brightness", "Master.Speed"]));

    await Promise.all([watcher.refresh(), watcher.refresh()]);

    expect(maxActiveReadbacks).toBe(1);
    expect(readBeyondPropertyMock).toHaveBeenCalledTimes(2);
  });

  it("passes the selected BEYOND Talk transport settings to readback refreshes", async () => {
    workspaceConfig.set("talkTransport", "tcp");
    workspaceConfig.set("talkTcpHost", "192.0.2.148");
    workspaceConfig.set("talkTcpPort", 16063);
    workspaceConfig.set("talkUdpHost", "192.0.2.149");
    workspaceConfig.set("talkUdpPort", 16062);
    workspaceConfig.set("talkUdpFallbackAllowed", true);
    workspaceConfig.set("talkTcpPassword", "secret");
    workspaceConfig.set("oscListenHost", "0.0.0.0");
    workspaceConfig.set("oscListenPort", 7000);
    workspaceConfig.set("readbackTimeoutMs", 4500);
    readBeyondPropertyMock.mockResolvedValue({ ok: true, value: 50 });

    const watcher = new WatcherTreeProvider(fakeContext(["Master.Brightness"]));

    await watcher.refresh();

    expect(readBeyondPropertyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyPath: "Master.Brightness",
        talkTransport: "tcp",
        talkTcpHost: "192.0.2.148",
        talkTcpPort: 16063,
        talkUdpHost: "192.0.2.149",
        talkUdpPort: 16062,
        talkUdpFallbackAllowed: true,
        talkTcpPassword: "secret",
        listenHost: "0.0.0.0",
        listenPort: 7000,
        timeoutMs: 4500,
      }),
    );
  });

  it("shows captured run callback messages as transient watcher rows", () => {
    const watcher = new WatcherTreeProvider(fakeContext(["Master.Brightness"]));

    watcher.recordOscCallbacks([{ address: "/pangolint/smoke/zone", typeTags: "sff", args: ["req-1", 100, 0.5] }]);

    const children = watcher.getChildren();
    expect(children[0]).toMatchObject({
      kind: "callback",
      path: "/pangolint/smoke/zone",
      typeTags: "sff",
      args: ["req-1", 100, 0.5],
    });

    const item = watcher.getTreeItem(children[0]);
    expect(item.label).toBe("/pangolint/smoke/zone");
    expect(item.description).toContain('["req-1",100,0.5]');
    expect(item.contextValue).toBe("oscCallback");
    expect(item.iconPath).toMatchObject({ id: "symbol-event" });
  });
});

function fakeContext(watchedPaths: string[]): vscode.ExtensionContext {
  return {
    workspaceState: {
      get: vi.fn((_key: string, fallback: string[]) => watchedPaths ?? fallback),
      update: updateWorkspaceStateMock,
    },
  } as unknown as vscode.ExtensionContext;
}
