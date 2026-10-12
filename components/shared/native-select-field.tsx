"use client";
import { useId } from "react";
import type { Choice } from "./search-select";
// Native selection handles unbounded identifiers without a clipped portal menu.
export function NativeSelectField({
  id,
  label,
  value,
  onValueChange,
  options,
  disabled,
  error,
  description,
  placeholder,
}: {
  id?: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Choice[];
  disabled?: boolean;
  error?: string;
  description?: string;
  placeholder: string;
}) {
  const generated = useId(),
    controlId = id ?? generated,
    hintId = `${controlId}-description`;
  const chosen = options.find((item) => item.value === value);
  return (
    <div className="native-select-field">
      <label htmlFor={controlId}>{label}</label>
      <select
        id={controlId}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error || description ? hintId : undefined}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {(error || description) && (
        <p id={hintId} role={error ? "alert" : undefined}>
          {error || description}
        </p>
      )}
      {chosen && <p className="wrap-value">{chosen.label}</p>}
    </div>
  );
}
