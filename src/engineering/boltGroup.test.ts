import { describe, expect, it } from "vitest";
import {
  calculateBoltGroup,
  circlePattern,
  linePattern,
  rectanglePattern,
  type GroupBolt,
} from "./boltGroup";

const A = 84.27; // M12 x 1.75 tensile stress area, mm²

// 3 x 2 grid of identical bolts at 100 mm spacing.
const grid: GroupBolt[] = [
  { x: 0, y: 0, area: A },
  { x: 100, y: 0, area: A },
  { x: 200, y: 0, area: A },
  { x: 0, y: 100, area: A },
  { x: 100, y: 100, area: A },
  { x: 200, y: 100, area: A },
];

describe("bolt group elastic method", () => {
  it("finds the geometric centroid for identical bolts", () => {
    const r = calculateBoltGroup({ bolts: grid, forces: [], moment: 0 });
    expect(r.cogX).toBeCloseTo(100, 9);
    expect(r.cogY).toBeCloseTo(50, 9);
    expect(r.totalArea).toBeCloseTo(6 * A, 9);
    expect(r.maxForce).toBe(0);
  });

  it("weights the centroid and polar moment by bolt area", () => {
    const r = calculateBoltGroup({
      bolts: [
        { x: 0, y: 0, area: 100 },
        { x: 100, y: 0, area: 300 },
      ],
      forces: [],
      moment: 0,
    });
    expect(r.cogX).toBeCloseTo(75, 9);
    expect(r.polarMoment).toBeCloseTo(100 * 75 ** 2 + 300 * 25 ** 2, 6);
  });

  it("shares a force through the centroid in proportion to area", () => {
    const r = calculateBoltGroup({
      bolts: [
        { x: 0, y: 0, area: 100 },
        { x: 100, y: 0, area: 300 },
      ],
      forces: [{ fx: 4000, fy: 0, x: 75, y: 0 }],
      moment: 0,
    });
    expect(r.momentAtCog).toBeCloseTo(0, 6);
    expect(r.bolts[0]?.fx).toBeCloseTo(1000, 6);
    expect(r.bolts[1]?.fx).toBeCloseTo(3000, 6);
  });

  it("reproduces a hand-calculated eccentric load on a 3 x 2 grid", () => {
    // 12 kN downward at (250, 50): moment at the centroid = -150 mm x 12 kN = -1.8 kN-m (clockwise).
    const r = calculateBoltGroup({
      bolts: grid,
      forces: [{ fx: 0, fy: -12000, x: 250, y: 50 }],
      moment: 0,
    });
    expect(r.momentAtCog).toBeCloseTo(-1.8e6, 3);
    expect(r.sumFy).toBeCloseTo(-12000, 9);
    const bolt3 = r.bolts[2]!;
    expect(bolt3.fx).toBeCloseTo(-1636.36, 1);
    expect(bolt3.fy).toBeCloseTo(-5272.73, 1);
    expect(bolt3.resultant).toBeCloseTo(5520.9, 0);
    expect(r.maxBolts).toEqual([3, 6]);
    expect(r.bolts[0]?.resultant).toBeCloseTo(2073.1, 0);
    expect(r.bolts[1]?.resultant).toBeCloseTo(2583.9, 0);
  });

  it("satisfies equilibrium for arbitrary loads and mixed bolt sizes", () => {
    const bolts: GroupBolt[] = [
      { x: -30, y: 10, area: 50 },
      { x: 40, y: -20, area: 150 },
      { x: 10, y: 60, area: 84 },
      { x: 90, y: 5, area: 245 },
    ];
    const r = calculateBoltGroup({
      bolts,
      forces: [
        { fx: 1200, fy: -800, x: 150, y: 70 },
        { fx: -300, fy: 450, x: -20, y: -40 },
      ],
      moment: 2.5e5,
    });
    expect(r.equilibriumOk).toBe(true);
    expect(Math.abs(r.residualFx)).toBeLessThan(1e-6);
    expect(Math.abs(r.residualFy)).toBeLessThan(1e-6);
    expect(Math.abs(r.residualMoment)).toBeLessThan(1e-3);
  });

  it("splits a pure moment on a bolt circle into equal tangential forces", () => {
    const bolts = circlePattern({ count: 4, diameter: 200, startAngleDeg: 0, cx: 0, cy: 0 }).map(
      (p) => ({ ...p, area: A }),
    );
    const r = calculateBoltGroup({ bolts, forces: [], moment: 8e5 }); // counter-clockwise
    for (const bolt of r.bolts) expect(bolt.resultant).toBeCloseTo(8e5 / (4 * 100), 6);
    // Bolt 1 sits on +x, so a counter-clockwise couple pushes it toward +y.
    expect(r.bolts[0]?.fy).toBeGreaterThan(0);
    expect(r.bolts[0]?.fx).toBeCloseTo(0, 6);
  });

  it("gives a larger bolt a larger share of the moment", () => {
    const r = calculateBoltGroup({
      bolts: [
        { x: -50, y: 0, area: 100 },
        { x: 50, y: 0, area: 200 },
      ],
      forces: [],
      moment: 1e5,
    });
    // Same distance from the weighted centroid is not equal here, so compare force / (area x distance).
    const [b1, b2] = r.bolts;
    expect(b1!.resultant / (b1!.area * Math.hypot(b1!.rx, b1!.ry))).toBeCloseTo(
      b2!.resultant / (b2!.area * Math.hypot(b2!.rx, b2!.ry)),
      9,
    );
  });

  it("warns when a single bolt is asked to resist a moment and rejects bad input", () => {
    const single = calculateBoltGroup({
      bolts: [{ x: 0, y: 0, area: A }],
      forces: [],
      moment: 1000,
    });
    expect(single.warnings.some((w) => w.includes("moment"))).toBe(true);
    expect(single.equilibriumOk).toBe(false);
    expect(() => calculateBoltGroup({ bolts: [], forces: [], moment: 0 })).toThrow();
    expect(() =>
      calculateBoltGroup({ bolts: [{ x: 0, y: 0, area: 0 }], forces: [], moment: 0 }),
    ).toThrow();
    const many = Array.from({ length: 101 }, (_, i) => ({ x: i, y: 0, area: A }));
    expect(() => calculateBoltGroup({ bolts: many, forces: [], moment: 0 })).toThrow();
  });

  it("flags duplicate bolt locations", () => {
    const r = calculateBoltGroup({
      bolts: [
        { x: 0, y: 0, area: A },
        { x: 0, y: 0, area: A },
      ],
      forces: [],
      moment: 0,
    });
    expect(r.warnings.some((w) => w.includes("same location"))).toBe(true);
  });
});

describe("pattern generators", () => {
  it("builds a full rectangular grid centred on the given point", () => {
    const pts = rectanglePattern({
      cols: 3,
      rows: 2,
      dx: 100,
      dy: 100,
      cx: 100,
      cy: 50,
      perimeterOnly: false,
    });
    expect(pts).toHaveLength(6);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[2]).toEqual({ x: 200, y: 0 });
    expect(pts[5]).toEqual({ x: 200, y: 100 });
  });

  it("keeps only perimeter bolts when asked", () => {
    const pts = rectanglePattern({
      cols: 4,
      rows: 3,
      dx: 50,
      dy: 50,
      cx: 0,
      cy: 0,
      perimeterOnly: true,
    });
    expect(pts).toHaveLength(2 * (4 + 3) - 4);
    expect(pts.some((p) => p.x === -25 && p.y === 0)).toBe(false);
  });

  it("builds a line at an angle", () => {
    const pts = linePattern({ count: 3, spacing: 100, angleDeg: 90, cx: 10, cy: 0 });
    expect(pts).toEqual([
      { x: 10, y: -100 },
      { x: 10, y: 0 },
      { x: 10, y: 100 },
    ]);
  });

  it("builds a bolt circle", () => {
    const pts = circlePattern({ count: 4, diameter: 200, startAngleDeg: 45, cx: 0, cy: 0 });
    expect(pts).toHaveLength(4);
    for (const p of pts) expect(Math.hypot(p.x, p.y)).toBeCloseTo(100, 4);
    expect(pts[0]?.x).toBeCloseTo(70.710678, 4);
  });

  it("rejects invalid pattern parameters", () => {
    expect(() =>
      rectanglePattern({ cols: 0, rows: 2, dx: 1, dy: 1, cx: 0, cy: 0, perimeterOnly: false }),
    ).toThrow();
    expect(() =>
      rectanglePattern({ cols: 11, rows: 10, dx: 1, dy: 1, cx: 0, cy: 0, perimeterOnly: false }),
    ).toThrow();
    expect(() =>
      circlePattern({ count: 3, diameter: null, startAngleDeg: 0, cx: 0, cy: 0 }),
    ).toThrow();
    expect(() => linePattern({ count: 3, spacing: 0, angleDeg: 0, cx: 0, cy: 0 })).toThrow();
  });
});
