export interface PublicArtifactLeak {
  label: string;
  match: string;
}

export interface PublicArtifactPathLeak {
  label: string;
  path: string;
  match: string;
}

interface PublicArtifactPattern {
  label: string;
  pattern: RegExp;
}

const ipv4Octet = String.raw`(?:25[0-5]|2[0-4]\d|1?\d?\d)`;
const escapedDot = String.raw`\\{1,2}\.`;
const ephemeralPort = String.raw`(?:4915[2-9]|491[6-9]\d|49[2-9]\d{2}|5\d{4}|6[0-4]\d{3}|65[0-4]\d{2}|655[0-2]\d|6553[0-5])`;
const pairingPort = String.raw`8\d{3}(?![\d.])\b`;
const endpointHost = String.raw`(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,})`;
const objectValueField = String.raw`(?:observedValue|readValue|defaultValue|value|minValue|maxValue)\b`;
const singleLabelEndpoint = `(?!${objectValueField})[A-Za-z][A-Za-z0-9_-]*`;

const forbiddenPatterns: PublicArtifactPattern[] = [
  {
    label: "private-network IPv4 address",
    pattern: new RegExp(
      String.raw`\b(?:10\.${ipv4Octet}\.${ipv4Octet}\.${ipv4Octet}|172\.(?:1[6-9]|2\d|3[01])\.${ipv4Octet}\.${ipv4Octet}|192\.168\.${ipv4Octet}\.${ipv4Octet})\b`,
    ),
  },
  {
    label: "regex-escaped private-network IPv4 address",
    pattern: new RegExp(
      String.raw`(?:10${escapedDot}${ipv4Octet}${escapedDot}${ipv4Octet}${escapedDot}${ipv4Octet}|172${escapedDot}(?:1[6-9]|2\d|3[01])${escapedDot}${ipv4Octet}${escapedDot}${ipv4Octet}|192${escapedDot}168${escapedDot}${ipv4Octet}${escapedDot}${ipv4Octet})\b`,
    ),
  },
  { label: "hardware-specific FB OSC root", pattern: /\bFB[34][_-]\d{4,8}\b/ },
  {
    label: "hardware serial in source text",
    pattern:
      /\b(?:clientHardwareSerial|hardwareSerial|hardware[-_\s]?serial|controller[-_\s]?serial|projector[-_\s]?serial|serial)\b[^\r\n]{0,80}\b\d{5,8}\b/i,
  },
  {
    label: "device source port in source text",
    pattern:
      /\b(?:sourcePort|source_port|source-port|source\s+port|(?:mobile-device|device|client)\b[^\r\n]{0,40}\bsource port)\b[^\r\n]{0,20}\b\d{4,5}\b/i,
  },
  {
    label: "ephemeral port field in source text",
    pattern: new RegExp(
      String.raw`\b["']?(?:port|sourcePort|source_port|source-port)["']?\s*[:=\-\s]\s*${ephemeralPort}\b`,
      "i",
    ),
  },
  {
    label: "raw pairing endpoint-like port",
    pattern: new RegExp(
      String.raw`(?:\b${endpointHost}\s*:\s*${pairingPort}|(?<!["'])\b${singleLabelEndpoint}\s*:\s*${pairingPort}|["']${singleLabelEndpoint}\s*:\s*${pairingPort}["']|["']${singleLabelEndpoint}["']\s*:\s*${pairingPort}|\bport[-\s]${pairingPort}|(?:^|[^\w"'])\s*:${pairingPort})`,
      "i",
    ),
  },
  {
    label: "mobile app version in source text",
    pattern: /\b(?:mobile|remote|companion|control)[-\s]?app\b[^\r\n]{0,80}\b\d+\.\d+\.\d+\.\d+\b/i,
  },
  {
    label: "mobile app pairing endpoint in source text",
    pattern: /\b(?:mobile|remote|companion|control)[-\s]?app\b[^\r\n]{0,80}(?::\d{4,5}\b|\bport[-\s]\d{4,5}\b)/i,
  },
  {
    label: "private command export build label",
    pattern: /\bbuild-\d{4}\s+export\b/i,
  },
  {
    label: "private command export line reference",
    pattern: /\b(?:line|lines)\s+\d+(?:\s+and\s+\d+)?\s*:\s*`[^`]+`/i,
  },
  {
    label: "private sparse command entry provenance",
    pattern: /\b(?:appears? as|cataloged in|per)\b[^\r\n]{0,80}\bbare entr(?:y|ies)\b/i,
  },
];

const forbiddenPathPatterns: PublicArtifactPattern[] = [
  { label: "local probe directory", pattern: /(^|\/)probes?(?:\/|$)/i },
  { label: "local probe file", pattern: /(^|\/)probe-[^/]*$/i },
  { label: "maintainer-only evidence directory", pattern: /(^|\/)maintainer[-_]evidence(?:\/|$)/i },
  {
    label: "Object Tree source facts",
    pattern: /(^|\/)data\/pangoscript\/object-tree\/source-facts(?:\/|$)/,
  },
  { label: "Object Tree evidence", pattern: /(^|\/)data\/pangoscript\/object-tree\/evidence(?:\/|$)/ },
  { label: "Object Tree audit output", pattern: /(^|\/)data\/pangoscript\/object-tree\/audits(?:\/|$)/ },
  {
    label: "Object Tree package projection",
    pattern: /(^|\/)data\/pangoscript\/object-tree\/package-projections(?:\/|$)/,
  },
];

export function findPublicArtifactLeaks(contents: string): PublicArtifactLeak[] {
  const leaks: PublicArtifactLeak[] = [];

  for (const { label, pattern } of forbiddenPatterns) {
    const match = pattern.exec(contents);
    if (match?.[0]) leaks.push({ label, match: match[0] });
  }

  return leaks;
}

export function findPublicArtifactPathLeaks(paths: string[]): PublicArtifactPathLeak[] {
  const leaks: PublicArtifactPathLeak[] = [];

  for (const publicPath of paths) {
    for (const { label, pattern } of forbiddenPathPatterns) {
      const match = pattern.exec(publicPath);
      if (match?.[0]) {
        leaks.push({ label, path: publicPath, match: match[0] });
        break;
      }
    }
  }

  return leaks;
}
