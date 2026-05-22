const PANGOSCRIPT_DATA_PATHS = {
  beyondCategoryTree: "data/pangoscript/beyond-category-tree.json",
  commandsMerged: "data/pangoscript/commands.merged.json",
  commandPropertyCoverage: "data/pangoscript/command-property-coverage.json",
  knownProperties: "data/pangoscript/object-tree/runtime-indexes/known-properties.json",
  objectPropertyIndex: "data/pangoscript/object-tree/runtime-indexes/object-property-index.json",
  controlReferenceReadme: "data/pangoscript/control-reference/README.md",
  controlReferencePackagePolicy: "data/pangoscript/control-reference/package-policy.json",
  mcpControlReferenceReadme: "data/pangoscript/control-reference/mcp-control-reference/README.md",
  mcpPropertyControls: "data/pangoscript/control-reference/mcp-control-reference/property-controls.json",
  mcpControlReferenceSummary: "data/pangoscript/control-reference/mcp-control-reference/summary.json",
};

const REFERENCE_DOC_PATHS = {
  diagnosticsReadme: "docs/references/diagnostics/README.md",
  operators: "docs/references/operators.md",
  syntax: "docs/references/syntax.md",
  masterObjectTree: "docs/references/beyond/pangoscript/master-object-tree.md",
  objectModel: "docs/references/beyond/pangoscript/object-model.md",
};

const MCP_CONTROL_REFERENCE_DIRECTORY = "data/pangoscript/control-reference/mcp-control-reference";
const COMMAND_REFERENCE_DIRECTORY = "docs/references/beyond/pangoscript/command-reference";

const mcpRuntimeDataFiles = [
  PANGOSCRIPT_DATA_PATHS.commandsMerged,
  PANGOSCRIPT_DATA_PATHS.commandPropertyCoverage,
  PANGOSCRIPT_DATA_PATHS.knownProperties,
  PANGOSCRIPT_DATA_PATHS.objectPropertyIndex,
  PANGOSCRIPT_DATA_PATHS.controlReferenceReadme,
  PANGOSCRIPT_DATA_PATHS.controlReferencePackagePolicy,
];

const mcpControlReferenceDataFiles = [
  PANGOSCRIPT_DATA_PATHS.mcpControlReferenceReadme,
  PANGOSCRIPT_DATA_PATHS.mcpPropertyControls,
  PANGOSCRIPT_DATA_PATHS.mcpControlReferenceSummary,
];

const mcpReferenceDocFiles = [
  REFERENCE_DOC_PATHS.diagnosticsReadme,
  REFERENCE_DOC_PATHS.operators,
  REFERENCE_DOC_PATHS.syntax,
  REFERENCE_DOC_PATHS.masterObjectTree,
  REFERENCE_DOC_PATHS.objectModel,
];

const packageSurfacePathGroups = {
  mcpAllowedDataFiles: [...mcpRuntimeDataFiles, ...mcpControlReferenceDataFiles],
  mcpAllowedDataDirectoryPrefixes: [`${MCP_CONTROL_REFERENCE_DIRECTORY}/`],
  mcpAssetFiles: ["LICENSE", ...mcpRuntimeDataFiles, ...mcpReferenceDocFiles],
  mcpAssetDirectories: [MCP_CONTROL_REFERENCE_DIRECTORY, COMMAND_REFERENCE_DIRECTORY],
  requiredMcpPackageFiles: [
    "LICENSE",
    "README.md",
    "bin/pangolint-mcp.js",
    "dist/server.js",
    "package.json",
    ...mcpReferenceDocFiles,
  ],
  vsixPackageFiles: [
    "dist/extension.js",
    "dist/sidebar-commands-webview.js",
    "dist/sidebar-objects-webview.js",
    PANGOSCRIPT_DATA_PATHS.beyondCategoryTree,
    PANGOSCRIPT_DATA_PATHS.commandsMerged,
    PANGOSCRIPT_DATA_PATHS.commandPropertyCoverage,
    PANGOSCRIPT_DATA_PATHS.knownProperties,
    PANGOSCRIPT_DATA_PATHS.objectPropertyIndex,
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
    REFERENCE_DOC_PATHS.diagnosticsReadme,
    "package.json",
    "README.md",
    "LICENSE",
    "NOTICE.md",
    "CHANGELOG.md",
  ],
};

const allowedMcpDataPaths = new Set(packageSurfacePathGroups.mcpAllowedDataFiles);

const allowedMcpDataDirectoryPrefixes = packageSurfacePathGroups.mcpAllowedDataDirectoryPrefixes;

const mcpAssetFiles = packageSurfacePathGroups.mcpAssetFiles;

const mcpAssetDirectories = packageSurfacePathGroups.mcpAssetDirectories;

const requiredMcpPackagePaths = [
  ...packageSurfacePathGroups.requiredMcpPackageFiles,
  ...packageSurfacePathGroups.mcpAllowedDataFiles,
];

const expectedVsixPackagePaths = packageSurfacePathGroups.vsixPackageFiles;

const forbiddenVsixPackagePrefixes = [
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

const forbiddenMcpAssetPathPatterns = [
  ["local probe directory", /(^|\/)probes?(?:\/|$)/i],
  ["local probe file", /(^|\/)probe-[^/]*$/i],
  ["maintainer-only evidence directory", /(^|\/)maintainer[-_]evidence(?:\/|$)/i],
];

const forbiddenMcpDataPrefixes = [
  ["Object Tree source facts", "data/pangoscript/object-tree/source-facts/"],
  ["Object Tree evidence", "data/pangoscript/object-tree/evidence/"],
  ["Object Tree audit output", "data/pangoscript/object-tree/audits/"],
  ["Object Tree package projection", "data/pangoscript/object-tree/package-projections/"],
];

const forbiddenVsixDataSurfaces = [
  ["control reference data", "data/pangoscript/control-reference/"],
  ["Object Tree source facts", "data/pangoscript/object-tree/source-facts/"],
  ["Object Tree evidence", "data/pangoscript/object-tree/evidence/"],
  ["Object Tree audit output", "data/pangoscript/object-tree/audits/"],
  ["Object Tree package projection", "data/pangoscript/object-tree/package-projections/"],
  ["legacy Object behavior audits", "data/pangoscript/object-behavior-audits/"],
  ["legacy Object readback audits", "data/pangoscript/object-readback-audits/"],
  ["Object range evidence", "data/pangoscript/object-range-evidence/"],
  ["Object readback evidence", "data/pangoscript/object-readback-evidence/"],
  ["Object behavior evidence", "data/pangoscript/object-behavior-evidence/"],
  ["Object property ranges", "data/pangoscript/object-property-ranges/"],
  ["Object property readbacks", "data/pangoscript/object-property-readbacks/"],
  ["Object property classifications", "data/pangoscript/object-property-classifications/"],
];

const forbiddenVsixDataPrefixes = forbiddenVsixDataSurfaces.map(([, prefix]) => prefix);

function pathMatchesPrefix(relativePath, prefix) {
  return relativePath === prefix.slice(0, -1) || relativePath.startsWith(prefix);
}

function isApprovedMcpDataPath(relativePath) {
  if (!relativePath.startsWith("data/")) return true;
  if (allowedMcpDataPaths.has(relativePath)) return true;
  return allowedMcpDataDirectoryPrefixes.some(
    (prefix) => relativePath === prefix.slice(0, -1) || relativePath.startsWith(prefix),
  );
}

function findMcpAssetPatternLabels(relativePath) {
  const labels = [];
  for (const [label, pattern] of forbiddenMcpAssetPathPatterns) {
    const match = pattern.exec(relativePath);
    if (match?.[0]) labels.push(label);
  }
  return labels;
}

function findForbiddenMcpPackagePathLabels(relativePath) {
  return [
    ...findMcpAssetPatternLabels(relativePath),
    ...forbiddenMcpDataPrefixes.filter(([, prefix]) => pathMatchesPrefix(relativePath, prefix)).map(([label]) => label),
  ];
}

function findForbiddenVsixPackagePathLabels(relativePath) {
  return [
    ...findMcpAssetPatternLabels(relativePath),
    ...forbiddenVsixDataSurfaces
      .filter(([, prefix]) => pathMatchesPrefix(relativePath, prefix))
      .map(([label]) => label),
  ];
}

function findForbiddenPackagePathLabels(relativePath) {
  return [
    ...new Set([
      ...findForbiddenMcpPackagePathLabels(relativePath),
      ...findForbiddenVsixPackagePathLabels(relativePath),
    ]),
  ];
}

function mcpAssetPathError(relativePath) {
  const forbiddenLabels = findForbiddenMcpPackagePathLabels(relativePath);
  if (forbiddenLabels.length > 0) {
    return `refused maintainer-only asset path: ${relativePath} (${forbiddenLabels.join(", ")})`;
  }
  if (!isApprovedMcpDataPath(relativePath)) {
    return `refused unapproved MCP data path: ${relativePath}`;
  }
  return undefined;
}

function isApprovedMcpAssetPath(relativePath) {
  return mcpAssetPathError(relativePath) === undefined;
}

function assertApprovedMcpAssetPath(relativePath) {
  const message = mcpAssetPathError(relativePath);
  if (message) throw new Error(message);
}

module.exports = {
  allowedMcpDataDirectoryPrefixes,
  allowedMcpDataPaths,
  assertApprovedMcpAssetPath,
  expectedVsixPackagePaths,
  findForbiddenMcpPackagePathLabels,
  findForbiddenPackagePathLabels,
  findForbiddenVsixPackagePathLabels,
  forbiddenMcpAssetPathPatterns,
  forbiddenMcpDataPrefixes,
  forbiddenVsixDataPrefixes,
  forbiddenVsixDataSurfaces,
  forbiddenVsixPackagePrefixes,
  isApprovedMcpAssetPath,
  isApprovedMcpDataPath,
  mcpAssetDirectories,
  mcpAssetFiles,
  mcpAssetPathError,
  packageSurfacePathGroups,
  requiredMcpPackagePaths,
};
