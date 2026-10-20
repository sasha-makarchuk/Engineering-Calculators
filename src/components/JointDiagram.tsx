import { formatSignificantFigures, fromBase, getUnitLabel, type UnitSystem } from "../engineering/units";
import type { JointConfig } from "../engineering/boltedJoint";

// Geometry for the diagram, all in mm. The diagram rescales itself as these change.
export interface JointDiagramProps {
  config: JointConfig;
  d: number;
  headAF: number;
  headHeight: number;
  nutHeight: number;
  washerEnabled: boolean;
  washerOd: number;
  washerT: number;
  hole: number;
  t1: number;
  t2: number;
  grip: number;
  engagement: number;
  boltLength: number;
  threadLength: number;
  system: UnitSystem;
}

const COLORS = {
  plate1: "#bae6fd",
  plate2: "#e2e8f0",
  outline: "#0f172a",
  bolt: "#64748b",
  head: "#334155",
  washer: "#94a3b8",
  nut: "#475569",
  dim: "#0369a1",
  text: "#f8fafc",
};

// Side-section drawing of the joint: head, washers, two plates, nut or tapped hole, with live dimensions.
export function JointDiagram(props: JointDiagramProps) {
  const { config, d, headAF, headHeight, nutHeight, washerEnabled, washerOd, washerT, hole, t1, t2, grip, engagement, boltLength, threadLength, system } = props;
  const isNut = config === "bolt_nut";
  const unit = getUnitLabel("length", system);
  const dim = (mm: number) => `${formatSignificantFigures(fromBase(mm, "length", system), 3)} ${unit}`;

  const wt = washerEnabled ? washerT : 0;
  const dwHead = washerEnabled ? washerOd : headAF;
  const nutAF = headAF;
  const stackMm = wt + t1 + t2 + (isNut ? wt + nutHeight : 0);
  const tipMm = Math.min(boltLength, stackMm + 2.5 * d);
  const totalMm = headHeight + Math.max(stackMm, tipMm);
  const plateMm = Math.max(3 * Math.max(dwHead, nutAF), 6 * d);

  const VW = 500;
  const VH = 520;
  const cx = 250;
  const top = 60;
  const sc = Math.min(365 / totalMm, 275 / plateMm);
  // Thin parts keep a minimum visible height; positions accumulate so nothing overlaps.
  const h = (mm: number) => Math.max(mm * sc, 2.5);

  let y = top;
  const headY0 = y;
  y += h(headHeight);
  const w1Y0 = y;
  y += washerEnabled ? h(washerT) : 0;
  const p1Y0 = y;
  y += h(t1);
  const p2Y0 = y;
  y += h(t2);
  const w2Y0 = y;
  y += isNut && washerEnabled ? h(washerT) : 0;
  const nutY0 = y;
  y += isNut ? h(nutHeight) : 0;
  const stackEndY = y;

  const tipY = Math.max(p1Y0 + 4, Math.min(w1Y0 + boltLength * sc, stackEndY + 2.5 * d * sc));
  const threadStartY = Math.min(Math.max(w1Y0 + (boltLength - threadLength) * sc, w1Y0), tipY);

  const plateW = plateMm * sc;
  const plateX = cx - plateW / 2;
  const shankW = d * sc;
  const holeW = Math.max(hole * sc, shankW);
  const dwHeadPx = dwHead * sc;
  const nutPx = nutAF * sc;
  const xDim = cx + plateW / 2 + 4;
  const xLabel = cx - plateW / 2 - 8;

  const engagementY0 = isNut ? nutY0 : p2Y0;
  const engagementY1 = isNut ? nutY0 + h(nutHeight) : Math.min(p2Y0 + engagement * sc, p2Y0 + h(t2));
  const gripY1 = isNut ? nutY0 : p2Y0;

  const vDim = (y0: number, y1: number, lines: string[], key: string) => (
    <g key={key}>
      <line x1={xDim - 6} y1={y0} x2={xDim + 6} y2={y0} stroke={COLORS.dim} strokeWidth={1} />
      <line x1={xDim - 6} y1={y1} x2={xDim + 6} y2={y1} stroke={COLORS.dim} strokeWidth={1} />
      <line x1={xDim} y1={y0} x2={xDim} y2={y1} stroke={COLORS.dim} strokeWidth={1} markerStart="url(#bj-arrow)" markerEnd="url(#bj-arrow)" />
      {lines.map((text, index) => (
        <text key={text} x={xDim + 5} y={(y0 + y1) / 2 + (index - (lines.length - 1) / 2) * 19 + 6} fontSize={16} fill={COLORS.text} stroke="#0f172a" strokeWidth={3} strokeLinejoin="round" paintOrder="stroke">
          {text}
        </text>
      ))}
    </g>
  );

  const leader = (yMid: number, lines: string[], key: string) => (
    <g key={key}>
      <line x1={xLabel + 4} y1={yMid} x2={plateX + 12} y2={yMid} stroke={COLORS.dim} strokeWidth={1} markerEnd="url(#bj-arrow)" />
      {lines.map((text, index) => (
        <text key={text} x={xLabel} y={yMid + (index - (lines.length - 1) / 2) * 19 + 6} fontSize={16} fill={COLORS.text} stroke="#0f172a" strokeWidth={3} strokeLinejoin="round" paintOrder="stroke" textAnchor="end">
          {text}
        </text>
      ))}
    </g>
  );

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="h-auto w-full max-w-2xl" role="img" aria-label="Section view of the bolted joint with live dimensions">
      <defs>
        <marker id="bj-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={COLORS.dim} />
        </marker>
        <pattern id="bj-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#94a3b8" strokeWidth="1" />
        </pattern>
        <pattern id="bj-thread" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-20)">
          <line x1="0" y1="0" x2="4" y2="0" stroke="#e2e8f0" strokeWidth="1" />
        </pattern>
      </defs>

      {/* Plates */}
      <rect x={plateX} y={p1Y0} width={plateW} height={h(t1)} fill={COLORS.plate1} stroke={COLORS.outline} strokeWidth={1} />
      <rect x={plateX} y={p2Y0} width={plateW} height={h(t2)} fill={COLORS.plate2} stroke={COLORS.outline} strokeWidth={1} />
      <rect x={plateX} y={p2Y0} width={plateW} height={h(t2)} fill="url(#bj-hatch)" />

      {/* Clearance holes (plate 2 is tapped for the tapped-hole configuration) */}
      <rect x={cx - holeW / 2} y={p1Y0} width={holeW} height={h(t1)} fill="#ffffff" />
      {isNut ? <rect x={cx - holeW / 2} y={p2Y0} width={holeW} height={h(t2)} fill="#ffffff" /> : null}

      {/* Shank and threaded region */}
      <rect x={cx - shankW / 2} y={w1Y0} width={shankW} height={Math.max(tipY - w1Y0, 1)} fill={COLORS.bolt} stroke={COLORS.outline} strokeWidth={1} />
      <rect x={cx - shankW / 2} y={threadStartY} width={shankW} height={Math.max(tipY - threadStartY, 0)} fill="url(#bj-thread)" />

      {/* Head and washers */}
      <rect x={cx - (headAF * sc) / 2} y={headY0} width={headAF * sc} height={h(headHeight)} fill={COLORS.head} stroke={COLORS.outline} strokeWidth={1} />
      {washerEnabled ? <rect x={cx - dwHeadPx / 2} y={w1Y0} width={dwHeadPx} height={h(washerT)} fill={COLORS.washer} stroke={COLORS.outline} strokeWidth={1} /> : null}
      {isNut && washerEnabled ? <rect x={cx - dwHeadPx / 2} y={w2Y0} width={dwHeadPx} height={h(washerT)} fill={COLORS.washer} stroke={COLORS.outline} strokeWidth={1} /> : null}
      {isNut ? <rect x={cx - nutPx / 2} y={nutY0} width={nutPx} height={h(nutHeight)} fill={COLORS.nut} stroke={COLORS.outline} strokeWidth={1} /> : null}

      {/* Part names */}
      <text x={cx} y={headY0 - 8} fontSize={19} fill={COLORS.text} stroke="#0f172a" strokeWidth={3} strokeLinejoin="round" paintOrder="stroke" textAnchor="middle">Head</text>
      {washerEnabled ? <text x={cx + dwHeadPx / 2 + 6} y={w1Y0 + h(washerT) / 2 - 8} fontSize={18} fill={COLORS.text} stroke="#0f172a" strokeWidth={3} strokeLinejoin="round" paintOrder="stroke">Washer</text> : null}
      {isNut ? <text x={cx} y={nutY0 + h(nutHeight) / 2 + 6} fontSize={19} fill={COLORS.text} stroke="#0f172a" strokeWidth={3} strokeLinejoin="round" paintOrder="stroke" textAnchor="middle">Nut</text> : null}

      {/* Dimensions */}
      {leader(p1Y0 + h(t1) / 2, ["Plate 1", `(${dim(t1)})`], "p1")}
      {leader(p2Y0 + h(t2) / 2, isNut ? ["Plate 2", `(${dim(t2)})`] : ["Plate 2", "(tapped)", `(${dim(t2)})`], "p2")}
      {vDim(w1Y0, gripY1, ["Grip length", dim(grip)], "grip")}
      {vDim(engagementY0, engagementY1, ["Thread", "engagement", dim(Math.min(engagement, isNut ? engagement : t2))], "eng")}
    </svg>
  );
}
