import type {
  CommandKnowledgeEntry,
  PangoKnowledgeBase,
  PropertyMappingCoverageStatus,
  PropertyMappingProbe,
} from "./knowledgeBase";

interface CommandPropertyCoverageEntry {
  canonical: string;
  category: string;
  status: PropertyMappingCoverageStatus;
  evidenceLevel: string;
  safetyTier: string;
  setsProperty?: string[];
  notes?: string;
  probe?: PropertyMappingProbe;
}

export interface CommandPropertyCoverageLedger {
  schemaVersion: 1;
  generatedAt: string;
  summary: {
    total: number;
    mapped: number;
    noDirectProperty: number;
    deferred: number;
    unknown: number;
  };
  commands: Record<string, CommandPropertyCoverageEntry>;
}

export function buildCommandPropertyCoverageLedger(knowledgeBase: PangoKnowledgeBase): CommandPropertyCoverageLedger {
  const summary: CommandPropertyCoverageLedger["summary"] = {
    total: 0,
    mapped: 0,
    noDirectProperty: 0,
    deferred: 0,
    unknown: 0,
  };
  const commands: Record<string, CommandPropertyCoverageEntry> = {};

  const entries = Object.values(knowledgeBase.commands).sort((left, right) =>
    left.canonical.localeCompare(right.canonical),
  );
  for (const command of entries) {
    const entry = buildCoverageEntry(command);
    commands[entry.canonical] = entry;
    summary.total += 1;
    incrementStatus(summary, entry.status);
  }

  return {
    schemaVersion: 1,
    generatedAt: knowledgeBase.generatedAt ?? "",
    summary,
    commands,
  };
}

function buildCoverageEntry(command: CommandKnowledgeEntry): CommandPropertyCoverageEntry {
  const mappedProperties = command.setsProperty?.filter((property) => property.trim()) ?? [];
  const explicitCoverage = command.propertyMappingCoverage;
  const status: PropertyMappingCoverageStatus =
    mappedProperties.length > 0 ? "mapped" : (explicitCoverage?.status ?? "unknown");

  return {
    canonical: command.canonical,
    category: command.category,
    status,
    evidenceLevel: explicitCoverage?.evidenceLevel ?? command.evidenceLevel,
    safetyTier: explicitCoverage?.safetyTier ?? command.safetyTier ?? "unknown",
    ...(mappedProperties.length > 0 ? { setsProperty: mappedProperties } : {}),
    ...(explicitCoverage?.notes ? { notes: explicitCoverage.notes } : {}),
    ...(explicitCoverage?.probe ? { probe: explicitCoverage.probe } : {}),
  };
}

function incrementStatus(
  summary: CommandPropertyCoverageLedger["summary"],
  status: PropertyMappingCoverageStatus,
): void {
  switch (status) {
    case "mapped":
      summary.mapped += 1;
      break;
    case "no-direct-property":
      summary.noDirectProperty += 1;
      break;
    case "deferred":
      summary.deferred += 1;
      break;
    case "unknown":
      summary.unknown += 1;
      break;
  }
}
