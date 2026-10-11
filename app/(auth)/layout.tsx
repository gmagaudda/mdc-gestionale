import { ThemeControls } from "@/components/shared/theme-controls";
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-container stack">
      <main className="stack">{children}</main>
      <footer>
        <ThemeControls />
      </footer>
    </div>
  );
}
