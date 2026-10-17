import { describe, expect, it } from "vitest";
import { generatePatternBolts, type BoltPattern } from "./boltGroup";

const basePattern: BoltPattern = {
    type: "line",
    cx: 0,
    cy: 0,
    dx: 0,
    dy: 0,
    startX: 0,
    startY: 0,
    endX: 10,
    endY: 8,
    cols: 3,
    rows: 1,
};

describe("bolt-group pattern generation", () => {
    it("interpolates bolts along a diagonal between the selected endpoints", () => {
        expect(generatePatternBolts(basePattern)).toEqual([
            { sizeId: "M10", x: 0, y: 0 },
            { sizeId: "M10", x: 5, y: 4 },
            { sizeId: "M10", x: 10, y: 8 },
        ]);
    });

    it("places one generated line bolt at the segment midpoint", () => {
        expect(generatePatternBolts({ ...basePattern, cols: 1 })).toEqual([
            { sizeId: "M10", x: 5, y: 4 },
        ]);
    });

    it("generates a single bolt at the selected center", () => {
        expect(
            generatePatternBolts({ ...basePattern, type: "single", cx: 3, cy: 7 }),
        ).toEqual([{ sizeId: "M10", x: 3, y: 7 }]);
    });
});
