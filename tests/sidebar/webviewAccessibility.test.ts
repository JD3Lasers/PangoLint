import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = path.join(__dirname, "..", "..");

describe("sidebar webview accessibility contracts", () => {
  it("makes command category headers keyboard-operable", () => {
    const source = readSource("src/sidebar/view/webview/bundle/list.ts");
    const headerBlock = extractFunction(source, "renderGroupHeader");

    expect(headerBlock).toContain('role: "button"');
    expect(headerBlock).toContain("tabIndex: 0");
    expect(headerBlock).toContain("keydown");
    expect(headerBlock).toContain("event.preventDefault()");
  });

  it("exposes a command-row context menu with clipboard actions", () => {
    const source = readSource("src/sidebar/view/webview/bundle/list.ts");
    const rowBlock = extractFunction(source, "renderRow");

    expect(rowBlock).toContain("showContextMenu(e, command, options)");
    expect(source).toContain("Copy command");
    expect(source).toContain("Copy signature");
    expect(source).toContain("options.onCopy(command.canonical, command.canonical)");
    expect(source).toContain("options.onCopy(command.canonical, command.signature)");
  });

  it("prevents browser scrolling during keyboard activation of object paths", () => {
    const source = readSource("src/sidebar/view/webview/objects-bundle/main.ts");
    const propItemBlock = extractFunction(source, "propItem");

    expect(propItemBlock).toContain("e.preventDefault()");
  });

  it("exposes a keyboard-dismissable object path context menu with SetProp insertion", () => {
    const source = readSource("src/sidebar/view/webview/objects-bundle/main.ts");
    const propItemBlock = extractFunction(source, "propItem");

    expect(propItemBlock).toContain("showContextMenu(e, path, commands)");
    expect(source).toContain("function showContextMenu");
    expect(source).toContain("Copy path");
    expect(source).toContain('type: "copyPath", text: displayPath(path)');
    expect(source).toContain("Insert as SetProp");
    expect(source).toContain("toSetPropSnippet(path)");
    expect(source).toContain('role", "menu"');
    expect(source).toContain('e.key === "Escape"');
  });

  it("preserves section context when collecting searchable object leaves", () => {
    const source = readSource("src/sidebar/view/webview/objects-bundle/main.ts");
    const collectLeavesBlock = extractFunction(source, "collectLeaves");
    const sectionPathKey = "`$" + "{section}\\0$" + "{node.path}`";

    expect(collectLeavesBlock).toContain(sectionPathKey);
    expect(collectLeavesBlock).not.toContain("!seen.has(node.path)");
  });

  it("honors exclusive object value range bounds in sidebar metadata", () => {
    const source = readSource("src/sidebar/view/webview/objects-bundle/main.ts");
    const metadataSummaryBlock = extractFunction(source, "metadataSummary");
    const formatRangeBlock = extractFunction(source, "formatValueRangeBounds");

    expect(metadataSummaryBlock).toContain("formatValueRangeBounds(summary.range)");
    expect(formatRangeBlock).toContain('range.minInclusive === false ? ">" : ">="');
    expect(formatRangeBlock).toContain('range.maxInclusive === false ? "<" : "<="');
    expect(formatRangeBlock).toContain("`$" + "{min}..$" + "{max}`");
  });

  it("keeps internal object test status out of visible sidebar summaries", () => {
    const source = readSource("src/sidebar/view/webview/objects-bundle/main.ts");
    const readbackSummaryBlock = extractFunction(source, "readbackSummary");
    const behaviorSummaryBlock = extractFunction(source, "behaviorSummary");

    expect(readbackSummaryBlock).toContain("summary.observedValue === undefined");
    expect(readbackSummaryBlock).toContain("!locationLabel");
    expect(behaviorSummaryBlock).not.toContain("writeTestStatus");
    expect(behaviorSummaryBlock).not.toContain("readbackStatus");
  });

  it("keeps indexed-root location context out of visible object metadata", () => {
    const source = readSource("src/sidebar/view/webview/objects-bundle/main.ts");
    const metadataSummaryBlock = extractFunction(source, "metadataSummary");
    const visibleLocationKindBlock = extractFunction(source, "visibleLocationKind");

    expect(metadataSummaryBlock).toContain("visibleLocationKind(summary.locationKind)");
    expect(visibleLocationKindBlock).toContain('locationKind === "indexed-root"');
  });
});

function readSource(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function extractFunction(source: string, functionName: string): string {
  const start = source.indexOf(`function ${functionName}`);
  if (start === -1) throw new Error(`Missing function ${functionName}`);
  const nextFunction = source.indexOf("\nfunction ", start + 1);
  return nextFunction === -1 ? source.slice(start) : source.slice(start, nextFunction);
}
