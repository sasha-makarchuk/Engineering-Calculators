import {
  formatSignificantFigures,
  fromBase,
  toBase,
  getUnitLabel,
  type UnitSystem,
} from "../engineering/units";

import { type BoltForceResult } from "../engineering/boltGroup";

export interface DiagramForce {
  fx: number; // N
  fy: number; // N
  x: number; // mm
  y: number; // mm
}

export interface BoltGroupDiagramProps {
  bolts: BoltForceResult[];
  forces: DiagramForce[];
  cogX: number;
  cogY: number;
  momentAtCog: number; // N-mm, counter-clockwise positive
  highlight: number | null; // bolt number hovered in the table
  system: UnitSystem;
}

const VW = 640;
const VH = 380;
const PAD = 78;
const MAX_BOLT_ARROW = 40; // px length of the largest bolt resultant arrow
const FORCE_ARROW = 56; // px length of the largest applied force arrow

// Colour scale from a light blue (low load) to orange (maximum load).
function boltFill(ratio: number): string {
  const t = Math.min(Math.max(ratio, 0), 1);
  const from = [186, 230, 253];
  const to = [249, 115, 22];
  const mix = from.map((value, i) => Math.round(value + (to[i]! - value) * t));
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
}

// Plan view of the bolt pattern: bolts, centroid, applied forces and the force carried by each bolt.
export function BoltGroupDiagram(props: BoltGroupDiagramProps) {
  const { bolts, forces, cogX, cogY, momentAtCog, highlight, system } = props;
  const lengthUnit = getUnitLabel("length", system);
  const forceUnit = getUnitLabel("kforce", system);
  const pos = (mm: number) => formatSignificantFigures(fromBase(toBase(mm, "length", system), "length", system), 4);
  const frc = (n: number) => formatSignificantFigures(fromBase(toBase(n, "force", system), "kforce", system), 4);

  // Fit the bolts, centroid and force application points into the drawing area.
  const xs = [cogX, ...bolts.map((b) => b.x), ...forces.map((f) => f.x)];
  const ys = [cogY, ...bolts.map((b) => b.y), ...forces.map((f) => f.y)];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1e-6);
  const spanY = Math.max(maxY - minY, 1e-6);
  const scale = Math.min((VW - 2 * PAD) / spanX, (VH - 2 * PAD) / spanY);
  const offsetX = (VW - spanX * scale) / 2;
  const offsetY = (VH - spanY * scale) / 2;
  const px = (x: number) => offsetX + (x - minX) * scale;
  const py = (y: number) => VH - offsetY - (y - minY) * scale;

  const dMax = Math.max(...bolts.map((b) => b.d), 1e-6);
  const maxBolt = Math.max(...bolts.map((b) => Math.hypot(b.fx, b.fy)), 0);
  const maxApplied = Math.max(...forces.map((f) => Math.hypot(f.fx, f.fy)), 0);
  const labelSize = bolts.length > 99 ? 6 : bolts.length > 9 ? 7.5 : 8.5;
  const minimumBoltLabelSpacing = Math.max(16, labelSize * 2.2);

  const cx = px(cogX);
  const cy = py(cogY);
  const arcR = 24;
  const ccw = momentAtCog > 0;
  // Arc of 270° around the centroid with an arrow head showing the moment direction.
  const arc = `M ${cx + arcR} ${cy} A ${arcR} ${arcR} 0 1 ${ccw ? 0 : 1} ${cx} ${cy + (ccw ? arcR : -arcR)}`;

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      className="h-auto w-full"
      role="img"
      aria-label="Plan view of the bolt group with centroid, applied forces and bolt forces"
    >
      <defs>
        <marker
          id="bg-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0 0L10 5L0 10z" fill="#0369a1" />
        </marker>
        <marker
          id="bg-applied"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
        >
          <path d="M0 0L10 5L0 10z" fill="#dc2626" />
        </marker>
        <marker
          id="bg-moment"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0 0L10 5L0 10z" fill="#7c3aed" />
        </marker>
      </defs>

      {/* Axis indicator */}
      <g stroke="#cbd5e1" strokeWidth={1.5}>
        <line x1={24} y1={VH - 20} x2={56} y2={VH - 20} markerEnd="url(#bg-arrow)" />
        <line x1={24} y1={VH - 20} x2={24} y2={VH - 52} markerEnd="url(#bg-arrow)" />
      </g>
      <text x={60} y={VH - 16} fontSize={11} fill="#cbd5e1">
        x
      </text>
      <text x={20} y={VH - 58} fontSize={11} fill="#cbd5e1">
        y
      </text>

      {/* Applied forces: the arrow head sits on the application point */}
      {forces.map((force, i) => {
        const magnitude = Math.hypot(force.fx, force.fy);
        if (magnitude === 0) return null;
        const length = Math.max(FORCE_ARROW * (magnitude / maxApplied), 24);
        const ux = force.fx / magnitude;
        const uy = -force.fy / magnitude; // SVG y points down
        const hx = px(force.x);
        const hy = py(force.y);
        const tx = hx - ux * length;
        const ty = hy - uy * length;
        const forceLabel = `${frc(magnitude)} ${forceUnit}`;
        const labelX = (tx + hx) / 2 + 8;
        const labelY = (ty + hy) / 2 - 6;
        return (
          <g key={`force-${i}`}>
            <line x1={cx} y1={cy} x2={hx} y2={hy} stroke="#cbd5e1" strokeDasharray="5 4" />
            <line
              x1={tx}
              y1={ty}
              x2={hx}
              y2={hy}
              stroke="#dc2626"
              strokeWidth={3}
              markerEnd="url(#bg-applied)"
            />
            <text
              x={labelX}
              y={labelY + 3}
              fontSize={10.5}
              fill="#fecaca"
              fontWeight={700}
            >
              {forceLabel}
            </text>
          </g>
        );
      })}

      {/* Bolts: smaller circles sized by diameter, coloured by load, with the carried force as an arrow */}
      {bolts.map((bolt) => {
        const x = px(bolt.x);
        const y = py(bolt.y);
        const radius = 5 + 3 * (bolt.d / dMax);
        const magnitude = Math.hypot(bolt.fx, bolt.fy);
        const arrow = maxBolt > 0 ? (MAX_BOLT_ARROW * magnitude) / maxBolt : 0;
        const ux = magnitude > 0 ? bolt.fx / magnitude : 0;
        const uy = magnitude > 0 ? -bolt.fy / magnitude : 0;
        const active = highlight === bolt.index;
        const showIndex =
          active ||
          (bolts.length <= 30 &&
            bolts.every(
              (other) =>
                other.index === bolt.index ||
                Math.hypot(px(other.x) - x, py(other.y) - y) >= minimumBoltLabelSpacing,
            ));
        return (
          <g key={bolt.index}>
            {arrow > 3 ? (
              <line
                x1={x}
                y1={y}
                x2={x + ux * arrow}
                y2={y + uy * arrow}
                stroke="#0369a1"
                strokeWidth={2}
                markerEnd="url(#bg-arrow)"
              />
            ) : null}
            <circle
              cx={x}
              cy={y}
              r={radius}
              fill={bolt.isMax ? "#f97316" : boltFill(bolt.ratio)}
              stroke={active ? "#7c3aed" : bolt.isMax ? "#c2410c" : "#0f172a"}
              strokeWidth={active ? 3 : bolt.isMax ? 2 : 1}
            />
            {showIndex ? (
              <text
                x={x}
                y={y + labelSize / 3}
                fontSize={labelSize}
                textAnchor="middle"
                fill="#0f172a"
                fontWeight={700}
              >
                {bolt.index}
              </text>
            ) : null}
          </g>
        );
      })}

      {/* Distinct purple centroid marker, separated from bolt circles and arrows. */}
      <g aria-label="Bolt-group centroid">
        <circle cx={cx} cy={cy} r={11} fill="#a855f7" fillOpacity={0.22} />
        <path
          d={`M ${cx} ${cy - 7} L ${cx + 7} ${cy} L ${cx} ${cy + 7} L ${cx - 7} ${cy} Z`}
          fill="#7c3aed"
          stroke="#f3e8ff"
          strokeWidth={1.5}
        />
        <circle cx={cx} cy={cy} r={1.5} fill="#ffffff" />
        <title>{`Centroid (${pos(cogX)}, ${pos(cogY)}) ${lengthUnit}`}</title>
      </g>
      {momentAtCog !== 0 ? (
        <path d={arc} fill="none" stroke="#7c3aed" strokeWidth={2} markerEnd="url(#bg-moment)" />
      ) : null}
    </svg>
  );
}
