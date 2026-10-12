import handler from "./.open-next/worker.js";
const worker = {
  fetch: handler.fetch,
  async scheduled(event, env, ctx) {
    if (!env.CRON_SECRET || !env.APP_URL)
      throw Error("Missing cron configuration");
    const invoiceJob = event.cron !== "0 6 * * *";
    if (invoiceJob && env.INVOICING_PROVIDER !== "fic") return;
    // Invoke the same protected Next route in this Worker, with its bindings and request context.
    const request = new Request(
      new URL(
        invoiceJob ? "/api/cron/invoicing" : "/api/cron/reminders",
        env.APP_URL,
      ),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
      },
    );
    const response = await handler.fetch(request, env, ctx);
    if (!response.ok) throw Error(`Scheduled job failed (${response.status})`);
  },
};
export default worker;
