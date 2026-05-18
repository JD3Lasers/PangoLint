// Markdown rendering for command hover/detail surfaces. Returns plain
// Markdown source — the view layer wraps it in vscode.MarkdownString or
// whatever its renderer expects. No vscode imports.

import type { CommandDetail } from "./types";

const LANGUAGE_FENCE = "pangoscript";

export function renderCommandMarkdown(detail: CommandDetail): string {
  const lines: string[] = [];
  lines.push(`## ${detail.canonical}`);

  const meta = formatMetaLine(detail);
  if (meta) lines.push(`*${meta}*`);

  if (detail.description) {
    lines.push("");
    lines.push(detail.description);
  }

  lines.push("");
  lines.push("**Signature**");
  lines.push(`\`\`\`${LANGUAGE_FENCE}`);
  lines.push(detail.signatures[0]?.signature ?? detail.signature);
  lines.push("```");

  const params = detail.signatures[0]?.parameters ?? [];
  if (params.length > 0) {
    lines.push("");
    lines.push("**Parameters**");
    lines.push("");
    lines.push("| Name | Type | Required |");
    lines.push("| --- | --- | --- |");
    for (const param of params) {
      const required = param.required ? "yes" : "no";
      lines.push(`| ${escapeCell(param.name)} | ${escapeCell(param.type)} | ${required} |`);
    }
  }

  if (detail.setsProperty.length > 0) {
    lines.push("");
    lines.push("**Writes**");
    for (const path of detail.setsProperty) {
      lines.push(`- \`${path}\``);
    }
  }

  if (detail.example && detail.example !== detail.signature) {
    lines.push("");
    lines.push("**Example**");
    lines.push(`\`\`\`${LANGUAGE_FENCE}`);
    lines.push(detail.example);
    lines.push("```");
  }

  if (detail.notes.length > 0) {
    lines.push("");
    lines.push("**Notes**");
    for (const note of detail.notes) {
      lines.push(`- ${note.text}`);
    }
  }

  return lines.join("\n");
}

function formatMetaLine(detail: CommandDetail): string {
  const parts: string[] = [];
  parts.push(detail.category);
  parts.push(`safety: ${detail.safetyTier}`);
  return parts.join(" · ");
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|");
}
