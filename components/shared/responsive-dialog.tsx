"use client";
import type { ReactNode, ReactElement, ComponentPropsWithoutRef } from "react";
import * as Primitive from "@radix-ui/react-dialog";
import { useTranslations } from "next-intl";
const Dialog = Primitive.Root;
const DialogTrigger = Primitive.Trigger;
const DialogClose = Primitive.Close;
import { Button } from "@/components/arc/button/button";

// The current Arc Dialog registry uses an unsupported Radix render prop and
// hardcodes English labels. Use its underlying primitive with Arc controls/tokens.
export function ResponsiveDialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  busy = false,
  ...props
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: ReactElement;
  title: string;
  description?: string;
  children: ReactNode;
  busy?: boolean;
} & Omit<
  ComponentPropsWithoutRef<typeof Primitive.Content>,
  "title" | "children"
>) {
  const t = useTranslations("common");
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) onOpenChange(value);
      }}
    >
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <Primitive.Portal>
        <Primitive.Overlay className="dialog-overlay" />
        <Primitive.Content
          {...props}
          className="responsive-dialog stack"
          aria-describedby={description ? undefined : props["aria-describedby"]}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
            // Let an open combobox dismiss its own menu before this dialog.
            if (
              event.target instanceof HTMLElement &&
              event.target.closest('[role="combobox"][aria-expanded="true"]')
            )
              event.preventDefault();
            props.onEscapeKeyDown?.(event);
          }}
          onPointerDownOutside={(event) => {
            if (busy) event.preventDefault();
            props.onPointerDownOutside?.(event);
          }}
        >
          <header className="dialog-heading">
            <Primitive.Title className="dialog-title">{title}</Primitive.Title>
            <DialogClose asChild>
              <Button variant="ghost" size="lg" disabled={busy}>
                {t("close")}
              </Button>
            </DialogClose>
          </header>
          {description && (
            <Primitive.Description>{description}</Primitive.Description>
          )}
          {children}
        </Primitive.Content>
      </Primitive.Portal>
    </Dialog>
  );
}
