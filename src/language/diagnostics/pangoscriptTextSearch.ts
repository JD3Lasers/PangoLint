export function findWordOutsideStrings(text: string, word: string, start: number, end: number): number {
  return findFirstWordOutsideStrings(text, [word], start, end)?.index ?? -1;
}

export function findTextOutsideStrings(
  text: string,
  needle: string,
  start: number,
  end: number,
): { text: string; index: number } | undefined {
  let inString = false;
  let escaped = false;

  for (let index = start; index < end; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (text.slice(index, index + needle.length) === needle) {
      return { text: needle, index };
    }
  }

  return undefined;
}

export function findFirstWordOutsideStrings(
  text: string,
  words: readonly string[],
  start: number,
  end: number,
): { word: string; index: number } | undefined {
  let inString = false;
  let escaped = false;

  for (let index = start; index < end; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    for (const word of words) {
      if (startsWithWordAt(text, word, index, end)) {
        return { word: text.slice(index, index + word.length), index };
      }
    }
  }

  return undefined;
}

export function findRegexOutsideStrings(text: string, pattern: RegExp): { text: string; index: number } | undefined {
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    const match = text.slice(index).match(pattern);
    if (match?.index === 0 && match[0]) {
      return { text: match[0], index };
    }
  }

  return undefined;
}

function startsWithWordAt(text: string, word: string, index: number, end: number): boolean {
  const afterIndex = index + word.length;
  if (afterIndex > end) return false;
  if (text.slice(index, afterIndex).toLowerCase() !== word.toLowerCase()) return false;
  return !isIdentifierChar(text[index - 1]) && !isIdentifierChar(text[afterIndex]);
}

function isIdentifierChar(char: string | undefined): boolean {
  return char !== undefined && /[A-Za-z0-9_]/.test(char);
}
