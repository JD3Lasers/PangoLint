export interface LeadingCommandName {
  name: string;
  start: number;
  end: number;
}

const LEADING_COMMAND_RE = /^(\s*)([A-Za-z_][A-Za-z0-9_]*)\b/;

export function leadingCommandName(line: string): LeadingCommandName | undefined {
  const match = LEADING_COMMAND_RE.exec(line);
  if (!match) return undefined;
  const start = match[1].length;
  const name = match[2];
  return {
    name,
    start,
    end: start + name.length,
  };
}
