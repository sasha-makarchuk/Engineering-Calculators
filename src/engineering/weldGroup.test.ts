import { describe, expect, it } from "vitest";
import { calculateWeldGroup, type WeldInput } from "./weldGroup";

// Shared sample problem used by multiple automated tests.
const baseInput: WeldInput = {
  unitSystem: "imperial",
  pattern: "single",
  h: 0.25,
  b: 6,
  d: 8,
  Fx: 1200,
  Fy: -4500,
  Fz: 0,
  xL: 3,
  yL: 4,
  zL: 0,
  Mx: 0,
  My: 0,
  Mz: 18000,
  tauAllow: 21000,
  xCustom: 3,
  yCustom: 4,
};

// Group related tests for the weld-group calculation engine.
describe("weld group calculation", () => {
  // Basic sanity check for the default single-line weld group.
  it("calculates a default single-line weld group", () => {
    const result = calculateWeldGroup(baseInput);
    expect(result.geometry.unitLength).toBeCloseTo(203.2, 8);
    expect(result.throat).toBeCloseTo(4.490128, 4);
    expect(result.maxStress).toBeGreaterThan(0);
    expect(result.factorOfSafety).toBeGreaterThan(1);
  });

  // Verify equivalent physical inputs give equivalent results in SI and Imperial.
  it("keeps imperial and SI results physically equivalent", () => {
    const imperial = calculateWeldGroup(baseInput);
    const si: WeldInput = {
      ...baseInput,
      unitSystem: "si",
      h: 6.35,
      b: 152.4,
      d: 203.2,
      Fx: 5337.865938,
      Fy: -20016.997269,
      Fz: 0,
      xL: 76.2,
      yL: 101.6,
      zL: 0,
      Mx: 0,
      My: 0,
      Mz: 2033.727,
      tauAllow: 144.789903,
      xCustom: 76.2,
      yCustom: 101.6,
    };
    const metric = calculateWeldGroup(si);
    expect(metric.maxStress).toBeCloseTo(imperial.maxStress, 3);
    expect(metric.factorOfSafety).toBeCloseTo(imperial.factorOfSafety, 3);
  });

  // Verify the circular weld pattern is supported.
  it("supports the circular pattern", () => {
    const result = calculateWeldGroup({ ...baseInput, pattern: "circle", d: null });
    expect(result.geometry.circular).toBe(true);
    expect(result.geometry.unitLength).toBeGreaterThan(0);
  });
});
