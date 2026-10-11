"use client";
import { forwardRef } from "react";
import { Select, type SelectProps } from "@/components/arc/select/select";
// Arc forwards the ref to its native trigger but only accepts Root props.
// Attach the validation state to that trigger without changing vendor source.
export const SelectField = forwardRef<
  HTMLButtonElement,
  SelectProps & { error?: string }
>(function SelectField({ error, description, ...props }, ref) {
  return (
    <>
      <Select
        {...props}
        description={error || description}
        ref={(element) => {
          element?.setAttribute("aria-invalid", error ? "true" : "false");
          if (typeof ref === "function") ref(element);
          else if (ref) ref.current = element;
        }}
      />
      {error && (
        <p role="alert" className="sr-only">
          {error}
        </p>
      )}
    </>
  );
});
