import { useId } from "react";
import type { ReactNode } from "react";

// Option interface for generic select items
export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}

// Props interface matching your UnitInput conventions
interface SelectInputProps<T extends string = string> {
  label?: string;
  "aria-label"?: string;
  value: T;
  options?: Array<SelectOption<T>>;
  children?: ReactNode;
  onChange: (value: T) => void;
  description?: string;
  disabled?: boolean;
  className?: string;
}

// Reusable controlled select component
export function SelectInput<T extends string = string>({
  label,
  value,
  options,
  children,
  onChange,
  description,
  disabled = false,
  className = "",
}: SelectInputProps<T>) {
  const generatedId = useId();
  const selectId = `select-input-${generatedId}`;

  return (
    <div className={className}>
      <label htmlFor={selectId} className="label-input">
        {label}
      </label>
      <div className="relative">
        <select
          id={selectId}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value as T)}
          className={`box-input font-sans !pr-1 ${disabled ? "cursor-not-allowed opacity-60" : ""
            }`}
        >
          {children ?? options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
        </select>
      </div>
      {description ? (
        <p className="mt-1 text-[11px] text-slate-400">{description}</p>
      ) : null}
    </div>
  );
}
