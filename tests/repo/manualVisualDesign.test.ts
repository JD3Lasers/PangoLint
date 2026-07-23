import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const manualHtml = readFileSync(path.join(process.cwd(), "docs", "manual.html"), "utf8");

describe("user manual visual design", () => {
  it("uses the neutral PangoLint documentation palette", () => {
    expect(manualHtml).toContain("--paper:        #090a0c;");
    expect(manualHtml).toContain("--accent:       #aeb4be;");
    expect(manualHtml).toContain("--accent-bg:    rgba(255, 255, 255, 0.07);");
    expect(manualHtml).not.toContain("--amber");
    expect(manualHtml).not.toContain("radial-gradient");
  });

  it("uses local system typography for public documentation", () => {
    expect(manualHtml).not.toContain("fonts.googleapis.com");
    expect(manualHtml).not.toContain("fonts.gstatic.com");
    expect(manualHtml).not.toContain("Fraunces");
    expect(manualHtml).not.toContain("IBM Plex Sans");
    expect(manualHtml).not.toContain("JetBrains Mono");
    expect(manualHtml).toContain('--font-body:    "Segoe UI Variable", "Segoe UI", system-ui, sans-serif;');
    expect(manualHtml).toContain('--font-mono:    "Cascadia Code", "SFMono-Regular", Consolas, monospace;');
  });

  it("retains distinct safety and print presentation", () => {
    expect(manualHtml).toContain("--safety:       #f08a5d;");
    expect(manualHtml).toContain("@media print");
    expect(manualHtml).toContain("--paper:    #ffffff;");
    expect(manualHtml).toContain(".callout--safety");
  });
});
