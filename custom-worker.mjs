import handler from "./.open-next/worker.js";
const worker = {
  fetch: handler.fetch,
  async scheduled(event, env, ctx) {
    if (!env.CRON_SECRET || !env.APP_URL)
      throw Error("Missing cron configuration");
    const invoiceJob = event.cron !== "0 6 * * *";
    if (invoiceJob && env.INVOICING_PROVIDER !== "fic") return;
    // Invoke the same protected Next route in this Worker, with its bindings and request context.
    const paths = invoiceJob
      ? ["/api/cron/invoicing"]
      : ["/api/cron/reminders", "/api/cron/imports"];
    const results = await Promise.allSettled(
      paths.map(async (path) => {
        const request = new Request(new URL(path, env.APP_URL), {
          method: "POST",
          headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
        });
        const response = await handler.fetch(request, env, ctx);
        if (!response.ok)
          throw Error(`Scheduled job failed (${response.status})`);
      }),
    );
    if (results.some((r) => r.status === "rejected"))
      throw Error("One or more scheduled jobs failed");
  },
};
export default worker;
