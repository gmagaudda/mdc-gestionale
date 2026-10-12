"use client";
import { Button } from "@/components/arc/button/button";
import { useOnlineStatus } from "@/lib/pwa/online";
import type { ComponentProps } from "react";
export function WriteButton({
  disabled,
  ...props
}: ComponentProps<typeof Button>) {
  const online = useOnlineStatus();
  return (
    <Button
      {...props}
      data-business-write="true"
      disabled={disabled || !online}
    />
  );
}
