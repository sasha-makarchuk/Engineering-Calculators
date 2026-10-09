import { useEffect, useId, useRef, useState } from "react";
import type { UnitQuantity, UnitSystem } from "../engineering/units";
import { useUnitSystem } from "./units/UnitContext";
import { formatSignificantFigures, getUnitLabel } from "../engineering/units";

// Props for a reusable unit-aware numeric input.
interface UnitInputProps {
  label: string;
  quantity: UnitQuantity;
  value: number | null;
  onChange: (value: number | null) => void;
  step?: number;
  min?: number;
  description?: string;
  disabled?: boolean;
  className?: string;
}

// Reusable controlled input for lengths, forces, moments, and stresses.
export function UnitInput({
  label,
  quantity,
  value,
  onChange,
  step,
  min,
  description,
  disabled = false,
  className = "",
}: UnitInputProps) {
  // Read the global unit system so every input uses the same display units.
  const { unitSystem } = useUnitSystem();
  const generatedId = useId();
  const inputId = `unit-input-${generatedId}`;

  const [inputText, setInputText] = useState<string>(() => value === null ? "" : String(value));
  const previousUnitSystem = useRef<UnitSystem>(unitSystem);

  // Format the input text only when the unit system changes.
  // The numeric value in the parent remains at full available precision.
  useEffect(() => {
      if (previousUnitSystem.current !== unitSystem) {
          setInputText(value === null ? "" : formatSignificantFigures(value, 4));
          previousUnitSystem.current = unitSystem;
      }
  }, [unitSystem, value]);

  // Look up the unit label shown beside the value.
  const unit = getUnitLabel(quantity, unitSystem);
  // Basic client-side validation for finite values and minimum limits.
  const invalid = value !== null && !Number.isFinite(value) ? true : value !== null && min !== undefined && value < min;

  // Render the label, numeric field, unit suffix, and validation/help text.
  return (
    <div className={className}>
      <label htmlFor={inputId} className="label-input">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type="number"
          inputMode="decimal"
          value = { inputText }
          onChange={(event) => {
            const raw = event.target.value;
            setInputText(raw);
            if (raw === "") { onChange(null); return; }
            const parsedValue = Number(raw);
            onChange(Number.isFinite(parsedValue) ? parsedValue : null);
          }}
          step={step}
          min={min}
          disabled={disabled}
          aria-invalid={invalid}
          className={`box-input ${invalid ? "box-input-error" : ""} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
        />
        <span className="pointer-events-none absolute right-3 top-2 text-xs text-slate-400">{unit}</span>
      </div>
      {invalid ? <p className="mt-1 text-[10px] font-medium text-red-600">Enter a value {min !== undefined ? `≥ ${min}` : "that is finite"}.</p> : null}
      {description ? <p className="mt-1 text-[11px] text-slate-400">{description}</p> : null}
    </div>
  );
}
