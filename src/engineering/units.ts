// Allowed display systems; TypeScript restricts this to these exact values.
export type UnitSystem = "imperial" | "si";

// Physical quantities supported by the shared conversion system.
export type UnitQuantity = "length" | "force" | "moment" | "stress";

// Each unit has a display label and a factor to the internal base unit.
interface UnitDefinition {
  label: string;
  toBase: number;
}

// Central unit registry used by both UI and engineering calculations.
const UNIT_DEFINITIONS: Record<UnitQuantity, Record<UnitSystem, UnitDefinition>> = {
  length: {
    imperial: { label: "in", toBase: 25.4 },
    si: { label: "mm", toBase: 1 },
  },
  force: {
    imperial: { label: "lbf", toBase: 4.4482216152605 },
    si: { label: "N", toBase: 1 },
  },
  moment: {
    imperial: { label: "lbf-in", toBase: 25.4 * 4.4482216152605 },
    si: { label: "N-m", toBase: 1000 },
  },
  stress: {
    imperial: { label: "psi", toBase: 0.006894757293168 },
    si: { label: "MPa", toBase: 1 },
  },
};

// Return the human-readable display unit.
export function getUnitLabel(quantity: UnitQuantity, system: UnitSystem): string {
  return UNIT_DEFINITIONS[quantity][system].label;
}

// Convert a displayed value to the canonical internal unit.
export function toBase(value: number, quantity: UnitQuantity, system: UnitSystem): number {
  return value * UNIT_DEFINITIONS[quantity][system].toBase;
}

// Convert a canonical internal value to the selected display unit.
export function fromBase(value: number, quantity: UnitQuantity, system: UnitSystem): number {
  return value / UNIT_DEFINITIONS[quantity][system].toBase;
}

// Convenience conversion directly between the two display systems.
export function convertBetweenSystems(value: number, quantity: UnitQuantity, fromSystem: UnitSystem, toSystem: UnitSystem): number {
  if (fromSystem === toSystem) return value;
  return fromBase(toBase(value, quantity, fromSystem), quantity, toSystem);
}

// Round a converted display value to remove floating-point artifacts.
export function cleanDisplayValue(value: number): number {
    return Number(value.toPrecision(3));;
}

// Expose the underlying conversion table.
export const UNIT_FACTORS = UNIT_DEFINITIONS;
