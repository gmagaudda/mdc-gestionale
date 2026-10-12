export type ImportCell = string | number | boolean | null | { error: string };
export type ParsedSheet = {
  name: string;
  rows: { number: number; values: ImportCell[] }[];
};
export type ParsedWorkbook = {
  sheets: ParsedSheet[];
  rowCount: number;
  durationMs: number;
};
export function parseImportFile(
  file: File,
  signal?: AbortSignal,
): Promise<ParsedWorkbook> {
  return new Promise((resolve, reject) => {
    const worker = new Worker("/import-worker.js"),
      id = crypto.randomUUID();
    const done = () => {
      worker.terminate();
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    };
    const abort = () => {
      done();
      reject(new Error("cancelled"));
    };
    const timer = setTimeout(() => {
      done();
      reject(new Error("parseTimeout"));
    }, 30000);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) {
      abort();
      return;
    }
    worker.onerror = () => {
      done();
      reject(new Error("parseError"));
    };
    worker.onmessage = ({ data }) => {
      if (data.id !== id) return;
      done();
      if (data.ok)
        resolve({
          sheets: data.sheets,
          rowCount: data.rowCount,
          durationMs: data.durationMs,
        });
      else reject(new Error(data.error));
    };
    file
      .arrayBuffer()
      .then((buffer) => {
        if (signal?.aborted) return;
        worker.postMessage({ id, buffer, filename: file.name }, [buffer]);
      })
      .catch(() => {
        done();
        reject(new Error("parseError"));
      });
  });
}
