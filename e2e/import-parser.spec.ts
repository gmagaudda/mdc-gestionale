import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
test("isolated worker parses 20000 rows without blocking the page", async ({
  page,
  browser,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "Parser benchmark needs one browser instance",
  );
  await page.goto("/login");
  const content = Array.from(
    readFileSync(".fixtures/imports/synthetic-20000.xlsx"),
  );
  const result = await page.evaluate(async (bytes) => {
    const worker = new Worker("/import-worker.js");
    (
      window as unknown as { importBenchmarkWorker: Worker }
    ).importBenchmarkWorker = worker;
    let ticks = 0;
    const interval = setInterval(() => ticks++, 10);
    try {
      return await new Promise<{
        ok: boolean;
        rowCount: number;
        durationMs: number;
        ticks: number;
        first: unknown[];
        last: unknown[];
      }>((resolve, reject) => {
        worker.onerror = (e) => reject(Error(e.message));
        worker.onmessage = ({ data }) => {
          if (!data.ok) {
            reject(Error(data.error));
            return;
          }
          resolve({
            ok: data.ok,
            rowCount: data.rowCount,
            durationMs: data.durationMs,
            ticks,
            first: data.sheets[0].rows[0].values,
            last: data.sheets[0].rows.at(-1).values,
          });
        };
        const buffer = new Uint8Array(bytes).buffer;
        worker.postMessage(
          { id: "benchmark", filename: "synthetic.xlsx", buffer },
          [buffer],
        );
      });
    } finally {
      clearInterval(interval);
    }
  }, content);
  const cdp = await browser.newBrowserCDPSession();
  const targets = await cdp.send("Target.getTargets");
  const target = targets.targetInfos.find(
    (t: { type: string; url: string }) =>
      t.type === "worker" && t.url.endsWith("/import-worker.js"),
  );
  expect(target).toBeDefined();
  if (!target) throw Error("Parser worker target not found");
  const attached = await cdp.send("Target.attachToTarget", {
    targetId: target.targetId,
    flatten: false,
  });
  const memory = await new Promise<{ usedSize: number; totalSize: number }>(
    (resolve, reject) => {
      const timer = setTimeout(
        () => reject(Error("Worker heap measurement timed out")),
        5000,
      );
      cdp.on("Target.receivedMessageFromTarget", (event) => {
        if (event.sessionId !== attached.sessionId) return;
        const message = JSON.parse(event.message);
        if (message.id === 1) {
          clearTimeout(timer);
          if (message.error) reject(Error(message.error.message));
          else resolve(message.result);
        }
      });
      void cdp
        .send("Target.sendMessageToTarget", {
          sessionId: attached.sessionId,
          message: JSON.stringify({ id: 1, method: "Runtime.getHeapUsage" }),
        })
        .catch(reject);
    },
  );
  await cdp.detach();
  await page.evaluate(() =>
    (
      window as unknown as { importBenchmarkWorker: Worker }
    ).importBenchmarkWorker.terminate(),
  );
  expect(memory.usedSize).toBeGreaterThan(0);
  expect(result.rowCount).toBe(20000);
  expect(result.durationMs).toBeLessThan(10000);
  expect(result.ticks).toBeGreaterThan(5);
  expect(result.first[0]).toBe("N0");
  expect(result.last[0]).toBe("N19999");
  writeFileSync(
    info.outputPath("parser-benchmark.json"),
    JSON.stringify({
      ...result,
      retainedWorkerHeapBytes: memory.usedSize,
      allocatedWorkerHeapBytes: memory.totalSize,
    }),
  );
  await info.attach("parser-benchmark", {
    body: JSON.stringify({
      ...result,
      retainedWorkerHeapBytes: memory.usedSize,
      allocatedWorkerHeapBytes: memory.totalSize,
    }),
    contentType: "application/json",
  });
});
test("parser rejects extensions and signatures and only returns saved formula results", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "Parser contracts need one browser instance",
  );
  await page.goto("/login");
  const bytes = Array.from(
    readFileSync(".fixtures/imports/synthetic-performance.xlsx"),
  );
  const results = await page.evaluate(async (bytes) => {
    async function parse(filename: string, bytes: number[]) {
      const worker = new Worker("/import-worker.js");
      try {
        return await new Promise<Record<string, unknown>>((resolve, reject) => {
          worker.onerror = (e) => reject(Error(e.message));
          worker.onmessage = ({ data }) => resolve(data);
          const buffer = new Uint8Array(bytes).buffer;
          worker.postMessage({ id: filename, filename, buffer }, [buffer]);
        });
      } finally {
        worker.terminate();
      }
    }
    return Promise.all([
      parse("bad.xlsm", bytes),
      parse("bad.xlsx", [65, 66, 67, 68]),
      parse("valid.xlsx", bytes),
    ]);
  }, bytes);
  expect(results[0]).toMatchObject({ ok: false, error: "fileType" });
  expect(results[1]).toMatchObject({ ok: false, error: "fileType" });
  expect(results[2].ok).toBe(true);
  expect(JSON.stringify(results[2])).not.toContain("Y3/W3");
  expect(JSON.stringify(results[2])).toContain("Brand sintetico A");
});
test("CSV reports physical source rows, including blanks and quoted newlines", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "Parser contract needs one browser instance",
  );
  await page.goto("/login");
  const result = await page.evaluate(async () => {
    const parse = (text: string) =>
      new Promise<Record<string, unknown>>((resolve) => {
        const worker = new Worker("/import-worker.js");
        worker.onmessage = ({ data }) => {
          worker.terminate();
          resolve(data);
        };
        const buffer = new TextEncoder().encode(text).buffer;
        worker.postMessage({ id: "csv", filename: "test.csv", buffer }, [
          buffer,
        ]);
      });
    return Promise.all([
      parse("x"),
      parse('name,city\r\n\r\n"Negozio\r\nUno",Milano\r\nDue,Roma'),
      parse('a,b\n"broken,b'),
    ]);
  });
  expect(result[0]).toMatchObject({ ok: true, rowCount: 1 });
  expect(result[1]).toMatchObject({
    ok: true,
    sheets: [
      {
        name: "CSV",
        rows: [
          { number: 1, values: ["name", "city"] },
          { number: 3, values: ["Negozio\r\nUno", "Milano"] },
          { number: 5, values: ["Due", "Roma"] },
        ],
      },
    ],
  });
  expect(result[2]).toMatchObject({ ok: false, error: "csvInvalid" });
});
