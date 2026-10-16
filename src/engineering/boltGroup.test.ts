// import { describe, expect, it } from "vitest";
// import {
//   calculateBoltGroup,
//   circlePattern,
//   linePattern,
//   rectanglePattern,
//   type GroupBolt,
//   type BoltPattern,
//   type BoltGroupInput,
// } from "./boltGroup";

// const A = 84.27; // M12 x 1.75 tensile stress area, mm²

// // 3 x 2 grid of identical bolts at 100 mm spacing.
// const grid: GroupBolt[] = [
//   { x: 0, y: 0, id: 1, sizeId: "M12x1.75" },
//   { x: 100, y: 0, id: 2, sizeId: "M12x1.75" },
//   { x: 200, y: 0, id: 3, sizeId: "M12x1.75" },
//   { x: 0, y: 100, id: 4, sizeId: "M12x1.75" },
//   { x: 100, y: 100, id: 5, sizeId: "M12x1.75" },
//   { x: 200, y: 100, id: 6, sizeId: "M12x1.75" },
// ];

// const initialPattern: BoltPattern = {
//     type: "rectangle",
//     cx: 5,
//     cy: 5,
//     cols: 3,
//     rows: 2,
//     dx: 10,
//     dy: 10,
// }

// const initialInput: BoltGroupInput = {
//     pattern: initialPattern,
//     commonOnly: true,
//     bolts: grid,
//     unitSystem: "imperial",
// };

// describe("bolt group elastic method", () => {
//   it("finds the geometric centroid for identical bolts", () => {
//       const r = calculateBoltGroup( initialInput );
//     expect(r.cogX).toBeCloseTo(100, 9);
//     expect(r.cogY).toBeCloseTo(50, 9);
//     expect(r.totalArea).toBeCloseTo(6 * A, 9);
//     expect(r.maxForce).toBe(0);
//   });

//   it("weights the centroid and polar moment by bolt area", () => {
//     const r = calculateBoltGroup(initialInput);
//     expect(r.cogX).toBeCloseTo(75, 9);
//     expect(r.polarMoment).toBeCloseTo(100 * 75 ** 2 + 300 * 25 ** 2, 6);
//   });

//   it("shares a force through the centroid in proportion to area", () => {
//     const r = calculateBoltGroup(initialInput);
//     expect(r.momentAtCog).toBeCloseTo(0, 6);
//     expect(r.bolts[0]?.fx).toBeCloseTo(1000, 6);
//     expect(r.bolts[1]?.fx).toBeCloseTo(3000, 6);
//   });

//   it("reproduces a hand-calculated eccentric load on a 3 x 2 grid", () => {
//     // 12 kN downward at (250, 50): moment at the centroid = -150 mm x 12 kN = -1.8 kN-m (clockwise).
//     const r = calculateBoltGroup(initialInput);
//     expect(r.momentAtCog).toBeCloseTo(-1.8e6, 3);
//     expect(r.sumFy).toBeCloseTo(-12000, 9);
//     const bolt3 = r.bolts[2]!;
//     expect(bolt3.fx).toBeCloseTo(-1636.36, 1);
//     expect(bolt3.fy).toBeCloseTo(-5272.73, 1);
//     expect(bolt3.resultant).toBeCloseTo(5520.9, 0);
//     expect(r.maxBolts).toEqual([3, 6]);
//     expect(r.bolts[0]?.resultant).toBeCloseTo(2073.1, 0);
//     expect(r.bolts[1]?.resultant).toBeCloseTo(2583.9, 0);
//   });

//   it("satisfies equilibrium for arbitrary loads and mixed bolt sizes", () => {
//     const bolts: GroupBolt[] = [
//       { x: -30, y: 10, id: 1, sizeId: "M12x1.75" },
//       { x: 40, y: -20, id: 2, sizeId: "M12x1.75" },
//       { x: 10, y: 60, id: 3, sizeId: "M12x1.75" },
//       { x: 90, y: 5, id: 4, sizeId: "M12x1.75" },
//     ];
//     const r = calculateBoltGroup(initialInput);
//     expect(r.equilibriumOk).toBe(true);
//     expect(Math.abs(r.residualFx)).toBeLessThan(1e-6);
//     expect(Math.abs(r.residualFy)).toBeLessThan(1e-6);
//     expect(Math.abs(r.residualMoment)).toBeLessThan(1e-3);
//   });

//   it("splits a pure moment on a bolt circle into equal tangential forces", () => {
//     const bolts = circlePattern({ count: 4, diameter: 200, startAngleDeg: 0, cx: 0, cy: 0 }).map(
//       (p) => ({ ...p, area: A }),
//     );
//     const r = calculateBoltGroup(initialInput); // counter-clockwise
//     for (const bolt of r.bolts) expect(bolt.resultant).toBeCloseTo(8e5 / (4 * 100), 6);
//     // Bolt 1 sits on +x, so a counter-clockwise couple pushes it toward +y.
//     expect(r.bolts[0]?.fy).toBeGreaterThan(0);
//     expect(r.bolts[0]?.fx).toBeCloseTo(0, 6);
//   });

//   it("gives a larger bolt a larger share of the moment", () => {
//     const r = calculateBoltGroup(initialInput);
//     // Same distance from the weighted centroid is not equal here, so compare force / (area x distance).
//     const [b1, b2] = r.bolts;
//     expect(b1!.resultant / (b1!.area * Math.hypot(b1!.rx, b1!.ry))).toBeCloseTo(
//       b2!.resultant / (b2!.area * Math.hypot(b2!.rx, b2!.ry)),
//       9,
//     );
//   });

//   it("warns when a single bolt is asked to resist a moment and rejects bad input", () => {
//     const single = calculateBoltGroup(initialInput);
//     expect(single.warnings.some((w) => w.includes("moment"))).toBe(true);
//     expect(single.equilibriumOk).toBe(false);
//     expect(() => calculateBoltGroup(initialInput)).toThrow();
//     expect(() =>
//       calculateBoltGroup(initialInput),
//     ).toThrow();
//     const many = Array.from({ length: 101 }, (_, i) => ({ x: i, y: 0, id: i + 1, sizeId: "M12x1.75" }));
//     expect(() => calculateBoltGroup(initialInput)).toThrow();
//   });

//   it("flags duplicate bolt locations", () => {
//     const r = calculateBoltGroup(initialInput);
//     expect(r.warnings.some((w) => w.includes("same location"))).toBe(true);
//   });
// });

// describe("pattern generators", () => {
//   it("builds a full rectangular grid centred on the given point", () => {
//     const pts = rectanglePattern({
//       cols: 3,
//       rows: 2,
//       dx: 100,
//       dy: 100,
//       cx: 100,
//       cy: 50,
//       perimeterOnly: false,
//     });
//     expect(pts).toHaveLength(6);
//     expect(pts[0]).toEqual({ x: 0, y: 0 });
//     expect(pts[2]).toEqual({ x: 200, y: 0 });
//     expect(pts[5]).toEqual({ x: 200, y: 100 });
//   });

//   it("keeps only perimeter bolts when asked", () => {
//     const pts = rectanglePattern({
//       cols: 4,
//       rows: 3,
//       dx: 50,
//       dy: 50,
//       cx: 0,
//       cy: 0,
//       perimeterOnly: true,
//     });
//     expect(pts).toHaveLength(2 * (4 + 3) - 4);
//     expect(pts.some((p) => p.x === -25 && p.y === 0)).toBe(false);
//   });

//   it("builds a line at an angle", () => {
//     const pts = linePattern({ count: 3, spacing: 100, angleDeg: 90, cx: 10, cy: 0 });
//     expect(pts).toEqual([
//       { x: 10, y: -100 },
//       { x: 10, y: 0 },
//       { x: 10, y: 100 },
//     ]);
//   });

//   it("builds a bolt circle", () => {
//     const pts = circlePattern({ count: 4, diameter: 200, startAngleDeg: 45, cx: 0, cy: 0 });
//     expect(pts).toHaveLength(4);
//     for (const p of pts) expect(Math.hypot(p.x, p.y)).toBeCloseTo(100, 4);
//     expect(pts[0]?.x).toBeCloseTo(70.710678, 4);
//   });

//   it("rejects invalid pattern parameters", () => {
//     expect(() =>
//       rectanglePattern({ cols: 0, rows: 2, dx: 1, dy: 1, cx: 0, cy: 0, perimeterOnly: false }),
//     ).toThrow();
//     expect(() =>
//       rectanglePattern({ cols: 11, rows: 10, dx: 1, dy: 1, cx: 0, cy: 0, perimeterOnly: false }),
//     ).toThrow();
//     expect(() =>
//       circlePattern({ count: 3, diameter: null, startAngleDeg: 0, cx: 0, cy: 0 }),
//     ).toThrow();
//     expect(() => linePattern({ count: 3, spacing: 0, angleDeg: 0, cx: 0, cy: 0 })).toThrow();
//   });
// });
