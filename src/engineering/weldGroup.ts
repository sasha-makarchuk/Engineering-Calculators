// Engineering-only module: all weld mathematics is kept independent from React.
import { toBase, fromBase, type UnitSystem } from "./units";

// Supported weld-group shapes shared by the UI and calculation engine.
export type WeldPattern =
  | "single"
  | "two_vert"
  | "two_horiz"
  | "l_shape"
  | "u_shape"
  | "rect"
  | "circle"
  | "t_shape";

// Public calculator input model; nullable fields allow an input to be temporarily blank.
export interface WeldInput {
  unitSystem: UnitSystem;
  pattern: WeldPattern;
  h: number | null;
  b: number | null;
  d: number | null;
  Fx: number | null;
  Fy: number | null;
  Fz: number | null;
  xL: number | null;
  yL: number | null;
  zL: number | null;
  Mx: number | null;
  My: number | null;
  Mz: number | null;
  tauAllow: number | null;
  xCustom: number | null;
  yCustom: number | null;
}

// Internal validated input model expressed entirely in canonical base units.
interface BaseWeldInput {
  h: number;
  b: number;
  d: number;
  Fx: number;
  Fy: number;
  Fz: number;
  xL: number;
  yL: number;
  zL: number;
  Mx: number;
  My: number;
  Mz: number;
  tauAllow: number;
  xCustom: number;
  yCustom: number;
}

// Named evaluation point used for stress calculations and diagram labels.
export interface WeldPoint {
  name: string;
  x: number;
  y: number;
}

// Line segment describing part of the weld geometry.
export interface WeldSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// Calculated weld-group geometry and line-property values.
export interface WeldGeometry {
  unitLength: number;
  centroidX: number;
  centroidY: number;
  ixUnit: number;
  iyUnit: number;
  jUnit: number;
  segments: WeldSegment[];
  points: WeldPoint[];
  circular: boolean;
}

// Stress components evaluated at one point.
export interface WeldStressResult extends WeldPoint {
  tauPrimeX: number;
  tauPrimeY: number;
  tauPrimeZ: number;
  tauDoubleX: number;
  tauDoubleY: number;
  tauDoubleZ: number;
  tauX: number;
  tauY: number;
  tauZ: number;
  tauTotal: number;
}

// Complete result object returned to the React UI.
export interface WeldResult {
  geometry: WeldGeometry;
  throat: number;
  area: number;
  ix: number;
  iy: number;
  j: number;
  load: { fx: number; fy: number; fz: number; mx: number; my: number; mz: number };
  stresses: WeldStressResult[];
  maxStress: number;
  maxPoint: string;
  allowableStress: number;
  factorOfSafety: number;
  safe: boolean;
  customPointIncluded: boolean;
}

// Standard structure for input-validation problems.
export interface ValidationError {
  field: keyof WeldInput;
  message: string;
}

// Validate required dimensions and optional numeric inputs before calculation.
export function validateWeldInput(input: WeldInput): ValidationError[] {
  const errors: ValidationError[] = [];
  const positive = [
    ["h", input.h],
    ["b", input.b],
    ["tauAllow", input.tauAllow],
  ] as const;

  for (const [field, value] of positive) {
    if (value === null || !Number.isFinite(value) || value <= 0) {
      errors.push({ field, message: "Must be greater than zero." });
    }
  }

  if (input.pattern !== "circle" && (input.d === null || !Number.isFinite(input.d) || input.d <= 0)) {
    errors.push({ field: "d", message: "Must be greater than zero." });
  }

  const realFields: (keyof WeldInput)[] = ["Fx", "Fy", "Fz", "xL", "yL", "zL", "Mx", "My", "Mz", "xCustom", "yCustom"];
  for (const field of realFields) {
    const value = input[field];
    if (value !== null && !Number.isFinite(value)) {
      errors.push({ field, message: "Must be a finite number." });
    }
  }

  if (errors.some((error) => error.field === "b" || error.field === "d" || error.field === "h")) {
    return errors;
  }

  if (input.pattern === "single" && input.d! <= 0) {
    errors.push({ field: "d", message: "Must be greater than zero." });
  }

  return errors;
}

// Convert a nullable UI value into a guaranteed numeric value or throw an error.
function requireNumber(value: number | null, field: string): number {
  if (value === null || !Number.isFinite(value)) throw new Error(`Missing or invalid input: ${field}`);
  return value;
}

// Normalize all user inputs into the canonical internal units.
function toBaseInput(input: WeldInput): BaseWeldInput {
  const u = input.unitSystem;
  // Package the complete calculation result for the UI and diagram.
  return {
    h: toBase(requireNumber(input.h, "h"), "length", u),
    b: toBase(requireNumber(input.b, "b"), "length", u),
    d: toBase(requireNumber(input.d ?? 0, "d"), "length", u),
    Fx: toBase(input.Fx ?? 0, "force", u),
    Fy: toBase(input.Fy ?? 0, "force", u),
    Fz: toBase(input.Fz ?? 0, "force", u),
    xL: toBase(input.xL ?? 0, "length", u),
    yL: toBase(input.yL ?? 0, "length", u),
    zL: toBase(input.zL ?? 0, "length", u),
    Mx: toBase(input.Mx ?? 0, "moment", u),
    My: toBase(input.My ?? 0, "moment", u),
    Mz: toBase(input.Mz ?? 0, "moment", u),
    tauAllow: toBase(requireNumber(input.tauAllow, "tauAllow"), "stress", u),
    xCustom: toBase(input.xCustom ?? 0, "length", u),
    yCustom: toBase(input.yCustom ?? 0, "length", u),
  };
}

// Build geometry and line properties for the selected weld pattern.
function geometryForPattern(pattern: WeldPattern, b: number, d: number): WeldGeometry {
  let unitLength = 0;
  let centroidX = 0;
  let centroidY = 0;
  let ixUnit = 0;
  let iyUnit = 0;
  let jUnit = 0;
  let points: WeldPoint[] = [];
  let segments: WeldSegment[] = [];
  let circular = false;

  // Each case below implements one supported weld-pattern geometry.
  switch (pattern) {
    case "single":
      unitLength = d;
      centroidX = 0;
      centroidY = d / 2;
      ixUnit = d ** 3 / 12;
      iyUnit = 0;
      jUnit = ixUnit;
      points = [{ name: "Bottom", x: 0, y: 0 }, { name: "Top", x: 0, y: d }];
      segments = [{ x1: 0, y1: 0, x2: 0, y2: d }];
      break;
    case "two_vert":
      unitLength = 2 * d;
      centroidX = b / 2;
      centroidY = d / 2;
      ixUnit = d ** 3 / 6;
      iyUnit = b ** 2 * d / 2;
      jUnit = ixUnit + iyUnit;
      points = [
        { name: "BL", x: 0, y: 0 }, { name: "TL", x: 0, y: d },
        { name: "BR", x: b, y: 0 }, { name: "TR", x: b, y: d },
      ];
      segments = [{ x1: 0, y1: 0, x2: 0, y2: d }, { x1: b, y1: 0, x2: b, y2: d }];
      break;
    case "two_horiz":
      unitLength = 2 * b;
      centroidX = b / 2;
      centroidY = d / 2;
      ixUnit = b * d ** 2 / 2;
      iyUnit = b ** 3 / 6;
      jUnit = ixUnit + iyUnit;
      points = [
        { name: "BL", x: 0, y: 0 }, { name: "BR", x: b, y: 0 },
        { name: "TL", x: 0, y: d }, { name: "TR", x: b, y: d },
      ];
      segments = [{ x1: 0, y1: 0, x2: b, y2: 0 }, { x1: 0, y1: d, x2: b, y2: d }];
      break;
    case "l_shape":
      unitLength = b + d;
      centroidX = b ** 2 / (2 * (b + d));
      centroidY = d ** 2 / (2 * (b + d));
      ixUnit = (d ** 3 * (4 * b + d)) / (12 * (b + d));
      iyUnit = (b ** 3 * (4 * d + b)) / (12 * (b + d));
      jUnit = ixUnit + iyUnit;
      points = [
        { name: "Corner", x: 0, y: 0 },
        { name: "Horiz End", x: b, y: 0 },
        { name: "Vert End", x: 0, y: d },
      ];
      segments = [{ x1: 0, y1: d, x2: 0, y2: 0 }, { x1: 0, y1: 0, x2: b, y2: 0 }];
      break;
    case "u_shape":
      unitLength = 2 * b + d;
      centroidX = b ** 2 / (2 * b + d);
      centroidY = d / 2;
      ixUnit = d ** 2 * (6 * b + d) / 12;
      iyUnit = (2 * b ** 3 / 3) - b ** 4 / (2 * b + d);
      jUnit = ixUnit + iyUnit;
      points = [
        { name: "BL", x: 0, y: 0 }, { name: "TL", x: 0, y: d },
        { name: "BR", x: b, y: 0 }, { name: "TR", x: b, y: d },
      ];
      segments = [
        { x1: 0, y1: d, x2: 0, y2: 0 },
        { x1: 0, y1: 0, x2: b, y2: 0 },
        { x1: b, y1: 0, x2: b, y2: d },
      ];
      break;
    case "rect":
      unitLength = 2 * b + 2 * d;
      centroidX = b / 2;
      centroidY = d / 2;
      ixUnit = d ** 2 * (3 * b + d) / 6;
      iyUnit = b ** 2 * (3 * d + b) / 6;
      jUnit = ixUnit + iyUnit;
      points = [
        { name: "BL", x: 0, y: 0 }, { name: "BR", x: b, y: 0 },
        { name: "TL", x: 0, y: d }, { name: "TR", x: b, y: d },
      ];
      segments = [
        { x1: 0, y1: 0, x2: b, y2: 0 },
        { x1: b, y1: 0, x2: b, y2: d },
        { x1: b, y1: d, x2: 0, y2: d },
        { x1: 0, y1: d, x2: 0, y2: 0 },
      ];
      break;
    case "circle":
      unitLength = Math.PI * b;
      centroidX = b / 2;
      centroidY = b / 2;
      ixUnit = Math.PI * b ** 3 / 8;
      iyUnit = ixUnit;
      jUnit = Math.PI * b ** 3 / 4;
      circular = true;
      points = [
        { name: "Bottom", x: b / 2, y: 0 },
        { name: "Top", x: b / 2, y: b },
        { name: "Left", x: 0, y: b / 2 },
        { name: "Right", x: b, y: b / 2 },
      ];
      break;
    case "t_shape":
      unitLength = b + d;
      centroidX = b / 2;
      centroidY = (d ** 2 + 2 * b * d) / (2 * (b + d));
      ixUnit = d ** 3 * (4 * b + d) / (12 * (b + d));
      iyUnit = b ** 3 / 12;
      jUnit = ixUnit + iyUnit;
      points = [
        { name: "TL", x: 0, y: d }, { name: "TR", x: b, y: d },
        { name: "Bottom", x: b / 2, y: 0 },
      ];
      segments = [{ x1: 0, y1: d, x2: b, y2: d }, { x1: b / 2, y1: 0, x2: b / 2, y2: d }];
      break;
  }

  return { unitLength, centroidX, centroidY, ixUnit, iyUnit, jUnit, points, segments, circular };
}

// Main engineering pipeline: validate, normalize units, calculate geometry/stress, and evaluate safety.
export function calculateWeldGroup(input: WeldInput): WeldResult {
  const validation = validateWeldInput(input);
  if (validation.length) throw new Error(validation.map((item) => `${item.field}: ${item.message}`).join(" "));

  const base = toBaseInput(input);
  const geometry = geometryForPattern(input.pattern, base.b, input.pattern === "circle" ? base.b : base.d);
  const throat = 0.7071 * base.h;
  const area = geometry.unitLength * throat;
  const ix = geometry.ixUnit * throat;
  const iy = geometry.iyUnit * throat;
  const j = geometry.jUnit * throat;

  if (area <= 0 || j <= 0) throw new Error("The weld geometry produces a zero or invalid section property.");

  // Position vector from the weld-group centroid to the load application point.
  const rx = base.xL - geometry.centroidX;
  const ry = base.yL - geometry.centroidY;
  const rz = base.zL;

  // Combine directly applied moments with moments induced by the offset force, r × F.
  const mxTotal = base.Mx + (ry * base.Fz - rz * base.Fy);
  const myTotal = base.My + (rz * base.Fx - rx * base.Fz);
  const mzTotal = base.Mz + (rx * base.Fy - ry * base.Fx);

  // Direct stress components from force divided by weld area.
  const tauPrimeX = base.Fx / area;
  const tauPrimeY = base.Fy / area;
  const tauPrimeZ = base.Fz / area;

  const customIncluded = base.xCustom !== 0 || base.yCustom !== 0;
  const points = customIncluded
    ? [...geometry.points, { name: "Custom", x: base.xCustom, y: base.yCustom }]
    : geometry.points;

  // Calculate the complete stress vector at every evaluation point.
  const stresses: WeldStressResult[] = points.map((point) => {
    const dx = point.x - geometry.centroidX;
    const dy = point.y - geometry.centroidY;

    const tauDoubleX = -(mzTotal * dy) / j;
    const tauDoubleY = (mzTotal * dx) / j;
    const tauDoubleZ =
      (ix > 0 ? (mxTotal * dy) / ix : 0) -
      (iy > 0 ? (myTotal * dx) / iy : 0);

    const tauX = tauPrimeX + tauDoubleX;
    const tauY = tauPrimeY + tauDoubleY;
    const tauZ = tauPrimeZ + tauDoubleZ;
    const tauTotal = Math.sqrt(tauX ** 2 + tauY ** 2 + tauZ ** 2);

    return {
      ...point,
      tauPrimeX,
      tauPrimeY,
      tauPrimeZ,
      tauDoubleX,
      tauDoubleY,
      tauDoubleZ,
      tauX,
      tauY,
      tauZ,
      tauTotal,
    };
  });

  // Identify the point with the largest resultant stress.
  const maxStressResult = stresses.reduce((max, item) => item.tauTotal > max.tauTotal ? item : max, stresses[0]!);
  const factorOfSafety = base.tauAllow / (maxStressResult.tauTotal || 1);

  return {
    geometry: { ...geometry, points },
    throat,
    area,
    ix,
    iy,
    j,
    load: { fx: base.Fx, fy: base.Fy, fz: base.Fz, mx: mxTotal, my: myTotal, mz: mzTotal },
    stresses,
    maxStress: maxStressResult.tauTotal,
    maxPoint: maxStressResult.name,
    allowableStress: base.tauAllow,
    factorOfSafety,
    safe: factorOfSafety >= 1,
    customPointIncluded: customIncluded,
  };
}

// Format numerical output consistently for display.
export function formatResultNumber(value: number, decimals = 2): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

// Convert a base-unit result to display units and append its unit label.
export function displayResultValue(value: number, quantity: "length" | "force" | "moment" | "stress", system: UnitSystem, decimals = 2): string {
  return `${formatResultNumber(fromBase(value, quantity, system), decimals)} ${quantity === "moment" && system === "imperial" ? "lbf-in" : quantity === "stress" && system === "imperial" ? "psi" : quantity === "stress" ? "MPa" : quantity === "force" ? (system === "imperial" ? "lbf" : "N") : system === "imperial" ? "in" : "mm"}`;
}
