// Bolt group in-plane shear engine (elastic / vector method).
// SI base units: mm, mm², N, N-mm. Independent of React; the UI converts for display.
//
// Method:
//   1. The pattern centroid is weighted by each bolt's shear area (stiffness in shear scales with area).
//   2. All applied forces and the applied moment are reduced to the centroid.
//   3. Each bolt takes a share of the total force proportional to its area (direct shear) plus a
//      share of the moment proportional to area x distance from the centroid (torsional shear).
//   4. Direct and torsional components are added in x and y.
//
// Sign convention: x to the right, y up, moments positive counter-clockwise. Bolt forces are given in
// the same sense as the applied loads (the load each bolt carries from the loaded plate).

import { loadUnitSchema, type BaseLoadInput, type LoadInput } from "../components/LoadsInputCard";
import { type UnitSystem } from "./units";
import { sizeById } from "../data/fasteners";

export const MAX_BOLTS = 100;

type Weighting = "tensile" | "shank";
export type PatternKind = "rectangle" | "line" | "single";

export interface GroupBolt {
  x: number; // mm
  y: number; // mm
  id: number;
  sizeId: string;
}

export interface BoltPattern {
    type: PatternKind;
    cx: number;
    cy: number;
    dx: number;
    dy: number;
    cols: number;
    rows: number;
}

export interface BoltGroupInput extends BaseLoadInput {
    bolts: GroupBolt[];
    unitSystem: UnitSystem;
    commonOnly: boolean;
    pattern: BoltPattern;
}

export interface BoltForceResult {
  index: number; // 1-based bolt number
  x: number;
  y: number;
  rx: number; // position relative to the centroid
  ry: number;
  area: number;
  fxDirect: number;
  fyDirect: number;
  fxMoment: number;
  fyMoment: number;
  fx: number;
  fy: number;
  resultant: number;
  angleDeg: number; // direction of the resultant, degrees from +x, counter-clockwise
  ratio: number; // resultant / maximum resultant
  isMax: boolean;
}

export interface BoltGroupResult {
  cogX: number;
  cogY: number;
  totalArea: number; // ΣA
  polarMoment: number; // J = ΣA r², mm⁴
  Fx: number;
  Fy: number;
  momentAtCog: number; // N-mm
  bolts: BoltForceResult[];
  maxForce: number;
  maxBolts: number[]; // bolt numbers carrying the maximum resultant
  residualFx: number;
  residualFy: number;
  residualMoment: number;
  equilibriumOk: boolean;
  warnings: string[];
}

function GetBoltArea(sizeId: string): number {
    const size = sizeById(sizeId);
    return size ? (Math.PI * size.d * size.d) / 4 : 0;
}

export function calculateBoltGroup(input: BoltGroupInput): BoltGroupResult {
  const { bolts, Fx = 0, Fy = 0, xL = 0, yL = 0, Mz = 0 } = input;
  if (bolts.length === 0) throw new Error("Add at least one bolt.");
  if (bolts.length > MAX_BOLTS) throw new Error(`A bolt group is limited to ${MAX_BOLTS} bolts.`);
  for (const bolt of bolts) {
    if (![bolt.x, bolt.y].every(Number.isFinite)) {
      throw new Error("Every bolt needs finite coordinates and a positive shear area.");
    }
  }

  const totalArea = bolts.reduce((sum, bolt) => sum + GetBoltArea(bolt.sizeId), 0);
  const cogX = bolts.reduce((sum, bolt) => sum + GetBoltArea(bolt.sizeId) * bolt.x, 0) / totalArea;
  const cogY = bolts.reduce((sum, bolt) => sum + GetBoltArea(bolt.sizeId) * bolt.y, 0) / totalArea;
  const polarMoment = bolts.reduce(
    (sum, bolt) => sum + GetBoltArea(bolt.sizeId) * ((bolt.x - cogX) ** 2 + (bolt.y - cogY) ** 2),
    0,
  );

  // Loads reduced to the centroid.
  const momentAtCog = Mz + (xL - cogX) * Fy - (yL - cogY) * Fx;

  const results: BoltForceResult[] = bolts.map((bolt, i) => {
    const rx = bolt.x - cogX;
    const ry = bolt.y - cogY;
    const share = GetBoltArea(bolt.sizeId) / totalArea;
    const fxDirect = Fx * share;
    const fyDirect = Fy * share;
    const fxMoment = polarMoment > 0 ? (-momentAtCog * GetBoltArea(bolt.sizeId) * ry) / polarMoment : 0;
    const fyMoment = polarMoment > 0 ? (momentAtCog * GetBoltArea(bolt.sizeId) * rx) / polarMoment : 0;
    const fx = fxDirect + fxMoment;
    const fy = fyDirect + fyMoment;
    return {
      index: i + 1,
      d: sizeById(bolt.sizeId)?.d ?? 0,
      x: bolt.x,
      y: bolt.y,
      rx,
      ry,
      area: GetBoltArea(bolt.sizeId),
      fxDirect,
      fyDirect,
      fxMoment,
      fyMoment,
      fx,
      fy,
      resultant: Math.hypot(fx, fy),
      angleDeg: (Math.atan2(fy, fx) * 180) / Math.PI,
      ratio: 0,
      isMax: false,
    };
  });

  const maxForce = results.reduce((max, bolt) => Math.max(max, bolt.resultant), 0);
  for (const bolt of results) {
    bolt.ratio = maxForce > 0 ? bolt.resultant / maxForce : 0;
    bolt.isMax = maxForce > 0 && bolt.resultant >= maxForce * (1 - 1e-9);
  }

  // Equilibrium: the bolt forces must reproduce the applied force and the moment at the centroid.
  const residualFx = results.reduce((sum, bolt) => sum + bolt.fx, 0) - Fx;
  const residualFy = results.reduce((sum, bolt) => sum + bolt.fy, 0) - Fy;
  const residualMoment =
    results.reduce((sum, bolt) => sum + bolt.rx * bolt.fy - bolt.ry * bolt.fx, 0) - momentAtCog;
  const forceTolerance = 1e-6 * (Math.abs(Fx) + Math.abs(Fy) + 1);
  const momentTolerance = 1e-6 * (Math.abs(momentAtCog) + 1);
  const equilibriumOk =
    Math.abs(residualFx) <= forceTolerance &&
    Math.abs(residualFy) <= forceTolerance &&
    Math.abs(residualMoment) <= momentTolerance;

  const warnings: string[] = [];
  if (polarMoment <= 0 && Math.abs(momentAtCog) > momentTolerance) {
    warnings.push("A single bolt (or bolts all at the centroid) cannot resist a moment.");
  }
  const seen = new Set<string>();
  for (const bolt of bolts) {
    const key = `${bolt.x.toFixed(6)},${bolt.y.toFixed(6)}`;
    if (seen.has(key)) {
      warnings.push("Two or more bolts share the same location.");
      break;
    }
    seen.add(key);
  }

  return {
    cogX,
    cogY,
    totalArea,
    polarMoment,
    Fx,
    Fy,
    momentAtCog,
    bolts: results,
    maxForce,
    maxBolts: results.filter((bolt) => bolt.isMax).map((bolt) => bolt.index),
    residualFx,
    residualFy,
    residualMoment,
    equilibriumOk,
    warnings,
  };
}


export function generatePatternBolts(
  pattern: BoltPattern,
  defaultSizeId: string = "M10"
): Array<{ sizeId: string; x: number; y: number }> {
  const bolts: Array<{ sizeId: string; x: number; y: number }> = [];

  switch (pattern.type) {
    case "rectangle": {
      const cols = Math.max(1, pattern.cols || 1);
      const rows = Math.max(1, pattern.rows || 1);
      const startX = pattern.cx - ((cols - 1) * pattern.dx) / 2;
      const startY = pattern.cy - ((rows - 1) * pattern.dy) / 2;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          bolts.push({
            sizeId: defaultSizeId,
            x: startX + c * pattern.dx,
            y: startY + r * pattern.dy,
          });
        }
      }
      break;
    }

    case "line": {
      const count = Math.max(1, pattern.cols || 1);
      const startX = pattern.cx - ((count - 1) * pattern.dx) / 2;

      for (let i = 0; i < count; i++) {
        bolts.push({
          sizeId: defaultSizeId,
          x: startX + i * pattern.dx,
          y: pattern.cy,
        });
      }
      break;
    }

    case "single": {
        bolts.push({
          sizeId: defaultSizeId,
          x: pattern.cx,
          y: pattern.cy,
        });
      }
      break;
  }

  return bolts;
}

// ---------------------------------------------------------------------------------------------
// Pattern generators. All return bolt locations in mm, numbered from the bottom-left / start point.
// ---------------------------------------------------------------------------------------------

export interface Point {
  x: number;
  y: number;
}

const clean = (value: number) => Math.round(value * 1e6) / 1e6;

function requireCount(value: number | null, name: string): number {
  if (value === null || !Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a whole number of at least 1.`);
  }
  return value;
}

function requireNumber(value: number | null, name: string): number {
  if (value === null || !Number.isFinite(value)) throw new Error(`Enter a value for ${name}.`);
  return value;
}

function checkBoltCount(count: number): void {
  if (count > MAX_BOLTS)
    throw new Error(`A pattern is limited to ${MAX_BOLTS} bolts (this one has ${count}).`);
}

export interface RectangleParams {
  cols: number | null;
  rows: number | null;
  dx: number | null;
  dy: number | null;
  cx: number | null;
  cy: number | null;
  perimeterOnly: boolean;
}

// Columns x rows grid centred on (cx, cy); rows are listed bottom to top, left to right.
export function rectanglePattern(params: RectangleParams): Point[] {
  const cols = requireCount(params.cols, "Columns");
  const rows = requireCount(params.rows, "Rows");
  const dx = requireNumber(params.dx, "X spacing");
  const dy = requireNumber(params.dy, "Y spacing");
  const cx = requireNumber(params.cx, "Center X");
  const cy = requireNumber(params.cy, "Center Y");
  if ((cols > 1 && dx <= 0) || (rows > 1 && dy <= 0))
    throw new Error("Spacing must be greater than zero.");
  checkBoltCount(cols * rows);
  const points: Point[] = [];
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const interior = i > 0 && i < cols - 1 && j > 0 && j < rows - 1;
      if (params.perimeterOnly && interior) continue;
      points.push({
        x: clean(cx + (i - (cols - 1) / 2) * dx),
        y: clean(cy + (j - (rows - 1) / 2) * dy),
      });
    }
  }
  return points;
}

export interface LineParams {
  count: number | null;
  spacing: number | null;
  angleDeg: number | null;
  cx: number | null;
  cy: number | null;
}

// Evenly spaced bolts on a line through (cx, cy) at the given angle from +x.
export function linePattern(params: LineParams): Point[] {
  const count = requireCount(params.count, "Bolt count");
  const spacing = requireNumber(params.spacing, "Spacing");
  const angle = (requireNumber(params.angleDeg, "Angle") * Math.PI) / 180;
  const cx = requireNumber(params.cx, "Center X");
  const cy = requireNumber(params.cy, "Center Y");
  if (count > 1 && spacing <= 0) throw new Error("Spacing must be greater than zero.");
  checkBoltCount(count);
  const points: Point[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = (i - (count - 1) / 2) * spacing;
    points.push({ x: clean(cx + t * Math.cos(angle)), y: clean(cy + t * Math.sin(angle)) });
  }
  return points;
}

export interface CircleParams {
  count: number | null;
  diameter: number | null;
  startAngleDeg: number | null;
  cx: number | null;
  cy: number | null;
}

// Evenly spaced bolts on a bolt circle, counter-clockwise from the start angle.
export function circlePattern(params: CircleParams): Point[] {
  const count = requireCount(params.count, "Bolt count");
  const diameter = requireNumber(params.diameter, "Bolt circle diameter");
  const start = requireNumber(params.startAngleDeg, "Start angle");
  const cx = requireNumber(params.cx, "Center X");
  const cy = requireNumber(params.cy, "Center Y");
  if (count > 1 && diameter <= 0)
    throw new Error("Bolt circle diameter must be greater than zero.");
  checkBoltCount(count);
  const points: Point[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = ((start + (360 * i) / count) * Math.PI) / 180;
    points.push({
      x: clean(cx + (diameter / 2) * Math.cos(angle)),
      y: clean(cy + (diameter / 2) * Math.sin(angle)),
    });
  }
  return points;
}
