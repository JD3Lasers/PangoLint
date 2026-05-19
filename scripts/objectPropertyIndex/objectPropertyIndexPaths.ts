import path from "node:path";

export const repoRoot =
  path.basename(__dirname) === "objectPropertyIndex"
    ? path.resolve(__dirname, "..", "..")
    : path.resolve(__dirname, "..");
export const objectPathSourceFactsRelativePath = "data/pangoscript/object-tree/source-facts/object-paths.json";

export function objectPropertyIndexPaths(root = repoRoot) {
  const objectTreeSourceFactsPath = path.join(root, "data", "pangoscript", "object-tree", "source-facts");
  const rangeOverlayDirectory = path.join(objectTreeSourceFactsPath, "value-metadata");
  const readbackOverlayDirectory = path.join(objectTreeSourceFactsPath, "readback-metadata");
  const classificationOverlayDirectory = path.join(objectTreeSourceFactsPath, "behavior-metadata");

  return {
    inputPath: path.join(root, ...objectPathSourceFactsRelativePath.split("/")),
    outputPath: path.join(root, "data", "pangoscript", "object-tree", "runtime-indexes", "object-property-index.json"),
    commandKnowledgePath: path.join(root, "data", "pangoscript", "commands.merged.json"),
    fxEffectTypeReferencePath: path.join(
      root,
      "data",
      "pangoscript",
      "control-reference",
      "object-control-reference",
      "fx-effect-types.json",
    ),
    rangeOverlayDirectory,
    rangeOverlayPath: path.join(rangeOverlayDirectory, "root.json"),
    readbackOverlayDirectory,
    readbackOverlayPath: path.join(readbackOverlayDirectory, "root.json"),
    classificationOverlayDirectory,
    classificationOverlayPath: path.join(classificationOverlayDirectory, "root.json"),
  };
}

export function splitPath(identifier: string): string[] {
  return identifier.split(".").filter(Boolean);
}

export function normalizePath(identifier: string): string {
  return splitPath(identifier)
    .map((segment) => {
      if (/^\d+$/.test(segment)) return "N";
      if (/^#\d+$/.test(segment)) return "#N";
      return segment;
    })
    .join(".");
}

export function propertyPath(segments: string[], kind: "object" | "fx"): string {
  if (kind === "fx" && segments[0] === "FX" && segments.length > 4) {
    return segments.slice(4).join(".");
  }
  if ((segments[1] === "N" || segments[1] === "#N") && segments.length > 2) {
    return segments.slice(2).join(".");
  }
  return segments.slice(1).join(".") || segments[0] || "";
}

export function compareDottedPath(left: string, right: string): number {
  const leftParts = splitPath(left);
  const rightParts = splitPath(right);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index];
    const rightPart = rightParts[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;
    const leftNumber = /^\d+$/.test(leftPart) ? Number(leftPart) : undefined;
    const rightNumber = /^\d+$/.test(rightPart) ? Number(rightPart) : undefined;
    if (leftNumber !== undefined && rightNumber !== undefined) return leftNumber - rightNumber;
    return leftPart.localeCompare(rightPart);
  }
  return 0;
}
