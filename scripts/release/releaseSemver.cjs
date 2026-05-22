const STRICT_SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

function isStrictSemver(version) {
  return STRICT_SEMVER_RE.test(version);
}

function normalizeVersionInput(input, options = {}) {
  const raw = String(input ?? "").trim();
  if (!raw) return undefined;
  const version = options.allowLeadingV ? raw.replace(/^v/, "") : raw;
  return isStrictSemver(version) ? version : undefined;
}

module.exports = {
  isStrictSemver,
  normalizeVersionInput,
};
