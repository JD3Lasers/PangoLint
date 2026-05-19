import { readFileSync } from "node:fs";

import type {
  ObjectPropertyValueEvidence,
  ObjectPropertyValueMetadata,
  ObjectPropertyValueRange,
} from "../../src/knowledge/objectPropertyIndex";
import { splitPath } from "./objectPropertyIndexPaths";
import { mergeSearchText, valueMetadataSearchText } from "./objectPropertyIndexSearchText";
import type {
  CommandKnowledgeFile,
  CommandRangeCandidate,
  CommandRangeCommand,
  CommandRangeParameter,
  OutputEntry,
} from "./objectPropertyIndexTypes";

export function loadCommandKnowledge(filePath: string): CommandKnowledgeFile {
  return JSON.parse(readFileSync(filePath, "utf8")) as CommandKnowledgeFile;
}

export function applyCommandRangeSeeds(entries: OutputEntry[], commandKnowledge: CommandKnowledgeFile): void {
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));
  const candidatesByPath = new Map<string, CommandRangeCandidate[]>();
  for (const command of Object.values(commandKnowledge.commands)) {
    const candidates = commandRangeCandidates(command, byPath);
    for (const candidate of candidates) {
      const bucket = candidatesByPath.get(candidate.path) ?? [];
      bucket.push(candidate);
      candidatesByPath.set(candidate.path, bucket);
    }
  }

  for (const [pathValue, candidates] of candidatesByPath) {
    const entry = byPath.get(pathValue);
    if (!entry || entry.valueMetadata) continue;
    const candidate = [...candidates].sort(compareCommandRangeCandidates)[0];
    const metadata = commandCandidateValueMetadata(candidate);
    entry.valueMetadata = metadata;
    entry.searchText = mergeSearchText(entry.searchText, commandCandidateSearchText(candidate, metadata));
  }
}

function commandRangeCandidates(
  command: CommandRangeCommand,
  entriesByPath: ReadonlyMap<string, OutputEntry>,
): CommandRangeCandidate[] {
  const paths = (command.setsProperty ?? []).filter((pathValue) => entriesByPath.has(pathValue));
  if (paths.length === 0 || isSelectorOnlyCommand(command.canonical)) return [];

  const candidates: CommandRangeCandidate[] = [];
  for (const form of command.forms ?? []) {
    const params = (form.parameters ?? []).filter(hasRangeMetadata);
    if (params.length === 0) continue;
    candidates.push(...mappedCommandRangeCandidates(command.canonical, paths, params));
  }
  return candidates;
}

function mappedCommandRangeCandidates(
  command: string,
  paths: readonly string[],
  params: readonly CommandRangeParameter[],
): CommandRangeCandidate[] {
  const candidate = (pathValue: string, param: CommandRangeParameter | undefined): CommandRangeCandidate[] =>
    pathValue && param ? [{ path: pathValue, command, parameter: param }] : [];
  const param = (name: string) => params.find((item) => item.name === name);

  if (command === "SetCueCaptionColor") {
    return candidate("WS.N.N.CaptionColor", param("packedColor"));
  }
  if (command === "SetGridSize") {
    const columnsRows = setGridSizeCountParameter(param("columns"), param("rows"));
    return [
      ...candidate("Grid.GetColCount", param("columns")),
      ...candidate("Grid.GetRowCount", param("rows")),
      ...candidate("Grid.Count", columnsRows),
    ];
  }
  if (command === "PositionIndex" || command === "SizeIndex") {
    return paths.flatMap((pathValue) => candidate(pathValue, param("value")));
  }
  if (command === "RGBA" || command === "RGBADelta") {
    return [
      ...candidate("Master.Red", param("r") ?? param("value")),
      ...candidate("Master.Green", param("g") ?? param("value")),
      ...candidate("Master.Blue", param("b") ?? param("value")),
      ...candidate("Master.Alpha", param("a") ?? param("value")),
    ];
  }
  if (command === "ZoneFXTimeScale" || command === "ZoneFXTimeShift") {
    return paths.flatMap((pathValue) => {
      if (pathValue.includes("Clock")) return candidate(pathValue, param("clockMul"));
      if (pathValue.includes("Metro")) return candidate(pathValue, param("metroMul"));
      return [];
    });
  }
  if (params.length === 1) {
    return paths.flatMap((pathValue) => candidate(pathValue, params[0]));
  }
  if (params.length === paths.length) {
    return paths.flatMap((pathValue, index) => candidate(pathValue, params[index]));
  }
  return [];
}

function hasRangeMetadata(param: CommandRangeParameter): boolean {
  return Boolean(param.valueRange || param.acceptedValues?.length);
}

function isSelectorOnlyCommand(command: string): boolean {
  return (
    command === "MuteZonesOfProjector" ||
    command === "ToggleMuteZoneOfProjector" ||
    command === "UnMuteZonesOfProjector"
  );
}

function setGridSizeCountParameter(
  columns: CommandRangeParameter | undefined,
  rows: CommandRangeParameter | undefined,
): CommandRangeParameter | undefined {
  if (!columns?.valueRange || !rows?.valueRange) return undefined;
  return {
    name: "columnsRows",
    type: "integer",
    valueRange: {
      min: 1,
      max: 256,
      unit: "cue slots",
      boundaryBehavior: "unknown",
      evidenceLevel: "inferred",
      notes:
        "Derived from SetGridSize columns and rows, each observed as 1..16. Grid.Count is the resulting cell count, so this range is inferred from exact command metadata rather than independently probed as a direct SetProp range.",
    },
  };
}

function compareCommandRangeCandidates(left: CommandRangeCandidate, right: CommandRangeCandidate): number {
  return (
    commandRangeCandidateScore(right) - commandRangeCandidateScore(left) || left.command.localeCompare(right.command)
  );
}

function commandRangeCandidateScore(candidate: CommandRangeCandidate): number {
  let score = 0;
  if (!isDeltaCandidate(candidate)) score += 80;
  if (propertyParameterMatches(candidate.path, candidate.parameter.name)) score += 60;
  if (candidate.parameter.valueRange?.min !== undefined || candidate.parameter.valueRange?.max !== undefined)
    score += 20;
  if (candidate.parameter.acceptedValues?.length) score += 5;
  if (candidate.parameter.name === "value") score += 3;
  return score;
}

function isDeltaCandidate(candidate: CommandRangeCandidate): boolean {
  return /delta|relative/i.test(
    `${candidate.command} ${candidate.parameter.name} ${candidate.parameter.range ?? ""} ${
      candidate.parameter.valueRange?.unit ?? ""
    }`,
  );
}

function propertyParameterMatches(pathValue: string, parameterName: string): boolean {
  const leaf = splitPath(pathValue).at(-1)?.toLowerCase();
  const parameter = parameterName.toLowerCase();
  if (!leaf) return false;
  if (leaf === parameter) return true;
  const aliases: Record<string, string[]> = {
    alpha: ["a", "enabled"],
    blue: ["b"],
    captioncolor: ["packedcolor"],
    count: ["columnsrows"],
    getcolcount: ["columns"],
    getrowcount: ["rows"],
    green: ["g"],
    red: ["r"],
    rgbcolor: ["packedcolor"],
  };
  return aliases[leaf]?.includes(parameter) ?? false;
}

function commandCandidateValueMetadata(candidate: CommandRangeCandidate): ObjectPropertyValueMetadata {
  const rangeEvidence = toObjectValueEvidence(candidate.parameter.valueRange?.evidenceLevel);
  const evidenceLevel = rangeEvidence ?? "inferred";
  return {
    valueType: commandParameterValueType(candidate.parameter.type),
    ...(candidate.parameter.valueRange ? { valueRange: commandValueRange(candidate.parameter.valueRange) } : {}),
    ...(candidate.parameter.acceptedValues?.length
      ? { acceptedValues: candidate.parameter.acceptedValues.map((value) => ({ ...value })) }
      : {}),
    evidenceLevel,
    notes: `Command-derived seed from ${candidate.command} ${candidate.parameter.name} parameter for exact setsProperty target. This is not same-name propagation.`,
  };
}

function commandParameterValueType(
  type: CommandRangeParameter["type"],
): NonNullable<ObjectPropertyValueMetadata["valueType"]> {
  return type === "variadic" ? "unknown" : type;
}

function commandValueRange(range: NonNullable<CommandRangeParameter["valueRange"]>): ObjectPropertyValueRange {
  return {
    ...(range.min !== undefined ? { min: range.min } : {}),
    ...(range.max !== undefined ? { max: range.max } : {}),
    ...(range.minInclusive !== undefined ? { minInclusive: range.minInclusive } : {}),
    ...(range.maxInclusive !== undefined ? { maxInclusive: range.maxInclusive } : {}),
    ...(range.unit ? { unit: range.unit } : {}),
    ...(range.boundaryBehavior ? { boundaryBehavior: range.boundaryBehavior } : {}),
    ...(toObjectValueEvidence(range.evidenceLevel)
      ? { evidenceLevel: toObjectValueEvidence(range.evidenceLevel) }
      : {}),
    ...(range.notes ? { notes: range.notes } : {}),
  };
}

function toObjectValueEvidence(value: string | undefined): ObjectPropertyValueEvidence | undefined {
  if (value === "documented" || value === "observed" || value === "inferred" || value === "unverified") return value;
  return undefined;
}

function commandCandidateSearchText(candidate: CommandRangeCandidate, metadata: ObjectPropertyValueMetadata): string {
  return [
    "command derived exact setsproperty target",
    candidate.command,
    candidate.parameter.name,
    candidate.parameter.range,
    metadata.notes,
    valueMetadataSearchText(metadata),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");
}
