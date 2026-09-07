/** Simple async mutex — serialize overlapping agent ticks. */
let chain: Promise<void> = Promise.resolve();

export async function withMutex<T>(fn: () => Promise<T>): Promise<T> {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const prev = chain;
  chain = chain.then(() => gate);
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}
