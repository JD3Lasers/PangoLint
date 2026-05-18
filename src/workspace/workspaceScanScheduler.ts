export interface WorkspaceScanScheduler {
  schedule(): void;
  dispose(): void;
}

export interface WorkspaceScanSchedulerOptions {
  delayMs?: number;
}

export function createWorkspaceScanScheduler(
  runScan: () => Promise<void>,
  options: WorkspaceScanSchedulerOptions = {},
): WorkspaceScanScheduler {
  const delayMs = options.delayMs ?? 250;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let pending = false;
  let disposed = false;

  const clearPendingTimer = (): void => {
    if (!timer) return;
    clearTimeout(timer);
    timer = undefined;
  };

  const start = async (): Promise<void> => {
    timer = undefined;
    if (disposed) return;
    if (running) {
      pending = true;
      return;
    }

    running = true;
    try {
      await runScan();
    } finally {
      running = false;
      if (pending && !disposed) {
        pending = false;
        schedule();
      }
    }
  };

  const schedule = (): void => {
    if (disposed) return;
    if (running) {
      pending = true;
      return;
    }
    clearPendingTimer();
    timer = setTimeout(() => {
      void start();
    }, delayMs);
  };

  return {
    schedule,
    dispose: () => {
      disposed = true;
      pending = false;
      clearPendingTimer();
    },
  };
}
