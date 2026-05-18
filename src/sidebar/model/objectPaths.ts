// Pure object-path formatting helpers shared by the extension host and
// browser webviews. Keep this module dependency-free so DOM bundles do not
// pull in Node-backed catalog loaders.

export function toBeyondOscAddress(path: string): string {
  const trimmed = path.trim();
  const slashPath = trimmed.replace(/\./g, "/").replace(/\/+/g, "/");
  if (trimmed.startsWith(".")) return slashPath.startsWith("/") ? slashPath : `/${slashPath}`;
  return `/b/${slashPath.replace(/^\/+/, "")}`;
}

export function toSetPropSnippet(path: string): string {
  return `SetProp "${path.trim()}", `;
}
