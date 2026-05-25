import { describe, expect, it } from "vitest";

import { describeBoundaryBehavior } from "../../src/sidebar/view/webview/bundle/detail";

describe("sidebar detail formatting", () => {
  it("renders mixed boundary behavior explicitly", () => {
    expect(describeBoundaryBehavior("mixed")).toBe("has mixed behavior");
  });
});
