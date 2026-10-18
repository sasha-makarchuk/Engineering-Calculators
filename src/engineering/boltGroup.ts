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
import { fromBase, toBase, type UnitSystem } from "./units";
import { sizeById } from "../data/fasteners";

export const MAX_BOLTS = 100;

type Weighting = "tensile" | "shank";
export type PatternKind = "rectangle" | "line" | "single";

export interface GroupBolt {
  x: number; // mm
  y: number; // mm
  id: number;
  sizeId: string;
  patternId?: number;
}

export interface BoltPattern {
  type: PatternKind;
  cx: number;
  cy: number;
  dx: number;
  dy: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  cols: number;
  rows: number;
}

export interface BoltPatternGroup {
  id: number;
  pattern: BoltPattern;
  boltIds: number[];
}

export interface BoltGroupInput extends BaseLoadInput {
  bolts: GroupBolt[];
  patternGroups: BoltPatternGroup[];
  unitSystem: UnitSystem;
  commonOnly: boolean;
  pattern: BoltPattern;
}

export interface BoltForceResult {
  index: number; // 1-based bolt number
  id: number;
  d: number;
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
  sizeId: string;
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

function GetBoltArea(sizeId: string, unitSystem: UnitSystem): number {
  const size = sizeById(sizeId);
  if (!size) return 0;

  const fastenerUnitSystem: UnitSystem = size.system === "metric" ? "si" : "imperial";
  const diameter = fromBase(toBase(size.d, "length", fastenerUnitSystem), "length", unitSystem);

  return (Math.PI * diameter ** 2) / 4;
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

  const boltAreas = bolts.map((bolt) => GetBoltArea(bolt.sizeId, input.unitSystem));
  if (boltAreas.some((area) => !Number.isFinite(area) || area <= 0)) {
    throw new Error("Every bolt must have a valid size with positive shear area.");
  }

  const totalArea = boltAreas.reduce((sum, area) => sum + area, 0);
  const cogX = bolts.reduce((sum, bolt, i) => sum + boltAreas[i]! * bolt.x, 0) / totalArea;
  const cogY = bolts.reduce((sum, bolt, i) => sum + boltAreas[i]! * bolt.y, 0) / totalArea;
  const polarMoment = bolts.reduce(
    (sum, bolt, i) => sum + boltAreas[i]! * ((bolt.x - cogX) ** 2 + (bolt.y - cogY) ** 2),
    0,
  );

  // Loads reduced to the centroid.
  const momentAtCog = Mz + (xL - cogX) * Fy - (yL - cogY) * Fx;

  const results: BoltForceResult[] = bolts.map((bolt, i) => {
    const area = boltAreas[i]!;
    const rx = bolt.x - cogX;
    const ry = bolt.y - cogY;
    const share = area / totalArea;
    const fxDirect = Fx * share;
    const fyDirect = Fy * share;
    const fxMoment = polarMoment > 0 ? (-momentAtCog * area * ry) / polarMoment : 0;
    const fyMoment = polarMoment > 0 ? (momentAtCog * area * rx) / polarMoment : 0;
    const fx = fxDirect + fxMoment;
    const fy = fyDirect + fyMoment;
    return {
      index: i + 1,
      id: bolt.id,
      d: sizeById(bolt.sizeId)?.d ?? 0,
      x: bolt.x,
      y: bolt.y,
      rx,
      ry,
      area,
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
      sizeId: bolt.sizeId,
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
      const dx = pattern.dx ?? 0;
      const dy = pattern.dy ?? 0;

      for (let i = 0; i < count; i++) {
        bolts.push({
          sizeId: defaultSizeId,
          x: pattern.startX + i * dx,
          y: pattern.startY + i * dy,
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