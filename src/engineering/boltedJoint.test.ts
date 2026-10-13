import { describe, expect, it } from "vitest";
import { FASTENER_SIZES, getGrades, getSizes } from "../data/fasteners";
import {
  STEEL_E,
  TAN_30,
  autoBoltLength,
  autoTappedEngagement,
  calculateBoltedJoint,
  externalStripAreaFor,
  fosStatus,
  internalStripAreaFor,
  type BoltedJointInput,
} from "./boltedJoint";

// M12 x 1.75, class 10.9, two 10 / 12 mm steel plates, bolt + nut, no washers.
const m12 = getSizes("metric", "coarse").find((s) => s.id === "M12x1.75")!;
const grade109 = getGrades("metric").find((g) => g.id === "iso-10.9")!.props(m12.d);

const base: BoltedJointInput = {
  fastenerSystem: "metric",
  config: "bolt_nut",
  d: m12.d,
  pitch: m12.pitch,
  at: m12.at,
  headAF: m12.headAF,
  headHeight: m12.headHeight,
  nutHeight: m12.nutHeight,
  boltLength: 40,
  sp: grade109.sp,
  sy: grade109.sy,
  su: grade109.su,
  eBolt: STEEL_E,
  washerEnabled: false,
  washerOd: m12.washerOd,
  washerT: m12.washerT,
  hole: m12.holes.normal,
  plate1: { t: 10, sy: 300, su: 450, e: STEEL_E },
  plate2: { t: 12, sy: 300, su: 450, e: STEEL_E },
  engagement: m12.nutHeight,
  nutSu: grade109.su,
  tensileLoad: 8000,
  shearLoad: 3000,
  requiredClamp: 0,
  mu: 0.15,
  shearPlane: "threads",
  preloadMode: "percent",
  preloadPercent: 75,
  preloadForce: 0,
  preloadTorque: 0,
  nutFactor: 0.2,
  scatter: 0.25,
};

describe("fastener data", () => {
  it("matches published tensile stress areas", () => {
    expect(m12.at).toBeCloseTo(84.27, 1); // ISO 898-1: 84.3 mm²
    const half13 = getSizes("imperial", "coarse").find((s) => s.id === "1/2-13UNC")!;
    expect(half13.at / 645.16).toBeCloseTo(0.1419, 4); // ASME B1.1: 0.1419 in²
  });

  it("has unique ids and flags common sizes", () => {
    const ids = new Set(FASTENER_SIZES.map((s) => s.id));
    expect(ids.size).toBe(FASTENER_SIZES.length);
    expect(getSizes("metric", "coarse").some((s) => s.common)).toBe(true);
    expect(getSizes("imperial", "fine").some((s) => s.common)).toBe(true);
  });

  it("applies the size breaks of inch grades", () => {
    const grade5 = getGrades("imperial").find((g) => g.id === "sae-5")!;
    expect(grade5.props(0.5 * 25.4).sp / 6.894757293168).toBeCloseTo(85, 6);
    expect(grade5.props(1.25 * 25.4).sp / 6.894757293168).toBeCloseTo(74, 6);
  });
});

describe("bolted joint calculation", () => {
  it("computes member stiffness with Shigley's frustum equation for equal steel members", () => {
    const result = calculateBoltedJoint({ ...base, plate2: { ...base.plate1, t: 12 } });
    // Independent evaluation for the symmetric equal-material case (one cone per half of the grip).
    const d = m12.d;
    const dw = m12.headAF;
    const l = 22;
    const half = l / 2;
    // Both plates are steel, but the 10 mm plate is split at mid-grip, so evaluate the series sum explicitly.
    const k = (t: number, dn: number) => {
      const a = (2 * TAN_30 * t + dn - d) * (dn + d);
      const b = (2 * TAN_30 * t + dn + d) * (dn - d);
      return (TAN_30 * Math.PI * STEEL_E * d) / Math.log(a / b);
    };
    const top = 1 / k(10, dw) + 1 / k(half - 10, dw + 2 * TAN_30 * 10);
    const bottom = 1 / k(half, dw);
    expect(result.km).toBeCloseTo(1 / (top + bottom), 3);
    expect(result.c).toBeGreaterThan(0);
    expect(result.c).toBeLessThan(1);
  });

  it("orders the preload cases and applies the standard load equations", () => {
    const r = calculateBoltedJoint(base);
    const { min, nominal, max } = r.cases;
    expect(min.preload).toBeLessThan(nominal.preload);
    expect(max.preload).toBeGreaterThan(nominal.preload);
    expect(nominal.preload).toBeCloseTo(0.75 * r.proofLoad, 6);
    expect(nominal.boltForce).toBeCloseTo(nominal.preload + r.c * 8000, 6);
    expect(nominal.yieldFos).toBeCloseTo((base.sy * base.at) / nominal.boltForce, 9);
    expect(nominal.separationFos).toBeCloseTo(nominal.preload / ((1 - r.c) * 8000), 9);
    expect(min.separationFos).toBeLessThan(nominal.separationFos);
    expect(max.yieldFos).toBeLessThan(min.yieldFos);
  });

  it("converts between torque and preload with T = K Fi d", () => {
    const fromPercent = calculateBoltedJoint(base);
    const fromTorque = calculateBoltedJoint({ ...base, preloadMode: "torque", preloadTorque: fromPercent.torque });
    expect(fromTorque.nominalPreload).toBeCloseTo(fromPercent.nominalPreload, 6);
  });

  it("collapses min/nominal/max when variation is zero", () => {
    const r = calculateBoltedJoint({ ...base, scatter: 0 });
    expect(r.cases.min.preload).toBeCloseTo(r.cases.max.preload, 9);
  });

  it("returns infinite factors of safety when there is no load", () => {
    const r = calculateBoltedJoint({ ...base, tensileLoad: 0, shearLoad: 0 });
    expect(r.cases.nominal.separationFos).toBe(Infinity);
    expect(r.bearingFos).toBe(Infinity);
    expect(r.slipFos).toBe(Infinity);
    expect(r.boltShearFos).toBe(Infinity);
  });

  it("reports separation when tension exceeds the clamp force", () => {
    const r = calculateBoltedJoint({ ...base, tensileLoad: 200000 });
    expect(r.cases.min.separationFos).toBeLessThan(1);
    expect(r.warnings.some((w) => w.includes("separates"))).toBe(true);
  });

  it("uses the thread-stripping areas from the basic thread profile", () => {
    const ext = externalStripAreaFor(12, 1.75, 10.8);
    const int = internalStripAreaFor(12, 1.75, 10.8);
    expect(ext).toBeCloseTo(257, -1);
    expect(int).toBeGreaterThan(ext);
    const r = calculateBoltedJoint(base);
    expect(r.externalStripCapacity).toBeCloseTo(0.6 * base.su * ext, 3);
  });

  it("handles a tapped hole with the effective-grip rule and limits engagement to the plate", () => {
    const r = calculateBoltedJoint({ ...base, config: "tapped_hole", boltLength: 35, engagement: 50 });
    // t2 = 12 mm is not less than d = 12 mm, so the effective grip is h + d/2.
    expect(r.gripEffective).toBeCloseTo(10 + 6, 9);
    expect(r.grip).toBeCloseTo(10, 9);
    expect(r.engagement).toBeCloseTo(12, 9);
    expect(r.warnings.some((w) => w.includes("limited"))).toBe(true);
  });

  it("rejects invalid inputs", () => {
    expect(() => calculateBoltedJoint({ ...base, plate1: { ...base.plate1, t: 0 } })).toThrow();
    expect(() => calculateBoltedJoint({ ...base, scatter: 1.2 })).toThrow();
    expect(() => calculateBoltedJoint({ ...base, preloadPercent: 0 })).toThrow();
  });
});

describe("helpers", () => {
  it("classifies factors of safety against a target", () => {
    expect(fosStatus(2, 1.5)).toBe("pass");
    expect(fosStatus(1.2, 1.5)).toBe("warn");
    expect(fosStatus(0.9, 1.5)).toBe("fail");
    expect(fosStatus(Infinity, 1.5)).toBe("pass");
    expect(fosStatus(NaN, 1.5)).toBe("fail");
  });

  it("rounds bolt lengths up to stock increments", () => {
    expect(autoBoltLength("metric", 22, 10.8, 1.75)).toBe(40);
    expect(autoBoltLength("imperial", 25.4, 10, 2) / 25.4).toBeCloseTo(1.75, 6);
  });

  it("keeps automatic tapped engagement between 1d and 3d and within the plate", () => {
    const le = autoTappedEngagement(12, 1.75, m12.at, 1040, 450, 40, "metric");
    expect(le).toBeGreaterThanOrEqual(12);
    expect(le).toBeLessThanOrEqual(36);
    expect(autoTappedEngagement(12, 1.75, m12.at, 1040, 450, 8, "metric")).toBe(8);
  });
});
