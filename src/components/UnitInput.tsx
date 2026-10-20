import { useEffect, useId, useRef, useState } from "react";
import type { UnitQuantity, UnitSystem } from "../engineering/units";
import { useUnitSystem } from "./units/UnitContext";
import { formatSignificantFigures, getUnitLabel, fromBase, toBase } from "../engineering/units";

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
  /** Display a standard value with a reset control when value is an override. */
  showStandard?: boolean;
  /** Standard value; base units when valueIsBase is enabled, display units otherwise. */
  standardValue?: number;
  /** Treat value and standardValue as SI base values and convert for display. */
  valueIsBase?: boolean;
  /** Use a page-specific unit system instead of the global display system. */
  unitSystem?: UnitSystem;
  /** Optional suffix for unitless quantities such as percentages. */
  suffix?: string;
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
  showStandard = false,
  standardValue,
  valueIsBase = false,
  unitSystem: unitSystemOverride,
  suffix,
}: UnitInputProps) {
  // Read the global unit system so every input uses the same display units.
  const context = useUnitSystem();
  const unitSystem = unitSystemOverride ?? context.unitSystem;
  const generatedId = useId();
  const inputId = `unit-input-${generatedId}`;

  const [inputText, setInputText] = useState<string | null>(null);
  const previousUnitSystem = useRef<UnitSystem>(unitSystem);

  const toDisplay = (input: number) =>
    valueIsBase ? fromBase(input, quantity, unitSystem) : input;
  const fromDisplay = (input: number) =>
    valueIsBase ? toBase(input, quantity, unitSystem) : input;
  const displayedValue = value === null
    ? (showStandard && standardValue !== undefined ? toDisplay(standardValue) : null)
    : toDisplay(value);
  const shown = inputText ?? (displayedValue === null
    ? ""
    : valueIsBase || showStandard
      ? formatSignificantFigures(displayedValue, 4)
      : String(displayedValue));
  const overridden = showStandard && value !== null;

  // Format the input text only when the unit system changes.
  // The numeric value in the parent remains at full available precision.
  useEffect(() => {
    if (previousUnitSystem.current !== unitSystem) {
      setInputText(null);
      previousUnitSystem.current = unitSystem;
    }
  }, [unitSystem]);

  // Look up the unit label shown beside the value.
  const unit = getUnitLabel(quantity, unitSystem);
  // Basic client-side validation for finite values and minimum limits.
  const invalid = displayedValue !== null && !Number.isFinite(displayedValue)
    ? true
    : displayedValue !== null && min !== undefined && displayedValue < min;

  // Render the label, numeric field, unit suffix, and validation/help text.
  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        className={`label-input ${showStandard ? "flex items-center justify-between" : ""}`}
      >
        <span>{label}</span>
        {showStandard
          ? overridden
            ? (
              <button
                type="button"
                onClick={() => {
                  setInputText(null);
                  onChange(null);
                }}
                className="ml-1 text-[10px] font-medium text-sky-600 hover:text-sky-800"
              >
                reset
              </button>
            )
            : <span className="ml-1 text-[10px] font-normal text-slate-400">standard</span>
          : null}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type="number"
          inputMode="decimal"
          value={shown}
          onChange={(event) => {
            const raw = event.target.value;
            setInputText(raw);
            if (raw === "") {
              onChange(null);
              return;
            }
            const parsedValue = Number(raw);
            onChange(Number.isFinite(parsedValue) ? fromDisplay(parsedValue) : null);
          }}
          onBlur={() => setInputText(null)}
          step={step}
          min={min}
          disabled={disabled}
          aria-invalid={invalid}
          className={`box-input pr-1 ${showStandard && !overridden ? "text-slate-500" : ""} ${invalid ? "box-input-error" : ""} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
        />
        {suffix || unit ? (
          <span className="pointer-events-none absolute right-3 top-2 text-xs text-slate-400">
            {suffix ?? unit}
          </span>
        ) : null}
      </div>
      {invalid ? <p className="mt-1 text-[10px] font-medium text-red-600">Enter a value {min !== undefined ? `≥ ${min}` : "that is finite"}.</p> : null}
      {description ? <p className="mt-1 text-[11px] text-slate-400">{description}</p> : null}
    </div>
  );
}
