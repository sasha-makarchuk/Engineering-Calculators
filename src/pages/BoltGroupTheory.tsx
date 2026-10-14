// Theory & References tab for the bolt group shear calculator: every equation and source used by
// engineering/boltGroup.ts, including the metric and imperial shear-area formulas.
import type { ReactNode } from "react";
import { Card } from "../components/Card";
import { Equation } from "../components/Equation";

function Block({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      {description ? <p className="text-xs leading-relaxed text-slate-600">{description}</p> : null}
      {children}
    </div>
  );
}

function Panel({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="space-y-1 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
      {label ? (
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </div>
      ) : null}
      {children}
    </div>
  );
}

const eq = (expression: string) => <Equation key={expression} expression={expression} />;

const NOMENCLATURE: Array<[string, string]> = [
  ["x_i, y_i", "Coordinates of bolt i in the common origin"],
  ["A_i", "Shear area of bolt i (weight of the bolt)"],
  ["A", "Total shear area, sum of A_i"],
  ["x̄, ȳ", "Area-weighted centroid (COG) of the pattern"],
  ["r_xi, r_yi", "Position of bolt i relative to the centroid"],
  ["J", "Polar moment of the bolt areas about the centroid"],
  ["F_xk, F_yk", "Applied force components at point (x_k, y_k)"],
  ["M", "Applied free couple, counter-clockwise positive"],
  ["ΣF_x, ΣF_y", "Total force reduced to the centroid"],
  ["M_c", "Total moment about the centroid"],
  ["F'_i", "Direct (primary) shear on bolt i"],
  ["F''_i", "Moment-induced (secondary) shear on bolt i"],
  ["R_i", "Resultant force on bolt i"],
];

export function BoltGroupTheory() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card>
        <div className="space-y-6">
          <div>
            <h2 className="mb-2 text-lg font-bold text-slate-900">Bolt Group Shear Methodology</h2>
            <p className="text-sm leading-relaxed text-slate-600">
              This calculator finds the shear force carried by each bolt of a group when forces and
              a moment act in the plane of the bolt pattern. It uses the elastic (vector) method:
              the plates are rigid, each bolt deflects in proportion to its distance from the
              centroid, and each bolt resists load in proportion to its shear area. Every bolt then
              sees shear only, a direct part and a moment-induced part that are added in x and y.
              All formulas are evaluated in SI units; the unit toggle only changes display.
            </p>
          </div>
          <hr className="border-slate-200" />

          <Block
            title="1. Bolt shear area"
            description="Bolts of different size resist shear in proportion to their area, so each bolt is weighted by its shear area. The page lets you choose the tensile stress area (shear plane through the threads, the conservative choice) or the major-diameter area (shear plane through the unthreaded shank). The tensile stress area comes from the major diameter and pitch, and the formula differs for metric and imperial threads."
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Panel label="Metric — ISO 724 / ISO 898-1 (pitch p)">
                {eq(String.raw`A_t = \frac{\pi}{4}\left(d - 0.938194\,p\right)^2`)}
              </Panel>
              <Panel label="Imperial — ASME B1.1 (n threads per inch)">
                {eq(String.raw`A_t = 0.7854\left(D - \frac{0.9743}{n}\right)^2`)}
              </Panel>
            </div>
            <Panel label="Shank (both systems)">{eq(String.raw`A_d = \frac{\pi d^2}{4}`)}</Panel>
            <p className="text-xs leading-relaxed text-slate-600">
              When all bolts are the same size the weights cancel, and the method reduces to the
              familiar equal-share and r-proportional formulas.
            </p>
          </Block>

          <Block
            title="2. Centroid of the pattern"
            description="The centroid is the area-weighted average of the bolt coordinates. For identical bolts it is the geometric center."
          >
            <Panel>
              {eq(
                String.raw`\bar{x} = \frac{\sum A_i\,x_i}{\sum A_i}, \qquad \bar{y} = \frac{\sum A_i\,y_i}{\sum A_i}`,
              )}
              {eq(String.raw`r_{xi} = x_i - \bar{x}, \qquad r_{yi} = y_i - \bar{y}`)}
              {eq(String.raw`J = \sum A_i\left(r_{xi}^2 + r_{yi}^2\right)`)}
            </Panel>
          </Block>

          <Block
            title="3. Loads reduced to the centroid"
            description="Each applied force is moved to the centroid, which adds the moment of that force about the centroid. The applied moment is a free couple and is the same about any point."
          >
            <Panel>
              {eq(String.raw`\Sigma F_x = \sum_k F_{xk}, \qquad \Sigma F_y = \sum_k F_{yk}`)}
              {eq(
                String.raw`M_c = M + \sum_k\Big[(x_k - \bar{x})\,F_{yk} - (y_k - \bar{y})\,F_{xk}\Big]`,
              )}
            </Panel>
          </Block>

          <Block
            title="4. Direct (primary) shear"
            description="The total force is shared in proportion to each bolt's shear area."
          >
            <Panel>
              {eq(
                String.raw`F'_{xi} = \Sigma F_x\,\frac{A_i}{A}, \qquad F'_{yi} = \Sigma F_y\,\frac{A_i}{A}`,
              )}
            </Panel>
          </Block>

          <Block
            title="5. Moment-induced (secondary) shear"
            description="The moment is resisted by forces perpendicular to the line from the centroid to each bolt, proportional to the bolt area and its distance. Expressed in components for a counter-clockwise moment M_c:"
          >
            <Panel>
              {eq(
                String.raw`F''_{xi} = -\,\frac{M_c\,A_i\,r_{yi}}{J}, \qquad F''_{yi} = \frac{M_c\,A_i\,r_{xi}}{J}`,
              )}
              {eq(
                String.raw`\lvert F''_i\rvert = \frac{M_c\,A_i\,r_i}{J}, \qquad r_i = \sqrt{r_{xi}^2 + r_{yi}^2}`,
              )}
            </Panel>
            <p className="text-xs leading-relaxed text-slate-600">
              For identical bolts this becomes the standard torsion formula F'' = M_c·r_i / Σr².
            </p>
          </Block>

          <Block title="6. Total force on each bolt">
            <Panel>
              {eq(String.raw`F_{xi} = F'_{xi} + F''_{xi}, \qquad F_{yi} = F'_{yi} + F''_{yi}`)}
              {eq(
                String.raw`R_i = \sqrt{F_{xi}^2 + F_{yi}^2}, \qquad \theta_i = \operatorname{atan2}(F_{yi},\,F_{xi})`,
              )}
            </Panel>
          </Block>

          <Block
            title="7. Equilibrium check"
            description="The calculator verifies that the bolt forces reproduce the loads at the centroid. Any residual above numerical round-off is flagged."
          >
            <Panel>
              {eq(String.raw`\sum F_{xi} = \Sigma F_x, \qquad \sum F_{yi} = \Sigma F_y`)}
              {eq(String.raw`\sum\left(r_{xi}\,F_{yi} - r_{yi}\,F_{xi}\right) = M_c`)}
            </Panel>
          </Block>

          <Block
            title="8. Pattern generators"
            description="Generated bolts are placed relative to a center point (c_x, c_y) and remain editable in the bolt table."
          >
            <Panel label="Rectangle: i = 0…n_c−1, j = 0…n_r−1 (listed bottom to top, left to right)">
              {eq(
                String.raw`x = c_x + \left(i - \tfrac{n_c-1}{2}\right)s_x, \qquad y = c_y + \left(j - \tfrac{n_r-1}{2}\right)s_y`,
              )}
            </Panel>
            <Panel label="Line: n bolts at spacing s and angle α from +x">
              {eq(
                String.raw`t_i = \left(i - \tfrac{n-1}{2}\right)s, \qquad x = c_x + t_i\cos\alpha, \quad y = c_y + t_i\sin\alpha`,
              )}
            </Panel>
            <Panel label="Circle: n bolts on diameter D from start angle φ, counter-clockwise">
              {eq(
                String.raw`\theta_i = \varphi + \frac{360^\circ\,i}{n}, \qquad x = c_x + \tfrac{D}{2}\cos\theta_i, \quad y = c_y + \tfrac{D}{2}\sin\theta_i`,
              )}
            </Panel>
          </Block>

          <Block title="Nomenclature">
            <div className="grid grid-cols-1 gap-x-6 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-2">
              {NOMENCLATURE.map(([symbol, text]) => (
                <div key={symbol} className="flex gap-3">
                  <span className="w-24 shrink-0 font-mono font-semibold text-slate-700">
                    {symbol}
                  </span>
                  <span className="text-slate-600">{text}</span>
                </div>
              ))}
            </div>
          </Block>

          <Block title="Sign conventions and assumptions">
            <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-600">
              <li>
                x to the right, y up, moments positive counter-clockwise; all coordinates share one
                origin.
              </li>
              <li>
                Bolt forces are shown in the same sense as the applied loads: the shear each bolt
                carries from the loaded plate. Reverse the signs for the force the bolt exerts back
                on the plate.
              </li>
              <li>
                All forces and moments lie in the plane of the pattern, so bolts carry shear only.
              </li>
              <li>
                Elastic method: plates are rigid and the bolt response is linear. The
                instantaneous-center method (AISC) allows load to redistribute after yielding and
                usually gives a higher capacity; it is not implemented here.
              </li>
              <li>
                This page reports forces only. Bolt shear, bearing and slip capacity checks are not
                included; the bolt strength calculator covers a single bolt.
              </li>
              <li>
                A single bolt, or bolts all at the centroid, cannot resist a moment and is flagged.
              </li>
            </ul>
          </Block>

          <div className="space-y-3 border-t border-slate-200 pt-4">
            <h3 className="text-sm font-bold text-slate-800">References</h3>
            <ul className="space-y-2 text-xs text-slate-600">
              {REFERENCES.map(([title, text]) => (
                <li key={title} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="font-semibold text-slate-800">{title}</div>
                  <div className="mt-0.5 text-slate-500">{text}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

const REFERENCES: Array<[string, string]> = [
  [
    "Shigley's Mechanical Engineering Design (Budynas & Nisbett), Chapter 8",
    "Bolted and riveted joints loaded in shear: centroid of the bolt group, primary and secondary shear, and the torsion formula for eccentric loads.",
  ],
  [
    "AISC Steel Construction Manual, Part 7",
    "Eccentrically loaded bolt groups: the elastic (vector) method used here and the instantaneous-center method.",
  ],
  [
    "ISO 724 and ISO 898-1",
    "Metric thread dimensions and the tensile stress area (section 1, metric formula).",
  ],
  ["ASME B1.1", "Unified inch threads and the tensile stress area (section 1, imperial formula)."],
];
