export interface OscPortLockOptions {
  listenHost: string;
  listenPort: number;
}

const oscPortLocks = new Map<string, Promise<void>>();

export async function acquireOscPortLock(options: OscPortLockOptions): Promise<() => void> {
  const key = `${options.listenHost}:${options.listenPort}`;
  const previous = oscPortLocks.get(key) ?? Promise.resolve();
  let releaseTail!: () => void;
  const tail = new Promise<void>((resolve) => {
    releaseTail = resolve;
  });
  const next = previous.catch(() => undefined).then(() => tail);
  oscPortLocks.set(key, next);

  await previous.catch(() => undefined);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    releaseTail();
    if (oscPortLocks.get(key) === next) {
      oscPortLocks.delete(key);
    }
  };
}

export async function withOscPortLock<T>(options: OscPortLockOptions, operation: () => Promise<T>): Promise<T> {
  const release = await acquireOscPortLock(options);
  try {
    return await operation();
  } finally {
    release();
  }
}
