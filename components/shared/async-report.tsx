import "server-only";
import { Suspense, type ReactNode } from "react";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
async function Resolved<T>({
  load,
  render,
}: {
  load: Promise<T>;
  render: (value: T) => ReactNode;
}) {
  return render(await load);
}
// Place this below the page's role/scope guards, so a denied request can still
// return its HTTP status before streaming the authorized data region.
export function AsyncReport<T>({
  load,
  render,
  label,
}: {
  load: Promise<T>;
  render: (value: T) => ReactNode;
  label: string;
}) {
  return (
    <Suspense fallback={<Skeleton label={label} lines={8} />}>
      <Resolved load={load} render={render} />
    </Suspense>
  );
}
