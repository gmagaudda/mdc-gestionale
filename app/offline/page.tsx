import { Button } from "@/components/arc/button/button";
import messages from "@/messages/it.json";
export const dynamic = "force-static";
export default function OfflinePage() {
  const t = messages.pwa;
  return (
    <main className="auth-container stack">
      <h1>{t.offlineTitle}</h1>
      <p>{t.offlineDescription}</p>
      <form action="/" method="get">
        <Button size="lg" type="submit">
          {t.retry}
        </Button>
      </form>
    </main>
  );
}
