// Plate materials and preload presets for the bolted joint calculator (SI: MPa).

export interface PlateMaterial {
  id: string;
  label: string;
  sy: number; // yield strength, MPa
  su: number; // ultimate tensile strength, MPa
  e: number; // Young's modulus, MPa
  note?: string;
}

export const CUSTOM_MATERIAL_ID = "custom";

const KSI = 6.894757293168;
const STEEL_E = 207000;

export const PLATE_MATERIALS: PlateMaterial[] = [
  { id: "a36", label: "ASTM A36", sy: 250, su: 400, e: STEEL_E },
  { id: "44w", label: "CSA G40.21 44W (300W)", sy: 300, su: 450, e: STEEL_E },
  { id: "350w", label: "CSA G40.21 350W", sy: 350, su: 450, e: STEEL_E },
  { id: "a572-50", label: "ASTM A572 Grade 50", sy: 345, su: 450, e: STEEL_E },
  { id: "100ksi", label: "100 ksi plate (A514 / A709-100)", sy: 100 * KSI, su: 110 * KSI, e: STEEL_E },
  { id: "quard-400", label: "Quard 400 (typical)", sy: 1000, su: 1250, e: STEEL_E, note: "Typical values; yield is not guaranteed in the data sheet." },
  { id: "quard-450", label: "Quard 450 (typical)", sy: 1200, su: 1400, e: STEEL_E, note: "Typical values; yield is not guaranteed in the data sheet." },
  { id: "ss304", label: "Stainless 304 (annealed)", sy: 215, su: 505, e: 193000 },
  { id: "al6061", label: "Aluminum 6061-T6", sy: 276, su: 310, e: 68900 },
];

export function findPlateMaterial(id: string): PlateMaterial | undefined {
  return PLATE_MATERIALS.find((material) => material.id === id);
}

export interface NutFactorPreset {
  id: string;
  label: string;
  k: number;
}

// Torque coefficients for T = K Fi d (Shigley Table 8-15).
export const NUT_FACTORS: NutFactorPreset[] = [
  { id: "black", label: "Non-plated, black finish", k: 0.3 },
  { id: "zinc", label: "Zinc-plated", k: 0.2 },
  { id: "lube", label: "Lubricated", k: 0.18 },
  { id: "cadmium", label: "Cadmium-plated", k: 0.16 },
  { id: "antiseize", label: "Anti-seize compound", k: 0.12 },
];

export interface ScatterPreset {
  id: string;
  label: string;
  fraction: number; // ± variation about the nominal preload
}

// Typical preload scatter by tightening method (see VDI 2230 tightening factor, Bickford).
export const SCATTER_PRESETS: ScatterPreset[] = [
  { id: "torque", label: "Torque wrench (±25 %)", fraction: 0.25 },
  { id: "torque-lube", label: "Torque, lubricated / calibrated (±15 %)", fraction: 0.15 },
  { id: "turn", label: "Turn-of-nut / tension-indicating washers (±10 %)", fraction: 0.1 },
  { id: "tension", label: "Direct tension / hydraulic (±5 %)", fraction: 0.05 },
];

export const CUSTOM_SCATTER_ID = "custom";
