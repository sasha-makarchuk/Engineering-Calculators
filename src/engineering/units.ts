// Allowed display systems; TypeScript restricts this to these exact values.
export type UnitSystem = "imperial" | "si";

// Physical quantities supported by the shared conversion system.
// "kforce"/"kstress"/"torque" use engineering-friendly display units (kN/kip, MPa/ksi, N-m/lbf-ft).
// "area", "stiffness" and "modulus" were added for the bolted-joint calculator.
export type UnitQuantity =
    | "length"
    | "force"
    | "moment"
    | "stress"
    | "kforce"
    | "kstress"
    | "torque"
    | "area"
    | "stiffness"
    | "modulus"
    | "kmoment"
    | "inertia"
    | "unitless";

// Each unit has a display label and a factor to the internal base unit.
interface UnitDefinition {
    label: string;
    toBase: number;
}

// Define a schema type mapping object keys to engineering unit quantities
export type UnitSchema<T> = {
    [K in keyof T]?: UnitQuantity;
};

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
    // Base unit N (displayed as kN or kip).
    kforce: {
        imperial: { label: "kip", toBase: 4448.2216152605 },
        si: { label: "kN", toBase: 1000 },
    },
    // Base unit MPa (displayed as MPa or ksi).
    kstress: {
        imperial: { label: "ksi", toBase: 6.894757293168 },
        si: { label: "MPa", toBase: 1 },
    },
    // Base unit N-mm (displayed as N-m or lbf-ft).
    torque: {
        imperial: { label: "lbf-ft", toBase: 12 * 25.4 * 4.4482216152605 },
        si: { label: "N-m", toBase: 1000 },
    },
    // Base unit mm².
    area: {
        imperial: { label: "in²", toBase: 25.4 * 25.4 },
        si: { label: "mm²", toBase: 1 },
    },
    // Base unit N/mm (displayed as kN/mm or kip/in).
    stiffness: {
        imperial: { label: "kip/in", toBase: 4448.2216152605 / 25.4 },
        si: { label: "kN/mm", toBase: 1000 },
    },
    // Base unit MPa (displayed as GPa or Msi).
    modulus: {
        imperial: { label: "Msi", toBase: 6894.757293168 },
        si: { label: "GPa", toBase: 1000 },
    },
    // Base unit N-mm (displayed as kN-m or kip-ft).
    kmoment: {
        imperial: { label: "kip-ft", toBase: 12 * 25.4 * 4448.2216152605 },
        si: { label: "kN-m", toBase: 1e6 },
    },
    // Base unit mm⁴ (polar moment of the bolt areas, displayed as mm⁴ or in⁴).
    inertia: {
        imperial: { label: "in⁴", toBase: 25.4 ** 4 },
        si: { label: "mm⁴", toBase: 1 },
    },
    // Base unit mm⁴ (polar moment of the bolt areas, displayed as mm⁴ or in⁴).
    unitless: {
        imperial: { label: "", toBase: 1 },
        si: { label: "", toBase: 1 },
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

// Format a number as a string with the requested significant figures.
// This is for display ONLY: it does not modify the stored numeric value.
export function formatSignificantFigures(
    value: number,
    significantFigures = 4
): string {
    if (!Number.isFinite(value)) return "";
    if (value === 0) return "0";

    if (!Number.isInteger(significantFigures) || significantFigures < 1 || significantFigures > 21) {
        throw new RangeError("Significant figures must be between 1 and 21.");
    }

    // Convert the rounded representation back to a number, then to a string.
    // This removes unnecessary trailing zeros without adding thousands separators.
    return Number(value.toPrecision(significantFigures)).toString();
}

// Expose the underlying conversion table.
export const UNIT_FACTORS = UNIT_DEFINITIONS;

/**
 * Converts all numeric fields in a form state object from one unit system to another.
 * Non-numeric values and fields omitted from the schema are preserved as-is.
 */
export function convertFromState<T extends { unitSystem: UnitSystem }>(
  input: T,
  schema: UnitSchema<T>,
  fromSystem: UnitSystem,
  toSystem: UnitSystem
): T {
  // Return early if systems are identical
  if (fromSystem === toSystem) {
    return input;
  }

  const result = { ...input, unitSystem: toSystem };

  for (const key in schema) {
    const quantity = schema[key];
    const value = input[key];

    if (quantity && typeof value === "number" && Number.isFinite(value)) {
      const baseVal = toBase(value, quantity, fromSystem);
      (result[key] as any) = fromBase(baseVal, quantity, toSystem);
    }
  }

  return result;
}