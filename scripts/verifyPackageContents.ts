import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { findPublicArtifactLeaks, findPublicArtifactPathLeaks } from "./publicArtifactPolicy";

const expectedPaths = [
  "dist/extension.js",
  "dist/sidebar-commands-webview.js",
  "dist/sidebar-objects-webview.js",
  "data/pangoscript/beyond-category-tree.json",
  "data/pangoscript/commands.merged.json",
  "data/pangoscript/command-property-coverage.json",
  "data/pangoscript/object-tree/runtime-indexes/known-properties.json",
  "data/pangoscript/object-tree/runtime-indexes/object-property-index.json",
  "language-configuration.json",
  "syntaxes/pangoscript.tmLanguage.json",
  "snippets/pangoscript.json",
  "media/icon.png",
  "media/icon-activity-bar.svg",
  "media/reference/pangoscript-reference.html",
  "media/sidebar/commands.html",
  "media/sidebar/commands.css",
  "media/sidebar/objects.html",
  "media/sidebar/objects.css",
  "docs/references/diagnostics/README.md",
  "package.json",
  "README.md",
  "LICENSE",
  "NOTICE.md",
  "CHANGELOG.md",
];

const forbiddenPrefixes = [
  ".git/",
  ".github/",
  ".pangolint/",
  ".trash/",
  ".vscode-test/",
  ".vscode/",
  "__MACOSX/",
  "coverage/",
  "docs/",
  "node_modules/",
  "scripts/",
  "src/",
  "tests/",
];

const unapprovedVsixDataPrefixes = [
  "data/pangoscript/control-reference/",
  "data/pangoscript/object-tree/source-facts/",
  "data/pangoscript/object-tree/evidence/",
  "data/pangoscript/object-tree/audits/",
  "data/pangoscript/object-tree/package-projections/",
  "data/pangoscript/object-behavior-audits/",
  "data/pangoscript/object-readback-audits/",
  "data/pangoscript/object-range-evidence/",
  "data/pangoscript/object-readback-evidence/",
  "data/pangoscript/object-behavior-evidence/",
  "data/pangoscript/object-property-ranges/",
  "data/pangoscript/object-property-readbacks/",
  "data/pangoscript/object-property-classifications/",
];

const expectedPathSet = new Set(expectedPaths);

const output = execSync("vsce ls --no-dependencies", {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});
const paths = new Set(output.split(/\r?\n/).filter(Boolean));

const pathLeaks = findPublicArtifactPathLeaks([...paths]);
if (pathLeaks.length > 0) {
  throw new Error(
    `VSIX includes maintainer-only path(s): ${pathLeaks
      .map((leak) => `${leak.path}: ${leak.label} (${leak.match})`)
      .join(", ")}`,
  );
}

const unapprovedData = [...paths].filter((packedPath) =>
  unapprovedVsixDataPrefixes.some((prefix) => packedPath.startsWith(prefix)),
);
if (unapprovedData.length > 0) {
  throw new Error(`VSIX includes unapproved data surface(s): ${unapprovedData.join(", ")}`);
}

const missing = expectedPaths.filter((requiredPath) => !paths.has(requiredPath));
if (missing.length > 0) {
  throw new Error(`VSIX is missing required file(s): ${missing.join(", ")}`);
}

const unexpected = [...paths].filter((packedPath) => !expectedPaths.includes(packedPath));
if (unexpected.length > 0) {
  throw new Error(`VSIX includes unexpected file(s): ${unexpected.join(", ")}`);
}

const forbidden = [...paths].filter(
  (packedPath) =>
    !expectedPathSet.has(packedPath) &&
    forbiddenPrefixes.some((prefix) => packedPath === prefix.slice(0, -1) || packedPath.startsWith(prefix)),
);
if (forbidden.length > 0) {
  throw new Error(`VSIX includes forbidden file(s): ${forbidden.join(", ")}`);
}

const leaks = expectedPaths.flatMap((packedPath) => {
  if (!/\.(?:json|md|html|js|css|txt)$/.test(packedPath)) return [];

  const contents = readFileSync(packedPath, "utf8");
  return findPublicArtifactLeaks(contents).map((leak) => `${packedPath}: ${leak.label} (${leak.match})`);
});

if (leaks.length > 0) {
  throw new Error(`VSIX public artifacts expose private lab details:\n${leaks.join("\n")}`);
}

console.log(`VSIX content verified: ${paths.size} files.`);
