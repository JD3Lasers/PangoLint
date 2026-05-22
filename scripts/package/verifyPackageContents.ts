import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { findPublicArtifactLeaks, findPublicArtifactPathLeaks } from "./publicArtifactPolicy";

const { expectedVsixPackagePaths, findForbiddenVsixPackagePathLabels, forbiddenVsixPackagePrefixes } =
  require("./packageSurfacePolicy.cjs") as {
    expectedVsixPackagePaths: string[];
    findForbiddenVsixPackagePathLabels: (relativePath: string) => string[];
    forbiddenVsixPackagePrefixes: string[];
  };

const expectedPathSet = new Set(expectedVsixPackagePaths);

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

const unapprovedData = [...paths].filter((packedPath) => findForbiddenVsixPackagePathLabels(packedPath).length > 0);
if (unapprovedData.length > 0) {
  throw new Error(`VSIX includes unapproved data surface(s): ${unapprovedData.join(", ")}`);
}

const missing = expectedVsixPackagePaths.filter((requiredPath) => !paths.has(requiredPath));
if (missing.length > 0) {
  throw new Error(`VSIX is missing required file(s): ${missing.join(", ")}`);
}

const unexpected = [...paths].filter((packedPath) => !expectedVsixPackagePaths.includes(packedPath));
if (unexpected.length > 0) {
  throw new Error(`VSIX includes unexpected file(s): ${unexpected.join(", ")}`);
}

const forbidden = [...paths].filter(
  (packedPath) =>
    !expectedPathSet.has(packedPath) &&
    forbiddenVsixPackagePrefixes.some((prefix) => packedPath === prefix.slice(0, -1) || packedPath.startsWith(prefix)),
);
if (forbidden.length > 0) {
  throw new Error(`VSIX includes forbidden file(s): ${forbidden.join(", ")}`);
}

const leaks = expectedVsixPackagePaths.flatMap((packedPath) => {
  if (!/\.(?:json|md|html|js|css|txt)$/.test(packedPath)) return [];

  const contents = readFileSync(packedPath, "utf8");
  return findPublicArtifactLeaks(contents).map((leak) => `${packedPath}: ${leak.label} (${leak.match})`);
});

if (leaks.length > 0) {
  throw new Error(`VSIX public artifacts expose private lab details:\n${leaks.join("\n")}`);
}

console.log(`VSIX content verified: ${paths.size} files.`);
