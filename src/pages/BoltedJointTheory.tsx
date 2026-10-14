// Theory & References tab for the bolt strength calculator: every equation and source used by
// engineering/boltedJoint.ts, with the metric and imperial thread formulas shown separately.
import type { ReactNode } from "react";
import { Card } from "../components/Card";
import { Equation } from "../components/Equation";

// One titled block of equations with an optional explanation above it.
function Block({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      {description ? <p className="text-xs leading-relaxed text-slate-600">{description}</p> : null}
      {children}
    </div>
  );
}

// Grey panel that holds one or more rendered equations.
function Panel({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="space-y-1 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
      {label ? <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div> : null}
      {children}
    </div>
  );
}

const eq = (expression: string) => <Equation key={expression} expression={expression} />;

const NOMENCLATURE: Array<[string, string]> = [
  ["d, D", "Major (nominal) diameter of the thread"],
  ["p, n", "Pitch (metric); threads per inch (imperial), p = 1/n"],
  ["d₂ (E)", "Pitch diameter"],
  ["d₃ (dᵣ)", "Minor (root) diameter of the external thread"],
  ["D₁", "Minor diameter of the internal thread"],
  ["Aₜ, A_d", "Tensile stress area; area at the major diameter"],
  ["Sₚ, S_y, S_u", "Bolt proof, yield and ultimate strength"],
  ["E_b, E_i", "Modulus of the bolt; of member layer i"],
  ["t₁, t₂, t_w", "Plate 1, plate 2 and washer thickness"],
  ["l, l_eff", "Grip length; effective grip used for stiffness"],
  ["L, L_T", "Bolt length under the head; threaded length"],
  ["l_d, l_t", "Unthreaded and threaded bolt length within the grip"],
  ["k_b, k_m, C", "Bolt stiffness, member stiffness, joint constant"],
  ["F_p, F_i", "Proof load; preload"],
  ["P, V", "External tensile load and shear load on the bolt"],
  ["F_b, F_m", "Bolt force and remaining clamp force"],
  ["K, T", "Nut factor and tightening torque"],
  ["s", "Preload variation, ± fraction of nominal"],
  ["L_e", "Thread engagement length"],
  ["D_w", "Bearing diameter under head / nut (washer OD or across flats)"],
  ["μ", "Friction coefficient for slip resistance"],
];

export function BoltedJointTheory() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card>
        <div className="space-y-6">
          <div>
            <h2 className="mb-2 text-lg font-bold text-slate-900">Bolted Joint Analysis Methodology</h2>
            <p className="text-sm leading-relaxed text-slate-600">
              This calculator checks one preloaded bolt under static loading using the method in Shigley&apos;s Mechanical Engineering Design (Chapter 8):
              the external tension is shared between the bolt and the clamped members through the joint constant C, and the bolt, threads and plates are
              then checked against yield, separation, stripping, pull-through, bearing and shear. All formulas are evaluated in SI units internally;
              the unit toggle and the fastener-system toggle only change how values are entered and displayed.
            </p>
          </div>
          <hr className="border-slate-200" />

          <Block
            title="1. Thread geometry from major diameter and pitch"
            description="Both systems use the same 60° thread profile, so the pitch diameter and the internal minor diameter are identical in form. The formulas differ in how the root of the external thread is taken, which changes the tensile stress area. Every diameter and the stress area follow from the major diameter and the pitch alone."
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Panel label="Metric — ISO 724, ISO 898-1 (pitch p, mm)">
                {eq(String.raw`d_2 = d - 0.649519\,p`)}
                {eq(String.raw`d_3 = d - 1.226869\,p`)}
                {eq(String.raw`D_1 = d - 1.082532\,p`)}
                {eq(String.raw`A_t = \frac{\pi}{4}\left(\frac{d_2 + d_3}{2}\right)^2 = \frac{\pi}{4}\left(d - 0.938194\,p\right)^2`)}
              </Panel>
              <Panel label="Imperial — ASME B1.1, UNC / UNF (n threads per inch)">
                {eq(String.raw`p = \frac{1}{n}`)}
                {eq(String.raw`E = D - \frac{0.649519}{n}`)}
                {eq(String.raw`d_r = D - \frac{1.299038}{n}`)}
                {eq(String.raw`D_1 = D - \frac{1.082532}{n}`)}
                {eq(String.raw`A_t = \frac{\pi}{4}\left(\frac{E + d_r}{2}\right)^2 = 0.7854\left(D - \frac{0.9743}{n}\right)^2`)}
              </Panel>
            </div>
            <Panel label="Both systems">{eq(String.raw`A_d = \frac{\pi d^2}{4}`)}</Panel>
          </Block>

          <Block title="2. Thread length of the bolt" description="Standard thread length for hex bolts, used to split the grip into unthreaded and threaded parts.">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Panel label="Metric (mm)">
                {eq(String.raw`L_T = \begin{cases} 2d + 6 & L \le 125 \\ 2d + 12 & 125 < L \le 200 \\ 2d + 25 & L > 200 \end{cases}`)}
              </Panel>
              <Panel label="Imperial (in)">
                {eq(String.raw`L_T = \begin{cases} 2D + \tfrac{1}{4} & L \le 6 \\ 2D + \tfrac{1}{2} & L > 6 \end{cases}`)}
              </Panel>
            </div>
          </Block>

          <Block title="3. Grip, bolt stiffness and member stiffness" description="For a bolt and nut the grip is the full stack. For a tapped hole Shigley's effective grip adds half the tapped plate thickness, limited to d/2.">
            <Panel label="Grip length">
              {eq(String.raw`l = t_1 + t_2 + 2\,t_w \quad (\text{bolt + nut})`)}
              {eq(String.raw`h = t_1 + t_w, \qquad l_{eff} = \begin{cases} h + t_2/2 & t_2 < d \\ h + d/2 & t_2 \ge d \end{cases} \quad (\text{tapped hole})`)}
              {eq(String.raw`l_d = \min\!\big(\max(L - L_T,\,0),\,l\big), \qquad l_t = l - l_d`)}
            </Panel>
            <Panel label="Bolt stiffness (Shigley, Ch. 8)">
              {eq(String.raw`k_b = \frac{A_d\,A_t\,E_b}{A_d\,l_t + A_t\,l_d}`)}
            </Panel>
            <Panel label="Member stiffness (frustum method, 30° half-angle)">
              {eq(String.raw`k_i = \frac{0.5774\,\pi\,E_i\,d}{\ln\dfrac{\left(1.155\,t_i + D - d\right)\left(D + d\right)}{\left(1.155\,t_i + D + d\right)\left(D - d\right)}}`)}
              {eq(String.raw`k_m = \left(\sum_i \frac{1}{k_i}\right)^{-1}`)}
            </Panel>
            <p className="text-xs leading-relaxed text-slate-600">
              Two opposing pressure cones start at the head and nut bearing diameters D<sub>w</sub> and meet at mid-grip. The cones are cut at each plate and washer
              boundary, so each layer is one frustum with its own modulus E<sub>i</sub>, and D is the cone diameter at the narrow end of that frustum (D<sub>w</sub> + 1.155·z at depth z).
              Frustum stiffnesses add in series, which handles dissimilar plates and washers.
            </p>
            <Panel label="Joint constant">{eq(String.raw`C = \frac{k_b}{k_b + k_m}`)}</Panel>
          </Block>

          <Block title="4. Preload" description="Target preload as a percentage of proof load (Shigley suggests 75 % for reusable and 90 % for permanent joints), a specified force, or a tightening torque with nut factor K. Min and max preload apply the selected variation s.">
            <Panel>
              {eq(String.raw`F_p = S_p\,A_t`)}
              {eq(String.raw`F_i = \frac{\%}{100}\,F_p \quad\text{or}\quad F_i = \frac{T}{K\,d}`)}
              {eq(String.raw`T = K\,F_i\,d`)}
              {eq(String.raw`F_{i,\min} = (1 - s)\,F_i, \qquad F_{i,\max} = (1 + s)\,F_i`)}
            </Panel>
          </Block>

          <Block title="5. Bolt load and tensile yield">
            <Panel>
              {eq(String.raw`F_b = F_i + C\,P`)}
              {eq(String.raw`n_y = \frac{S_y\,A_t}{F_b}`)}
            </Panel>
          </Block>

          <Block title="6. Joint separation">
            <Panel>
              {eq(String.raw`F_m = F_i - (1 - C)\,P`)}
              {eq(String.raw`n_0 = \frac{F_i}{(1 - C)\,P}`)}
            </Panel>
          </Block>

          <Block
            title="7. Thread stripping"
            description="Shear areas of the engaged threads from the basic thread profile (Machinery's Handbook). The thread density is n = 1/p for metric threads and n = threads per inch for imperial threads, so the same expressions apply to both. Shear strength is taken as 0.6 times the ultimate strength of the weaker material, and the check uses the maximum bolt force."
          >
            <Panel>
              {eq(String.raw`A_{s,ext} = \pi\,n\,L_e\,D_1\left[\frac{1}{2n} + 0.57735\,(d_2 - D_1)\right]`)}
              {eq(String.raw`A_{s,int} = \pi\,n\,L_e\,d\left[\frac{1}{2n} + 0.57735\,(d - d_2)\right]`)}
              {eq(String.raw`F_{strip} = 0.6\,S_u\,A_s, \qquad n_{strip} = \frac{F_{strip}}{F_{b,\max}}`)}
            </Panel>
            <p className="text-xs leading-relaxed text-slate-600">
              The external thread uses the bolt S<sub>u</sub>. The internal thread uses the nut S<sub>u</sub> (matched to the bolt unless overwritten) or, for a tapped hole, the S<sub>u</sub> of plate 2.
              For a tapped hole the default engagement is the length that lets the internal threads carry the full bolt strength, limited to between 1d and 3d and to the plate thickness:
            </p>
            <Panel>{eq(String.raw`L_{e,req} = \frac{S_{u,bolt}\,A_t}{0.6\,S_{u,int}\,A_{s,int}/L_e}`)}</Panel>
          </Block>

          <Block title="8. Pull-through and plate bearing" description="Pull-through is the shear of a plug the size of the washer (or head / nut across flats) through the plate. Bearing compares the shear load with the yield bearing strength of the weaker plate.">
            <Panel>
              {eq(String.raw`F_{pt} = 0.6\,S_u\,\pi\,D_w\,t, \qquad n_{pt} = \frac{F_{pt}}{F_{b,\max}}`)}
              {eq(String.raw`F_{br} = S_y\,d\,t, \qquad n_{br} = \frac{F_{br}}{V}`)}
            </Panel>
          </Block>

          <Block title="9. Shear, slip and combined loading" description="The shear area A_s is A_t when the shear plane passes through the threads and A_d through the unthreaded shank. Slip uses the clamp force remaining at minimum preload. The combined check uses the von Mises stress at maximum bolt force.">
            <Panel>
              {eq(String.raw`n_{shear} = \frac{0.577\,S_y\,A_s}{V}`)}
              {eq(String.raw`n_{slip} = \frac{\mu\,F_{m,\min}}{V}`)}
              {eq(String.raw`\sigma_{vm} = \sqrt{\left(\frac{F_{b,\max}}{A_t}\right)^2 + 3\left(\frac{V}{A_s}\right)^2}, \qquad n = \frac{S_y}{\sigma_{vm}}`)}
            </Panel>
          </Block>

          <Block title="10. Bolt strength properties">
            <p className="text-xs leading-relaxed text-slate-600">
              Metric property classes a.b follow ISO 898-1: the nominal ultimate strength is 100·a MPa and the nominal yield strength is 10·a·b MPa (class 10.9: 1000 and 900 MPa).
              The calculator uses the minimum proof, yield and ultimate values tabulated in Shigley Table 8-11. Inch grades use Shigley Table 8-9 (SAE J429) and
              ASTM F3125 (A325, A490), with the size breaks those standards define, for example Grade 5 above 1 in.
            </p>
          </Block>

          <Block title="Nomenclature">
            <div className="grid grid-cols-1 gap-x-6 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-2">
              {NOMENCLATURE.map(([symbol, text]) => (
                <div key={symbol} className="flex gap-3">
                  <span className="w-24 shrink-0 font-mono font-semibold text-slate-700">{symbol}</span>
                  <span className="text-slate-600">{text}</span>
                </div>
              ))}
            </div>
          </Block>

          <Block title="Assumptions and limits">
            <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-600">
              <li>One bolt in single shear, static loading only. Bolt patterns and fatigue are not included.</li>
              <li>The external tensile load acts along the bolt axis and is split between bolt and members by C.</li>
              <li>Yield checks use S<sub>y</sub>·A<sub>t</sub>. Residual torsion from tightening is neglected.</li>
              <li>Thread-strip areas use basic (nominal) thread dimensions, not tolerance limits.</li>
              <li>Quard 400 and 450 strengths are typical values; yield is not guaranteed in the supplier data sheet.</li>
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
  ["Shigley's Mechanical Engineering Design (Budynas & Nisbett), Chapter 8", "Bolt and member stiffness, joint constant, preload, separation and proof-strength checks; Tables 8-9 (SAE grades), 8-11 (ISO classes) and 8-15 (torque coefficients)."],
  ["ISO 724 and ISO 261", "Metric thread basic dimensions: pitch, pitch diameter, minor diameters (metric formulas in section 1)."],
  ["ISO 898-1", "Mechanical properties of carbon and alloy steel bolts, classes 4.6 to 12.9, and the metric tensile stress area."],
  ["ASME B1.1", "Unified inch screw threads, UNC and UNF: basic dimensions and the tensile stress area (imperial formulas in section 1)."],
  ["SAE J429; ASTM F3125 (A325, A490)", "Inch bolt grades with size-dependent proof, yield and tensile strength."],
  ["ISO 273, ISO 7089, ISO 4032, ISO 4017", "Metric clearance holes, plain washers, hex nuts and hex bolts."],
  ["ASME B18.2.1, B18.2.2, B18.22.1", "Inch hex bolts, hex nuts and flat washers."],
  ["Machinery's Handbook (Industrial Press)", "Unified and metric thread dimensions, and the thread-stripping shear area equations."],
  ["Bickford, An Introduction to the Design and Behavior of Bolted Joints", "Preload scatter by tightening method, nut factors and thread-stripping behavior."],
  ["VDI 2230 Part 1", "Systematic calculation of highly stressed bolted joints. A cross-reference only; its procedure is not implemented here."],
  ["CSA G40.21 (44W, 350W), ASTM A36, A572, A514 / A709-100, SSAB Quard data sheets", "Plate material strengths used in the material list."],
];
