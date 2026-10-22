// Web Worker harness (SPEC §9.5): heavy work (bots, puzzle generation) runs
// off the main thread with a time budget, so the UI never freezes. A worker
// that overruns its budget is terminated and the caller gets an error.

interface Request {
  input: unknown;
  /** Milliseconds the worker should aim to finish within. */
  budgetMs: number;
}

type Reply = { ok: true; value: unknown } | { ok: false; error: string };

export class WorkerTimeoutError extends Error {}

/**
 * Runs one task in a fresh worker and resolves with its raw answer; validate
 * or narrow it at the call site. Bundlers need the `new Worker(new URL(…))`
 * expression written at the call site, hence the factory.
 */
export function runInWorker(
  createWorker: () => Worker,
  input: unknown,
  { budgetMs, graceMs = 1000 }: { budgetMs: number; graceMs?: number },
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const worker = createWorker();
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new WorkerTimeoutError(`Worker exceeded ${String(budgetMs + graceMs)} ms`));
    }, budgetMs + graceMs);
    worker.onmessage = (event: MessageEvent<Reply>) => {
      clearTimeout(timer);
      worker.terminate();
      if (event.data.ok) resolve(event.data.value);
      else reject(new Error(event.data.error));
    };
    worker.onerror = (event) => {
      clearTimeout(timer);
      worker.terminate();
      reject(new Error(event.message));
    };
    worker.postMessage({ input, budgetMs } satisfies Request);
  });
}

/**
 * Worker side: answers each request with `handler(input, deadline)`, where
 * `deadline` is a `performance.now()` value to finish by. Messages are data
 * from outside the worker, so the handler validates `input`.
 */
export function serveWorker(handler: (input: unknown, deadline: number) => unknown): void {
  self.onmessage = async (event: MessageEvent<Request>) => {
    const deadline = performance.now() + event.data.budgetMs;
    let reply: Reply;
    try {
      reply = { ok: true, value: await handler(event.data.input, deadline) };
    } catch (e) {
      reply = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    self.postMessage(reply);
  };
}
