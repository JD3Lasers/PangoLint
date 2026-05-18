import { describe, expect, it } from "vitest";

import { propertyPathAtPosition } from "../../src/language/propertyPath";

describe("propertyPathAtPosition", () => {
  it("recognizes numbered object-tree aliases as property roots", () => {
    const document = fakeDocument("#1.Red = 255");

    expect(
      propertyPathAtPosition(document, { line: 0, character: 2 } as Parameters<typeof propertyPathAtPosition>[1]),
    ).toBe("#1.Red");
  });

  it("recognizes hyphenated FB controller roots as property roots", () => {
    const document = fakeDocument("FB4-ABC123.Connected = 1");

    expect(
      propertyPathAtPosition(document, { line: 0, character: 8 } as Parameters<typeof propertyPathAtPosition>[1]),
    ).toBe("FB4-ABC123.Connected");
  });
});

function fakeDocument(text: string) {
  return {
    lineAt: (line: number) => ({ text: text.split(/\r?\n/)[line] ?? "" }),
  } as Parameters<typeof propertyPathAtPosition>[0];
}
