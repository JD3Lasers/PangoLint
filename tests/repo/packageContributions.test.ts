import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const manifest = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as {
  contributes: {
    commands?: Array<{ command: string; title?: string }>;
    menus?: {
      "view/title"?: Array<{ command: string; when?: string }>;
    };
    keybindings?: Array<{ command: string; when?: string }>;
    configuration?: {
      properties?: Record<
        string,
        { type?: string; default?: unknown; enum?: string[]; description?: string; scope?: string }
      >;
    };
  };
};

describe("package contributions", () => {
  it("scopes the sidebar insert keybinding to PangoScript editors", () => {
    const binding = manifest.contributes.keybindings?.find(
      (candidate) => candidate.command === "pangolint.sidebar.insertSelectedCommand",
    );

    expect(binding?.when).toContain("focusedView == pangolint.commandsView");
    expect(binding?.when).toContain("editorIsOpen");
    expect(binding?.when).toContain("resourceLangId == pangoscript");
  });

  it("declares the diagnostic highlight-style setting with the expected enum and default", () => {
    const setting = manifest.contributes.configuration?.properties?.["pangolint.diagnostics.highlightStyle"];
    expect(setting?.type).toBe("string");
    expect(setting?.enum).toEqual(["squiggleOnly", "background", "lineBackground"]);
    expect(setting?.default).toBe("lineBackground");
  });

  it("declares the diagnostic inline-messages setting with the expected enum and default", () => {
    const setting = manifest.contributes.configuration?.properties?.["pangolint.diagnostics.inlineMessages"];
    expect(setting?.type).toBe("string");
    expect(setting?.enum).toEqual(["off", "warningsAndAbove", "all"]);
    expect(setting?.default).toBe("off");
  });

  it("contributes the offline reference site command to command and object views", () => {
    const command = manifest.contributes.commands?.find(
      (candidate) => candidate.command === "pangolint.openReferenceSite",
    );
    const titleEntries = manifest.contributes.menus?.["view/title"]?.filter(
      (candidate) => candidate.command === "pangolint.openReferenceSite",
    );

    expect(command?.title).toBe("PangoLint: Open PangoScript Reference");
    expect(titleEntries?.map((entry) => entry.when).sort()).toEqual([
      "view == pangolint.commandsView",
      "view == pangolint.objectsView",
    ]);
  });

  it("keeps every BEYOND runtime setting out of workspace-controlled scope", () => {
    const runtimeSettings = Object.keys(manifest.contributes.configuration?.properties ?? {})
      .filter((key) => key.startsWith("pangolint.beyond."))
      .sort();

    expect(runtimeSettings).toEqual([
      "pangolint.beyond.allowScriptExecution",
      "pangolint.beyond.confirmRunEachSession",
      "pangolint.beyond.liveHoverValues",
      "pangolint.beyond.oscListenHost",
      "pangolint.beyond.oscListenPort",
      "pangolint.beyond.readbackTimeoutMs",
      "pangolint.beyond.talkHost",
      "pangolint.beyond.talkPort",
      "pangolint.beyond.talkTcpHost",
      "pangolint.beyond.talkTcpPassword",
      "pangolint.beyond.talkTcpPort",
      "pangolint.beyond.talkTransport",
      "pangolint.beyond.talkUdpFallbackAllowed",
      "pangolint.beyond.talkUdpHost",
      "pangolint.beyond.talkUdpPort",
    ]);

    for (const key of runtimeSettings) {
      expect(manifest.contributes.configuration?.properties?.[key]?.scope, key).toBe("machine");
    }
  });
});
