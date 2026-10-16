// Fastener size tables and bolt grade properties for the bolted joint calculator.
// All lengths are stored in mm and all strengths in MPa so the engineering core stays in SI.
import { tensileStressArea } from "../engineering/boltedJoint";
import { type SelectOption } from "../components/Dropdown";

export type FastenerSystem = "metric" | "imperial";
export type ThreadSeries = "coarse" | "fine";
export type HoleFit = "fine" | "normal" | "coarse";

export interface FastenerSize {
    id: string;
    label: string;
    system: FastenerSystem;
    series: ThreadSeries;
    common: boolean; // highlighted as a common stock size
    d: number; // nominal diameter, mm
    pitch: number; // mm
    at: number; // tensile stress area, mm² (ISO 724 for metric, ASME B1.1 for imperial)
    headAF: number; // hex head / nut across flats, mm
    headHeight: number;
    nutHeight: number;
    washerOd: number;
    washerT: number;
    holes: Record<HoleFit, number>; // clearance hole diameters, mm
}

export const HOLE_FIT_LABELS: Record<FastenerSystem, Record<HoleFit, string>> = {
    metric: { fine: "Fine (ISO 273)", normal: "Medium (ISO 273)", coarse: "Coarse (ISO 273)" },
    imperial: { fine: "Close fit", normal: "Normal fit", coarse: "Loose fit" },
};

const IN = 25.4;

// Metric: [name, d, coarse pitch, fine pitch, head AF, head height, nut height (ISO 4032),
//          washer OD (ISO 7089), washer thickness, hole fine, hole medium, hole coarse (ISO 273), common]
type MetricRow = [string, number, number, number, number, number, number, number, number, number, number, number, boolean];

const METRIC_ROWS: MetricRow[] = [
    ["M3", 3, 0.5, 0.35, 5.5, 2, 2.4, 7, 0.5, 3.2, 3.4, 3.6, false],
    ["M4", 4, 0.7, 0.5, 7, 2.8, 3.2, 9, 0.8, 4.3, 4.5, 4.8, false],
    ["M5", 5, 0.8, 0.5, 8, 3.5, 4.7, 10, 1, 5.3, 5.5, 5.8, false],
    ["M6", 6, 1, 0.75, 10, 4, 5.2, 12, 1.6, 6.4, 6.6, 7, true],
    ["M8", 8, 1.25, 1, 13, 5.3, 6.8, 16, 1.6, 8.4, 9, 10, true],
    ["M10", 10, 1.5, 1.25, 16, 6.4, 8.4, 20, 2, 10.5, 11, 12, true],
    ["M12", 12, 1.75, 1.5, 18, 7.5, 10.8, 24, 2.5, 13, 13.5, 14.5, true],
    ["M14", 14, 2, 1.5, 21, 8.8, 12.8, 28, 2.5, 15, 15.5, 16.5, false],
    ["M16", 16, 2, 1.5, 24, 10, 14.8, 30, 3, 17, 17.5, 18.5, true],
    ["M20", 20, 2.5, 1.5, 30, 12.5, 18, 37, 3, 21, 22, 24, true],
    ["M24", 24, 3, 2, 36, 15, 21.5, 44, 4, 25, 26, 28, true],
    ["M30", 30, 3.5, 2, 46, 18.7, 25.6, 56, 4, 31, 33, 35, false],
    ["M36", 36, 4, 3, 55, 22.5, 31, 66, 5, 37, 39, 42, false],
];

// Imperial (inches): [label, nominal d, UNC tpi, UNF tpi, head AF, head height, nut thickness (ASME B18.2.2),
//                     washer OD (SAE flat), washer thickness, common]
type ImperialRow = [string, number, number, number, number, number, number, number, number, boolean];

const IMPERIAL_ROWS: ImperialRow[] = [
    ["#4", 0.112, 40, 48, 0.25, 0.094, 0.109, 0.312, 0.032, false],
    ["#6", 0.138, 32, 40, 0.3125, 0.109, 0.109, 0.375, 0.04, false],
    ["#8", 0.164, 32, 36, 0.34375, 0.125, 0.125, 0.438, 0.04, false],
    ["#10", 0.19, 24, 32, 0.375, 0.14, 0.125, 0.5, 0.04, false],
    ["1/4", 0.25, 20, 28, 0.4375, 0.163, 0.218, 0.625, 0.065, true],
    ["5/16", 0.3125, 18, 24, 0.5, 0.211, 0.266, 0.688, 0.065, false],
    ["3/8", 0.375, 16, 24, 0.5625, 0.243, 0.328, 0.812, 0.065, true],
    ["7/16", 0.4375, 14, 20, 0.625, 0.291, 0.375, 0.922, 0.065, false],
    ["1/2", 0.5, 13, 20, 0.75, 0.323, 0.438, 1.062, 0.095, true],
    ["9/16", 0.5625, 12, 18, 0.8125, 0.371, 0.484, 1.156, 0.095, false],
    ["5/8", 0.625, 11, 18, 0.9375, 0.403, 0.547, 1.312, 0.095, true],
    ["3/4", 0.75, 10, 16, 1.125, 0.483, 0.641, 1.469, 0.134, true],
    ["7/8", 0.875, 9, 14, 1.3125, 0.563, 0.766, 1.75, 0.134, false],
    ["1", 1, 8, 12, 1.5, 0.627, 0.859, 2, 0.134, true],
    ["1-1/8", 1.125, 7, 12, 1.6875, 0.718, 0.969, 2.25, 0.134, false],
    ["1-1/4", 1.25, 7, 12, 1.875, 0.813, 1.062, 2.5, 0.165, false],
    ["1-3/8", 1.375, 6, 12, 2.0625, 0.878, 1.172, 2.75, 0.165, false],
    ["1-1/2", 1.5, 6, 12, 2.25, 0.974, 1.281, 3, 0.165, false],
];

const round4 = (value: number) => Math.round(value * 10000) / 10000;

function buildMetric(): FastenerSize[] {
    const sizes: FastenerSize[] = [];
    for (const row of METRIC_ROWS) {
        const [name, d, coarse, fine, headAF, headHeight, nutHeight, washerOd, washerT, holeF, holeN, holeC, common] = row;
        const base = { system: "metric" as const, d, headAF, headHeight, nutHeight, washerOd, washerT, holes: { fine: holeF, normal: holeN, coarse: holeC } };
        sizes.push({ ...base, id: `${name}x${coarse}`, label: `${name} × ${coarse}`, series: "coarse", pitch: coarse, at: tensileStressArea(d, coarse, "metric"), common });
        sizes.push({ ...base, id: `${name}x${fine}`, label: `${name} × ${fine}`, series: "fine", pitch: fine, at: tensileStressArea(d, fine, "metric"), common });
    }
    return sizes;
}

function buildImperial(): FastenerSize[] {
    const sizes: FastenerSize[] = [];
    for (const row of IMPERIAL_ROWS) {
        const [name, dIn, unc, unf, headAF, headHeight, nutHeight, washerOd, washerT, common] = row;
        // Clearance holes: 1/64, 1/32 and 1/16 in over nominal (small screws use tighter allowances).
        const small = dIn < 0.25;
        const holesIn = small
            ? { fine: dIn + 0.008, normal: dIn + 0.016, coarse: dIn + 0.03 }
            : { fine: dIn + 1 / 64, normal: dIn + 1 / 32, coarse: dIn + 1 / 16 };
        const base = {
            system: "imperial" as const,
            d: dIn * IN,
            headAF: headAF * IN,
            headHeight: headHeight * IN,
            nutHeight: nutHeight * IN,
            washerOd: washerOd * IN,
            washerT: washerT * IN,
            holes: { fine: round4(holesIn.fine * IN), normal: round4(holesIn.normal * IN), coarse: round4(holesIn.coarse * IN) },
            common,
        };
        // Numbered screws read "#10-24 UNC"; fractional sizes read 1/2"-13 UNC.
        const prefix = name.startsWith("#") ? `${name}-` : `${name}"-`;
        sizes.push({ ...base, id: `${name}-${unc}UNC`, label: `${prefix}${unc} UNC`, series: "coarse", pitch: IN / unc, at: tensileStressArea(dIn * IN, IN / unc, "imperial") });
        sizes.push({ ...base, id: `${name}-${unf}UNF`, label: `${prefix}${unf} UNF`, series: "fine", pitch: IN / unf, at: tensileStressArea(dIn * IN, IN / unf, "imperial") });
    }
    return sizes;
}

export const FASTENER_SIZES: FastenerSize[] = [...buildMetric(), ...buildImperial()];

export function getSizes(system: FastenerSystem, series: ThreadSeries): FastenerSize[] {
    return FASTENER_SIZES.filter((size) => size.system === system && size.series === series);
}

// Pick the size in a list whose diameter is closest to the requested diameter (mm).
export function nearestSize(list: FastenerSize[], dMm: number): FastenerSize | undefined {
    let best: FastenerSize | undefined;
    for (const size of list) {
        if (!best || Math.abs(size.d - dMm) < Math.abs(best.d - dMm)) best = size;
    }
    return best;
}

export interface GradeProperties {
    sp: number; // proof strength, MPa
    sy: number; // yield strength, MPa
    su: number; // ultimate tensile strength, MPa
}

export interface BoltGrade {
    id: string;
    label: string;
    system: FastenerSystem;
    standard: string;
    props: (dMm: number) => GradeProperties;
}

const KSI = 6.894757293168;
const ksi = (sp: number, sy: number, su: number): GradeProperties => ({ sp: sp * KSI, sy: sy * KSI, su: su * KSI });

// Metric classes: Shigley Table 8-11 (ISO 898-1).
const isoGrade = (cls: string, sp: number, sy: number, su: number): BoltGrade => ({
    id: `iso-${cls}`,
    label: `Class ${cls}`,
    system: "metric",
    standard: "ISO 898-1",
    props: () => ({ sp, sy, su }),
});

// Inch grades: Shigley Table 8-9 (SAE J429) and ASTM A325 / A490, with the size breaks in each standard.
export const BOLT_GRADES: BoltGrade[] = [
    isoGrade("4.6", 225, 240, 400),
    isoGrade("4.8", 310, 340, 420),
    isoGrade("5.8", 380, 420, 520),
    isoGrade("8.8", 600, 660, 830),
    isoGrade("9.8", 650, 720, 900),
    isoGrade("10.9", 830, 940, 1040),
    isoGrade("12.9", 970, 1100, 1220),
    {
        id: "sae-2",
        label: "SAE Grade 2",
        system: "imperial",
        standard: "SAE J429",
        props: (d) => (d <= 0.75 * IN ? ksi(55, 57, 74) : ksi(33, 36, 60)),
    },
    {
        id: "sae-5",
        label: "SAE Grade 5",
        system: "imperial",
        standard: "SAE J429",
        props: (d) => (d <= IN ? ksi(85, 92, 120) : ksi(74, 81, 105)),
    },
    { id: "sae-8", label: "SAE Grade 8", system: "imperial", standard: "SAE J429", props: () => ksi(120, 130, 150) },
    {
        id: "astm-a325",
        label: "ASTM A325 (Type 1)",
        system: "imperial",
        standard: "ASTM F3125 / A325",
        props: (d) => (d <= IN ? ksi(85, 92, 120) : ksi(74, 81, 105)),
    },
    { id: "astm-a490", label: "ASTM A490", system: "imperial", standard: "ASTM F3125 / A490", props: () => ksi(120, 130, 150) },
];

export function getGrades(system: FastenerSystem): BoltGrade[] {
    return BOLT_GRADES.filter((grade) => grade.system === system);
}

export const DEFAULT_GRADE: Record<FastenerSystem, string> = { metric: "iso-10.9", imperial: "sae-5" };


export function getFastenerOptions(
    series: ThreadSeries,
    commonOnly = false
): SelectOption[] {
    const filtered = commonOnly ? FASTENER_SIZES.filter((s) => s.common) : FASTENER_SIZES;

    return filtered.map((size) => ({
        value: size.id,
        label: `${size.label}${size.common && !commonOnly ? " ★" : ""}`,
    }));
}

export function sizeById(id: string): FastenerSize | undefined {
    return FASTENER_SIZES.find((size) => size.id === id);
}