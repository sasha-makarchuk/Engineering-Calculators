import type { UnitSystem } from "./units";
import { formatSignificantFigures, fromBase, getUnitLabel, toBase } from "./units";
import {
  displayResultValue,
  formatResultNumber,
  type WeldInput,
  type WeldResult,
} from "./weldGroup";
import type { BoltGroupInput, BoltGroupResult } from "./boltGroup";
import type { BoltedJointInput, BoltedJointResult } from "./boltedJoint";

export interface ReportRow {
  label: string;
  value: string;
}

export interface ReportDetailTable {
  title: string;
  headers: string[];
  rows: string[][];
}

export interface EngineeringReportData {
  title: string;
  subtitle: string;
  filename: string;
  date: string;
  status: string;
  inputRows: ReportRow[];
  resultRows: ReportRow[];
  summarySections: Array<{ title: string; rows: ReportRow[] }>;
  calculationSteps: Array<{ title: string; equation: string; details: string[] }>;
  detailTables: ReportDetailTable[];
}

// Shared report model for calculators whose detailed result table is already available as rows.
export function createEngineeringReport(
  title: string,
  subtitle: string,
  filename: string,
  inputRows: ReportRow[],
  resultRows: ReportRow[],
  details: ReportDetailTable[],
  calculationSteps: EngineeringReportData["calculationSteps"] = [],
  summarySections: EngineeringReportData["summarySections"] = [],
): EngineeringReportData {
  return {
    title, subtitle, filename, date: new Date().toLocaleString(),
    status: resultRows.find((row) => row.label === "Design status")?.value ?? "Calculated",
    inputRows, resultRows, summarySections, calculationSteps, detailTables: details,
  };
}

const PATTERN_LABELS: Record<WeldInput["pattern"], string> = {
  single: "Single vertical line",
  two_vert: "Two parallel vertical lines",
  two_horiz: "Two parallel horizontal lines",
  l_shape: "L shape",
  u_shape: "U shape",
  rect: "Rectangular / closed loop",
  circle: "Circular ring",
  t_shape: "T shape",
};

const fmt = (value: number, decimals = 2) => formatResultNumber(value, decimals);

function xmlEscape(value: string): string {
  const escapes: Record<string, string> = {
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;",
  };
  return value.replace(/[<>&'\"]/g, (character) => escapes[character] ?? character);
}

function htmlEscape(value: string): string {
  return xmlEscape(value).replace(/\u00a0/g, "&nbsp;");
}

export function createWeldReportData(
  input: WeldInput,
  result: WeldResult,
  system: UnitSystem,
): EngineeringReportData {
  const lengthUnit = getUnitLabel("length", system);
  const stressUnit = getUnitLabel("stress", system);
  const length = (value: number, decimals = 2) => `${fmt(fromBase(value, "length", system), decimals)} ${lengthUnit}`;
  const stress = (value: number, decimals = 2) => `${fmt(fromBase(value, "stress", system), decimals)} ${stressUnit}`;
  const force = (value: number) => displayResultValue(value, "kforce", system, 3);
  const momentUnit = system === "imperial" ? "kip-in" : "kN-m";
  const moment = (value: number) => `${fmt(fromBase(value, "loadMoment", system), 3)} ${momentUnit}`;
  const areaUnit = system === "imperial" ? "in²" : "mm²";
  const inertia3Unit = system === "imperial" ? "in³" : "mm³";
  const inertia4Unit = system === "imperial" ? "in⁴" : "mm⁴";
  const area = fromBase(result.area, "area", system);
  const inertia3Scale = system === "imperial" ? 1 / 25.4 ** 3 : 1;
  const inertia4Scale = system === "imperial" ? 1 / 25.4 ** 4 : 1;
  const status = result.factorOfSafety < 1
    ? "Overstressed"
    : result.factorOfSafety < 1.5
      ? "Warning: below target FOS"
      : "Safe design";
  const dimensions = [
    `Weld leg, h = ${fmt(input.h ?? 0, 3)} ${lengthUnit}`,
    `Width, b / D = ${fmt(input.b ?? 0, 3)} ${lengthUnit}`,
    ...(input.pattern === "circle" ? [] : [`Height, d = ${fmt(input.d ?? 0, 3)} ${lengthUnit}`]),
  ];
  const vector = (x: number, y: number, z: number) =>
    `(${stress(x, 1)}, ${stress(y, 1)}, ${stress(z, 1)})`;
  const hotspotRows = result.stresses.map((item) => [
    item.name,
    `(${length(item.x)}, ${length(item.y)})`,
    vector(item.tauPrimeX, item.tauPrimeY, item.tauPrimeZ),
    vector(item.tauDoubleX, item.tauDoubleY, item.tauDoubleZ),
    vector(item.tauX, item.tauY, item.tauZ),
    stress(item.tauTotal, 1),
    item.tauTotal <= result.allowableStress ? "OK" : "EXCEEDED",
  ]);

  const inputRows: ReportRow[] = [
    { label: "Weld pattern", value: PATTERN_LABELS[input.pattern] },
    ...dimensions.map((value, index) => ({ label: ["Weld leg size", "Width / diameter", "Height"][index] ?? "Dimension", value })),
    { label: "Allowable shear stress", value: `${fmt(input.tauAllow ?? 0, 2)} ${stressUnit}` },
    { label: "Applied force, Fx / Fy / Fz", value: [input.Fx, input.Fy, input.Fz].map((value) => `${fmt(value ?? 0, 3)} ${system === "imperial" ? "kip" : "kN"}`).join(" / ") },
    { label: "Load point, xL / yL / zL", value: [input.xL, input.yL, input.zL].map((value) => `${fmt(value ?? 0, 2)} ${lengthUnit}`).join(" / ") },
    { label: "Applied moments, Mx / My / Mz", value: [input.Mx, input.My, input.Mz].map((value) => `${fmt(value ?? 0, 3)} ${momentUnit}`).join(" / ") },
    { label: "Custom stress point, x / y", value: `${fmt(input.xCustom ?? 0, 2)}, ${fmt(input.yCustom ?? 0, 2)} ${lengthUnit}` },
  ];

  const resultRows: ReportRow[] = [
    { label: "Design status", value: status },
    { label: "Factor of safety", value: fmt(result.factorOfSafety, 2) },
    { label: "Maximum resultant stress", value: stress(result.maxStress, 1) },
    { label: "Critical point", value: result.maxPoint },
    { label: "Allowable stress", value: stress(result.allowableStress, 1) },
    { label: "Effective throat", value: length(result.throat, 4) },
    { label: "Total weld area", value: `${fmt(area, 2)} ${areaUnit}` },
  ];

  const geometryRows: ReportRow[] = [
    { label: "Total weld length", value: length(result.geometry.unitLength) },
    { label: "Weld-group centroid", value: `(${length(result.geometry.centroidX)}, ${length(result.geometry.centroidY)})` },
    { label: "Unit-line inertia, Ixw / Iyw / Jw", value: [result.geometry.ixUnit, result.geometry.iyUnit, result.geometry.jUnit].map((value) => `${fmt(value * inertia3Scale, 2)} ${inertia3Unit}`).join(" / ") },
    { label: "Section inertia, Ix / Iy / J", value: [result.ix, result.iy, result.j].map((value) => `${fmt(value * inertia4Scale, 2)} ${inertia4Unit}`).join(" / ") },
  ];

  const loadRows: ReportRow[] = [
    { label: "Force, Fx / Fy / Fz", value: [result.load.fx, result.load.fy, result.load.fz].map(force).join(" / ") },
    { label: "Resultant moment, Mx / My / Mz", value: [result.load.mx, result.load.my, result.load.mz].map(moment).join(" / ") },
  ];

  const direct = [result.stresses[0]?.tauPrimeX ?? 0, result.stresses[0]?.tauPrimeY ?? 0, result.stresses[0]?.tauPrimeZ ?? 0];
  const offsetMoments = [result.load.mx - toBase(input.Mx ?? 0, "loadMoment", system), result.load.my - toBase(input.My ?? 0, "loadMoment", system), result.load.mz - toBase(input.Mz ?? 0, "loadMoment", system)];
  const calculationSteps = [
    {
      title: "1. Weld pattern geometry",
      equation: "Use the selected weld layout to determine total weld length, centroid, and unit-line inertias.",
      details: [
        `Pattern: ${PATTERN_LABELS[input.pattern]}. ${dimensions.join("; ")}.`,
        `Total length, L = ${length(result.geometry.unitLength)}. Centroid = (${length(result.geometry.centroidX)}, ${length(result.geometry.centroidY)}).`,
        `Unit-line inertias (Ixw, Iyw, Jw) = ${geometryRows[2]?.value}.`,
      ],
    },
    {
      title: "2. Effective throat and section properties",
      equation: "t = 0.7071 h;  Aw = t L;  Ix = t Ixw;  Iy = t Iyw;  J = Ix + Iy.",
      details: [
        `Effective throat, t = 0.7071 × ${fmt(input.h ?? 0, 3)} ${lengthUnit} = ${length(result.throat, 4)}.`,
        `Weld area, Aw = t × L = ${length(result.throat, 4)} × ${length(result.geometry.unitLength)} = ${fmt(area, 2)} ${areaUnit}.`,
        `Actual inertias (Ix, Iy, J) = ${geometryRows[3]?.value}.`,
      ],
    },
    {
      title: "3. Resolve applied loads to the weld-group centroid",
      equation: "Mtotal = Mapplied + r × F,  where r = (xL − x̄, yL − ȳ, zL).",
      details: [
        `Applied forces (Fx, Fy, Fz) = ${[input.Fx, input.Fy, input.Fz].map((value) => `${fmt(value ?? 0, 3)} ${system === "imperial" ? "kip" : "kN"}`).join(", ")}.`,
        `Load point = (${fmt(input.xL ?? 0, 2)}, ${fmt(input.yL ?? 0, 2)}, ${fmt(input.zL ?? 0, 2)}) ${lengthUnit}; centroid = (${length(result.geometry.centroidX)}, ${length(result.geometry.centroidY)}).`,
        `Moment added by the load offset (Mx, My, Mz) = ${offsetMoments.map(moment).join(" / ")}.`,
        `Resultant moments at the centroid (Mx, My, Mz) = ${loadRows[1]?.value}.`,
      ],
    },
    {
      title: "4. Direct shear stress",
      equation: "τ′x = Fx / Aw;  τ′y = Fy / Aw;  τ′z = Fz / Aw.",
      details: [
        `Direct stress vector (τ′x, τ′y, τ′z) = ${vector(direct[0] ?? 0, direct[1] ?? 0, direct[2] ?? 0)}. This vector is common to every evaluation point.`,
      ],
    },
    {
      title: "5. Secondary stress and resultant at each point",
      equation: "τ″x = −Mz(y−ȳ)/J;  τ″y = Mz(x−x̄)/J;  τ″z = Mx(y−ȳ)/Ix − My(x−x̄)/Iy;  τ = √(τx²+τy²+τz²).",
      details: [
        "At each weld endpoint and optional custom point, combine direct and secondary components: τ = τ′ + τ″.",
        "The table shows coordinates, direct vector, secondary vector, combined vector, resultant stress, and allowable check.",
      ],
    },
    {
      title: "6. Factor of safety and design check",
      equation: "FOS = τallow / τmax.",
      details: [
        `FOS = ${stress(result.allowableStress, 1)} / ${stress(result.maxStress, 1)} = ${fmt(result.factorOfSafety, 2)}.`,
        `Critical point: ${result.maxPoint}. Result: ${status}.`,
      ],
    },
  ];

  return createEngineeringReport(
    "Weld Strength Report",
    `Weld Group Statics & Stress · ${PATTERN_LABELS[input.pattern]}`,
    "weld-strength-report",
    inputRows,
    resultRows,
    [{
      title: "Hotspot Stress Breakdown",
      headers: ["Point", `Coordinates (${lengthUnit})`, "Direct shear (x, y, z)", "Secondary shear (x, y, z)", "Combined shear (x, y, z)", `Resultant (${stressUnit})`, "Check"],
      rows: hotspotRows,
    }],
    calculationSteps,
    [
      { title: "Section Geometry", rows: geometryRows },
      { title: "Resultant Loading", rows: loadRows },
    ],
  );
}

export function createBoltGroupReportData(
  input: BoltGroupInput,
  result: BoltGroupResult,
  system: UnitSystem,
): EngineeringReportData {
  const forceUnit = getUnitLabel("kforce", system);
  const lengthUnit = getUnitLabel("length", system);
  const momentUnit = system === "imperial" ? "kip-in" : "kN-m";
  const momentAtCentroid = result.momentAtCog / (system === "imperial" ? 1000 : 1_000_000);
  return createEngineeringReport(
    "Bolt Group Report", "In-plane bolt group analysis", "bolt-group-report",
    [
      { label: "Bolt count", value: String(input.bolts.length) },
      { label: "Bolt sizes", value: [...new Set(input.bolts.map((bolt) => bolt.sizeId))].join(", ") },
      { label: "Applied Fx / Fy", value: `${input.Fx} / ${input.Fy} ${forceUnit}` },
      { label: "Applied Mz", value: `${input.Mz} ${momentUnit}` },
      { label: "Load point x / y", value: `${input.xL} / ${input.yL} ${lengthUnit}` },
    ],
    [
      { label: "Maximum bolt force", value: `${formatSignificantFigures(fromBase(result.maxForce, "kforce", system), 4)} ${forceUnit}` },
      { label: "Critical bolt", value: result.maxBolts.join(", ") },
      { label: "Equilibrium", value: result.equilibriumOk ? "Satisfied" : "Not satisfied" },
      ...result.warnings.map((warning, index) => ({ label: `Warning ${index + 1}`, value: warning })),
    ],
    [{ title: "Bolt Forces", headers: ["Bolt", "Size", `x (${lengthUnit})`, `y (${lengthUnit})`, `Fx (${forceUnit})`, `Fy (${forceUnit})`, `Resultant (${forceUnit})`, "Angle"], rows: result.bolts.map((bolt) => [String(bolt.index), bolt.sizeId, String(fromBase(bolt.x, "length", system)), String(fromBase(bolt.y, "length", system)), String(fromBase(bolt.fx, "kforce", system)), String(fromBase(bolt.fy, "kforce", system)), String(fromBase(bolt.resultant, "kforce", system)), `${bolt.angleDeg.toFixed(2)}°`]) }],
    [
      { title: "1. Resolve loading at the bolt-group centroid", equation: "M_c = M_z + (x_L - x_c)F_y - (y_L - y_c)F_x", details: [`Centroid: (${formatSignificantFigures(fromBase(result.cogX, "length", system), 4)}, ${formatSignificantFigures(fromBase(result.cogY, "length", system), 4)}) ${lengthUnit}.`, `Moment at centroid: ${formatSignificantFigures(momentAtCentroid, 4)} ${momentUnit}.`] },
      { title: "2. Distribute direct and moment loads", equation: "F_i = F_direct,i + F_moment,i", details: [`The maximum resultant bolt force is ${formatSignificantFigures(fromBase(result.maxForce, "kforce", system), 4)} ${forceUnit}.`, `Critical bolt number(s): ${result.maxBolts.join(", ")}.`] },
    ],
  );
}

export function createBoltedJointReportData(
  input: BoltedJointInput,
  result: BoltedJointResult,
  system: UnitSystem,
  options: { fastenerLabel: string; gradeLabel: string; targetFos: number },
): EngineeringReportData {
  const quantity = (value: number, unit: Parameters<typeof getUnitLabel>[0], digits = 4) =>
    `${formatSignificantFigures(fromBase(value, unit, system), digits)} ${getUnitLabel(unit, system)}`;
  const minimumFos = Math.min(result.cases.min.yieldFos, result.cases.min.separationFos, result.externalStripFos, result.internalStripFos, result.pullThroughFos, result.bearingFos, result.boltShearFos, result.slipFos, result.combinedFos, result.clampFos);
  const status = minimumFos < 1 ? "FAIL" : minimumFos < options.targetFos ? "WARNING" : "PASS";
  return createEngineeringReport(
    "Bolted Joint Report", "Preloaded joint strength analysis", "bolted-joint-report",
    [
      { label: "Fastener", value: `${options.fastenerLabel} · ${options.gradeLabel}` },
      { label: "Configuration", value: input.config === "bolt_nut" ? "Bolt and nut" : "Tapped hole" },
      { label: "Plate thicknesses", value: `${quantity(input.plate1.t, "length")} / ${quantity(input.plate2.t, "length")}` },
      { label: "Tensile / shear load", value: `${quantity(input.tensileLoad, "kforce")} / ${quantity(input.shearLoad, "kforce")}` },
      { label: "Preload method", value: input.preloadMode },
      { label: "Target FOS", value: formatSignificantFigures(options.targetFos, 3) },
    ],
    [
      { label: "Design status", value: status },
      { label: "Minimum factor of safety", value: formatSignificantFigures(minimumFos, 3) },
      { label: "Proof load", value: quantity(result.proofLoad, "kforce") },
      { label: "Joint constant", value: formatSignificantFigures(result.c, 4) },
      ...result.warnings.map((warning, index) => ({ label: `Warning ${index + 1}`, value: warning })),
    ],
    [{ title: "Strength Checks", headers: ["Check", "Factor of Safety"], rows: [["Bolt yield (minimum preload)", formatSignificantFigures(result.cases.min.yieldFos, 4)], ["Joint separation", formatSignificantFigures(result.cases.min.separationFos, 4)], ["External thread stripping", formatSignificantFigures(result.externalStripFos, 4)], ["Internal thread stripping", formatSignificantFigures(result.internalStripFos, 4)], ["Pull-through", formatSignificantFigures(result.pullThroughFos, 4)], ["Bearing", formatSignificantFigures(result.bearingFos, 4)], ["Bolt shear", formatSignificantFigures(result.boltShearFos, 4)], ["Slip", formatSignificantFigures(result.slipFos, 4)], ["Combined stress", formatSignificantFigures(result.combinedFos, 4)], ["Required clamp", formatSignificantFigures(result.clampFos, 4)]] }],
    [
      { title: "1. Joint stiffness and load sharing", equation: "C = kb / (kb + km); Fb = Fi + C P", details: [`kb = ${quantity(result.kb, "stiffness")}; km = ${quantity(result.km, "stiffness")}.`, `Joint constant C = ${formatSignificantFigures(result.c, 4)}.`] },
      { title: "2. Preload and proof check", equation: "Fp = Sp At", details: [`Proof load = ${quantity(result.proofLoad, "kforce")}; nominal preload = ${quantity(result.nominalPreload, "kforce")}.`, `Minimum-preload yield FOS = ${formatSignificantFigures(result.cases.min.yieldFos, 4)}.`] },
      { title: "3. Joint strength checks", equation: "FOS = capacity / applied load", details: ["Checks cover separation, thread stripping, bearing, bolt shear, slip, combined stress, and clamp force.", "The detailed results table lists the calculated factors of safety."] },
    ],
  );
}

function renderRows(rows: ReportRow[]): string {
  return rows.map(({ label, value }) => `<tr><th>${htmlEscape(label)}</th><td>${htmlEscape(value)}</td></tr>`).join("");
}

function renderDetailTable(table: ReportDetailTable): string {
  return `<section class="panel"><h2>${htmlEscape(table.title)}</h2><table class="report-table"><thead><tr>${table.headers.map((header) => `<th>${htmlEscape(header)}</th>`).join("")}</tr></thead><tbody>${table.rows.map((row) => `<tr>${row.map((cell) => `<td>${htmlEscape(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></section>`;
}

export function createPrintReportHtml(data: EngineeringReportData, diagramDataUrl: string): string {
  const steps = data.calculationSteps.map((step) => `<section class="step"><h2>${htmlEscape(step.title)}</h2><p class="equation">${htmlEscape(step.equation)}</p><ul>${step.details.map((detail) => `<li>${htmlEscape(detail)}</li>`).join("")}</ul></section>`).join("");
  const summarySections = data.summarySections.map((section) => `<section class="panel"><h2>${htmlEscape(section.title)}</h2><table class="report-table"><tbody>${renderRows(section.rows)}</tbody></table></section>`).join("");
  const detailTables = data.detailTables.map(renderDetailTable).join("");
  const diagram = diagramDataUrl
    ? `<img class="diagram" src="${diagramDataUrl}" alt="Weld group diagram showing geometry, evaluation points, load location, and load vectors" />`
    : `<div class="diagram-empty">Diagram is not available in this view. See the geometry and coordinate summary.</div>`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>Weld Strength Report</title><style>
    @page { size: letter; margin: 0.55in; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #1e293b; font: 10pt Arial, sans-serif; }
    .page { min-height: 9.85in; break-after: page; page-break-after: always; }
    .page:last-child { break-after: auto; page-break-after: auto; }
    .brand { display: flex; align-items: center; gap: 12px; padding: 18px 22px; background: #0f172a; color: white; }
    .brand-mark { display: grid; width: 38px; height: 38px; place-items: center; border-radius: 8px; background: #0ea5e9; font-weight: 700; }
    .brand-title { margin: 0; font-size: 17pt; }
    .brand-subtitle { margin-top: 3px; color: #cbd5e1; font-size: 9pt; }
    .report-meta { display: flex; justify-content: space-between; padding: 12px 22px; background: #f1f5f9; color: #475569; font-size: 9pt; }
    .content { padding: 18px 22px; }
    h2 { margin: 16px 0 8px; color: #0f172a; font-size: 12pt; }
    .status { margin: 10px 0; padding: 12px 14px; border: 1px solid #bae6fd; border-left: 5px solid #0ea5e9; border-radius: 7px; background: #f0f9ff; }
    .status strong { display: block; color: #075985; font-size: 14pt; }
    .status span { display: block; margin-top: 3px; color: #334155; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .panel { margin: 10px 0; border: 1px solid #cbd5e1; border-radius: 7px; overflow: hidden; break-inside: avoid; }
    .panel h2 { margin: 0; padding: 8px 10px; background: #e2e8f0; font-size: 10pt; }
    .report-table { width: 100%; border-collapse: collapse; font-size: 8.2pt; }
    .report-table th, .report-table td { padding: 6px 7px; border: 1px solid #cbd5e1; text-align: left; vertical-align: top; }
    .report-table thead th { background: #e2e8f0; color: #334155; font-size: 7.5pt; }
    .report-table tbody th { width: 43%; color: #475569; font-weight: 600; }
    .report-table tbody tr:nth-child(even) { background: #f8fafc; }
    .diagram { display: block; width: 100%; max-height: 2.9in; object-fit: contain; background: #0f172a; }
    .diagram-empty { padding: 36px; background: #f1f5f9; color: #64748b; text-align: center; }
    .note { margin-top: 12px; color: #64748b; font-size: 8pt; line-height: 1.45; }
    .step { margin: 12px 0; padding: 0 0 8px; border-bottom: 1px solid #cbd5e1; break-inside: avoid; }
    .step h2 { color: #0369a1; }
    .step p, .step ul { margin: 6px 0; line-height: 1.4; }
    .step ul { padding-left: 18px; }
    .step li { margin: 3px 0; }
    .equation { padding: 8px 10px; border-left: 3px solid #0ea5e9; background: #f0f9ff; color: #0f172a; font-family: 'Courier New', monospace; }
    .footer { margin-top: 14px; padding-top: 8px; border-top: 1px solid #cbd5e1; color: #64748b; font-size: 8pt; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style></head><body>
    <main class="page">
      <header class="brand"><div class="brand-mark">EC</div><div><h1 class="brand-title">${htmlEscape(data.title)}</h1><div class="brand-subtitle">Engineering Calculators · ${htmlEscape(data.subtitle)}</div></div></header>
      <div class="report-meta"><span>${htmlEscape(data.subtitle)}</span><span>Generated ${htmlEscape(data.date)}</span></div>
      <div class="content">
        <div class="status"><strong>${htmlEscape(data.status)}${data.resultRows.find((row) => /factor of safety|minimum factor of safety/i.test(row.label)) ? ` · FOS ${htmlEscape(data.resultRows.find((row) => /factor of safety|minimum factor of safety/i.test(row.label))?.value ?? "")}` : ""}</strong><span>${htmlEscape(data.resultRows.find((row) => row.label === "Critical point")?.value ?? data.subtitle)}${data.resultRows.find((row) => row.label === "Maximum resultant stress") ? ` governs at ${htmlEscape(data.resultRows.find((row) => row.label === "Maximum resultant stress")?.value ?? "")}` : ""}</span></div>
        <div class="grid">
          <section class="panel"><h2>Key Results</h2><table class="report-table"><tbody>${renderRows(data.resultRows)}</tbody></table></section>
          <section class="panel"><h2>Inputs</h2><table class="report-table"><tbody>${renderRows(data.inputRows)}</tbody></table></section>
        </div>
        <section class="panel"><h2>Analysis Diagram</h2>${diagram}</section>
        <div class="grid">${summarySections}</div>
        <p class="note">Results are for preliminary estimation. Verify against the governing code, data sheets, and engineering judgment before using them in a final design.</p>
      </div>
    </main>
    <main class="page"><header class="brand"><div class="brand-mark">EC</div><div><h1 class="brand-title">Detailed Calculations</h1><div class="brand-subtitle">${htmlEscape(data.subtitle)}</div></div></header><div class="report-meta"><span>Step-by-step analysis</span><span>Generated ${htmlEscape(data.date)}</span></div><div class="content">${steps}${detailTables}<p class="footer">Preliminary engineering estimate. Confirm assumptions, governing design requirements, material data, and final design independently.</p></div></main>
    <script>window.addEventListener('load',()=>setTimeout(()=>{window.focus();window.print()},250));</script>
  </body></html>`;
}

interface WorkbookSheet {
  name: string;
  rows: string[][];
  headerRows?: number[];
  sectionRows?: number[];
}

function columnName(index: number): string {
  let name = "";
  for (let number = index + 1; number > 0; number = Math.floor((number - 1) / 26)) {
    name = String.fromCharCode(65 + ((number - 1) % 26)) + name;
  }
  return name;
}

function worksheetXml(sheet: WorkbookSheet, hasDrawing = false): string {
  const headerRows = new Set(sheet.headerRows ?? []);
  const sectionRows = new Set(sheet.sectionRows ?? []);
  const rows = sheet.rows.map((row, rowIndex) => {
    const style = headerRows.has(rowIndex) ? 2 : sectionRows.has(rowIndex) ? 3 : rowIndex === 0 ? 1 : 0;
    const cells = row.map((value, columnIndex) => {
      const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
      return `<c r="${reference}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  const maxColumns = Math.max(1, ...sheet.rows.map((row) => row.length));
  const columns = Array.from({ length: maxColumns }, (_, index) => `<col min="${index + 1}" max="${index + 1}" width="${index === 0 ? 34 : 25}" customWidth="1"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"${hasDrawing ? " xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"" : ""}><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${columns}</cols><sheetData>${rows}</sheetData>${hasDrawing ? "<drawing r:id=\"rId1\"/>" : ""}</worksheet>`;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (-(crc & 1) & 0xedb88320);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(files: Array<{ name: string; content: string | Uint8Array }>): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;
  const put16 = (view: DataView, offset: number, value: number) => view.setUint16(offset, value, true);
  const put32 = (view: DataView, offset: number, value: number) => view.setUint32(offset, value, true);

  for (const file of files) {
    const name = encoder.encode(file.name);
    const content = typeof file.content === "string" ? encoder.encode(file.content) : file.content;
    const checksum = crc32(content);
    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    put32(localView, 0, 0x04034b50); put16(localView, 4, 20); put16(localView, 6, 0x0800); put16(localView, 8, 0);
    put16(localView, 10, 0); put16(localView, 12, 0x0021);
    put32(localView, 14, checksum); put32(localView, 18, content.length); put32(localView, 22, content.length);
    put16(localView, 26, name.length); put16(localView, 28, 0); local.set(name, 30);
    localParts.push(local, content);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    put32(centralView, 0, 0x02014b50); put16(centralView, 4, 20); put16(centralView, 6, 20);
    put16(centralView, 8, 0x0800); put16(centralView, 10, 0); put16(centralView, 12, 0); put16(centralView, 14, 0x0021); put32(centralView, 16, checksum);
    put32(centralView, 20, content.length); put32(centralView, 24, content.length);
    put16(centralView, 28, name.length); put16(centralView, 30, 0); put16(centralView, 32, 0);
    put16(centralView, 34, 0); put16(centralView, 36, 0); put32(centralView, 38, 0);
    put32(centralView, 42, localOffset); central.set(name, 46); centralParts.push(central);
    localOffset += local.length + content.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  put32(endView, 0, 0x06054b50); put16(endView, 4, 0); put16(endView, 6, 0);
  put16(endView, 8, files.length); put16(endView, 10, files.length);
  put32(endView, 12, centralSize); put32(endView, 16, localOffset); put16(endView, 20, 0);
  const totalSize = localOffset + centralSize + end.length;
  const zipped = new Uint8Array(totalSize);
  let offset = 0;
  for (const part of [...localParts, ...centralParts, end]) { zipped.set(part, offset); offset += part.length; }
  return zipped;
}

export function downloadWorkbook(data: EngineeringReportData, diagramDataUrl: string): void {
  const sheets: WorkbookSheet[] = [
    {
      name: "Summary",
      rows: [
        [data.title.toUpperCase()],
        [`${data.subtitle} · Generated ${data.date}`],
        [],
        ["KEY RESULTS"],
        ...data.resultRows.map((row) => [row.label, row.value]),
        [],
        ...data.summarySections.flatMap((section) => [[], [section.title.toUpperCase()], ...section.rows.map((row) => [row.label, row.value])]),
        [],
        ["Note", "Preliminary estimate. Verify against the governing code, data sheets, and engineering judgment."],
        [],
        ["ANALYSIS DIAGRAM"],
        ["Current calculator diagram is shown below."],
      ],
      sectionRows: [3],
    },
    {
      name: "Inputs",
      rows: [["INPUT SUMMARY"], ["Input", "Value"], ...data.inputRows.map((row) => [row.label, row.value])],
      headerRows: [1],
    },
    {
      name: "Calculation Steps",
      rows: [
        ["STEP-BY-STEP CALCULATIONS"],
        ...data.calculationSteps.flatMap((step) => [[step.title], [step.equation], ...step.details.map((detail) => [detail])]),
      ],
      sectionRows: data.calculationSteps.map((_, index) => 1 + data.calculationSteps.slice(0, index).reduce((count, step) => count + 2 + step.details.length, 0)),
    },
    {
      name: "Detailed Results",
      rows: data.detailTables.flatMap((table) => [[table.title.toUpperCase()], table.headers, ...table.rows]),
      headerRows: data.detailTables.map((_, index) => data.detailTables.slice(0, index).reduce((sum, table) => sum + table.rows.length + 2, 1)),
    },
  ];

  const sheetFiles = sheets.map((sheet, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, content: worksheetXml(sheet, index === 0 && Boolean(diagramDataUrl)) }));
  const workbookSheets = sheets.map((sheet, index) => `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
  const rels = sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
  const contentOverrides = sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  const drawingFiles: Array<{ name: string; content: string | Uint8Array }> = diagramDataUrl ? [
    { name: "xl/worksheets/_rels/sheet1.xml.rels", content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>` },
    { name: "xl/drawings/drawing1.xml", content: `<?xml version="1.0" encoding="UTF-8"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>25</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx="6400000" cy="4053333"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="Weld Group Diagram"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="6400000" cy="4053333"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>` },
    { name: "xl/drawings/_rels/drawing1.xml.rels", content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/report-diagram.png"/></Relationships>` },
    { name: "xl/media/report-diagram.png", content: dataUrlToBytes(diagramDataUrl) },
  ] : [];
  const drawingTypes = diagramDataUrl
    ? `<Default Extension="png" ContentType="image/png"/><Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`
    : "";
  const files: Array<{ name: string; content: string | Uint8Array }> = [
    { name: "[Content_Types].xml", content: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${drawingTypes}<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${contentOverrides}</Types>` },
    { name: "_rels/.rels", content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/workbook.xml", content: `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: "xl/styles.xml", content: `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="10"/><name val="Aptos"/><color rgb="FF1E293B"/></font><font><b/><sz val="15"/><name val="Aptos Display"/><color rgb="FFFFFFFF"/></font><font><b/><sz val="10"/><name val="Aptos"/><color rgb="FFFFFFFF"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0369A1"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFE2E8F0"/></left><right style="thin"><color rgb="FFE2E8F0"/></right><top style="thin"><color rgb="FFE2E8F0"/></top><bottom style="thin"><color rgb="FFE2E8F0"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" applyFill="1" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="3" borderId="0" applyFill="1" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="2" borderId="0" applyFill="1" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>` },
    ...sheetFiles,
    ...drawingFiles,
  ];
  const bytes = zipStore(files);
  const archive = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([archive], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${data.filename}.xlsx`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const encoded = dataUrl.split(",")[1] ?? "";
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function openPdfReport(data: EngineeringReportData, diagram: string | Promise<string>): void {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    window.alert("The report window was blocked. Allow pop-ups for this site, then try again.");
    return;
  }
  printWindow.document.write("<!doctype html><title>Preparing report…</title><p style='font:16px Arial;padding:24px'>Preparing report…</p>");
  Promise.resolve(diagram).then((diagramUrl) => {
    printWindow.document.open();
    printWindow.document.write(createPrintReportHtml(data, diagramUrl));
    printWindow.document.close();
  });
}

export async function getReportDiagramDataUrl(id: "weld" | "bolt-group" | "bolted-joint"): Promise<string> {
  const element = document.querySelector<HTMLCanvasElement | SVGSVGElement>(`[data-export-diagram="${id}"]`);
  if (!element) return "";
  if (element instanceof HTMLCanvasElement) return element.toDataURL("image/png");
  const markup = new XMLSerializer().serializeToString(element);
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  const image = new Image();
  const bounds = element.viewBox.baseVal;
  image.src = svgUrl;
  try {
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(800, bounds.width || 800);
    canvas.height = Math.max(600, bounds.height || 600);
    const context = canvas.getContext("2d");
    if (!context) return "";
    context.fillStyle = "#0f172a";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } catch {
    return "";
  }
}
