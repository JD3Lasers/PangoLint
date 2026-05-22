const PROPERTY_ROOT = String.raw`(?:FB[34][-_][A-Za-z0-9]+|[A-Za-z_][A-Za-z0-9_]*|#[0-9]+)(?:\[[0-9]+\])*`;
const PROPERTY_SEGMENT = String.raw`(?:[A-Za-z_][A-Za-z0-9_]*|[0-9]+)(?:\[[0-9]+\])*`;
const PROPERTY_PATH_RE = new RegExp(`^${PROPERTY_ROOT}(?:\\.${PROPERTY_SEGMENT})+$`);

export function validateReadbackPropertyPath(path: string): string | undefined {
  const trimmed = path.trim();
  if (path !== trimmed || !PROPERTY_PATH_RE.test(trimmed)) {
    return `Invalid property path '${path}'.`;
  }
  return undefined;
}
