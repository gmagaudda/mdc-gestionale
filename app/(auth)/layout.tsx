import { ThemeControls } from "@/components/shared/theme-controls";
import { PwaStatus } from "@/components/pwa/pwa-status";
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-container stack">
      <main className="stack">
        <PwaStatus />
        {children}
      </main>
      <footer>
        <ThemeControls />
      </footer>
    </div>
  );
}
