import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createWorkspaceScanScheduler } from "../../src/workspace/workspaceScanScheduler";

describe("createWorkspaceScanScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("coalesces rapid workspace change events into one scan", async () => {
    const run = vi.fn(async () => {});
    const scheduler = createWorkspaceScanScheduler(run, { delayMs: 100 });

    scheduler.schedule();
    scheduler.schedule();
    scheduler.schedule();

    await vi.advanceTimersByTimeAsync(99);
    expect(run).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(1);

    scheduler.dispose();
  });

  it("runs one follow-up scan when changes arrive during an in-flight scan", async () => {
    let releaseScan!: () => void;
    const run = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseScan = resolve;
        }),
    );
    const scheduler = createWorkspaceScanScheduler(run, { delayMs: 100 });

    scheduler.schedule();
    await vi.advanceTimersByTimeAsync(100);
    expect(run).toHaveBeenCalledTimes(1);

    scheduler.schedule();
    scheduler.schedule();
    await vi.advanceTimersByTimeAsync(100);
    expect(run).toHaveBeenCalledTimes(1);

    releaseScan();
    await vi.runOnlyPendingTimersAsync();
    expect(run).toHaveBeenCalledTimes(2);

    scheduler.dispose();
  });
});
