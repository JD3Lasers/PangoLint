import type { CommandSummary } from "../../../model/types";

export function formatCatalogStatus(visible: readonly CommandSummary[], total: readonly CommandSummary[]): string {
  if (visible.length !== total.length) {
    return `${visible.length} of ${total.length} ${pluralize(total.length, "entry", "entries")}`;
  }
  return formatKindCounts(total);
}

function formatKindCounts(items: readonly CommandSummary[]): string {
  const functionCount = items.filter((item) => item.kind === "function").length;
  const commandCount = items.length - functionCount;
  const parts: string[] = [];
  if (commandCount > 0) parts.push(`${commandCount} ${pluralize(commandCount, "command", "commands")}`);
  if (functionCount > 0) parts.push(`${functionCount} ${pluralize(functionCount, "function", "functions")}`);
  return parts.length > 0 ? parts.join(" + ") : "0 entries";
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}
