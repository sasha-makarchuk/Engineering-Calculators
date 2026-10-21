// Weld calculator imports React state/effects, reusable UI components, and the engineering engine.
import { useState } from "react";
import { Card } from "../components/Card";
import { MetricTile } from "../components/MetricTile";
import { CalculatorPageShell } from "../components/CalculatorPageShell";
import { DiagramPanel } from "../components/DiagramPanel";
import { LoadsInputCard } from "../components/LoadsInputCard";
import { Equation } from "../components/Equation";
import { type PageTab } from "../components/SiteHeader";
import { UnitInput } from "../components/UnitInput";
import { TheoryNomenclature, TheoryPanel, TheoryReferences, TheorySection } from "../components/TheorySection";
import { SelectInput } from "../components/Dropdown";
import { WeldDiagram } from "../components/WeldDiagram";
import { StatusBanner } from "../components/StatusBanner";
import { ReportExportActions } from "../components/ReportExportActions";
import { useUnitSystem } from "../components/units/UnitContext";
import { useCalculationResult } from "../hooks/useCalculationResult";
import { useCurrentInput } from "../hooks/useCurrentInput";
import { displayResultValue, calculateWeldGroup, formatResultNumber, type WeldInput, type WeldPattern, weldUnitSchema } from "../engineering/weldGroup";
import { createWeldReportData, downloadWorkbook, getReportDiagramDataUrl, openPdfReport } from "../engineering/engineeringReport";
import { fromBase, getUnitLabel, toBase, convertFromState, type UnitSystem } from "../engineering/units";

// Dropdown display data for each supported weld pattern.
const patternOptions: Array<{ value: WeldPattern; label: string }> = [
  { value: "single", label: "Single Vertical Line (d)" },
  { value: "two_vert", label: "Two Parallel Vertical Lines (b, d)" },
  { value: "two_horiz", label: "Two Parallel Horizontal Lines (b, d)" },
  { value: "l_shape", label: "L-Shape (b, d)" },
  { value: "u_shape", label: "U-Shape / Channel (b, d)" },
  { value: "rect", label: "Rectangular / Closed Loop (b, d)" },
  { value: "circle", label: "Circular Ring (Diameter D)" },
  { value: "t_shape", label: "T-Shape (b, d)" },
];

// Default example inputs displayed when the calculator opens.
const initialInput: WeldInput = {
  unitSystem: "imperial",
  pattern: "single",
  h: 0.25,
  b: 6.0,
  d: 8.0,
  Fx: 1.2,
  Fy: -4.5,
  Fz: 0,
  xL: 3.0,
  yL: 4.0,
  zL: 0,
  Mx: 0,
  My: 0,
  Mz: 18,
  tauAllow: 21000,
  xCustom: 3.0,
  yCustom: 4.0,
};

function convertWeldForm(input: WeldInput, fromSystem: UnitSystem, toSystem: UnitSystem,): WeldInput {
  return convertFromState(input, weldUnitSchema, fromSystem, toSystem);
}

// Main weld calculator page: manages state, tabs, unit synchronization, and results.
export function WeldStrengthPage() {
  const { unitSystem } = useUnitSystem();
  const [pageTab, setPageTab] = useState<PageTab>("calc");
  const [input, setInput] = useState<WeldInput>(initialInput);

  const currentInput = useCurrentInput(input, setInput, unitSystem, convertWeldForm);

  const resultState = useCalculationResult(currentInput, calculateWeldGroup);

  // Generic typed updater keeps the field name and value type connected.
  //COMMON CODE??
  const update = <K extends keyof WeldInput>(field: K, value: WeldInput[K]) => {
    setInput((previous) => ({ ...previous, [field]: value, unitSystem }));
  };

  const result = resultState.result;
  const lengthUnit = getUnitLabel("length", unitSystem);
  const reportData = result ? createWeldReportData(currentInput, result, unitSystem) : null;

  return (
    <CalculatorPageShell
      icon="fa-solid fa-layer-group"
      title={<> Weld Group Statics & amp; Stress</>}
      subtitle="Analysis & Hotspot Efficiency Calculator"
      pageTab={pageTab}
      setPageTab={setPageTab}
      tabActions={pageTab === "calc" && result && reportData ? <ReportExportActions onPdfExport={() => openPdfReport(reportData, getReportDiagramDataUrl("weld"))} onExcelExport={async () => downloadWorkbook(reportData, await getReportDiagramDataUrl("weld"))} /> : null}
    >
      {pageTab === "calc" ? (
        <>
          {/* Main responsive layout: inputs on the left, visualization/results on the right. */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-5">
              {/* Geometry inputs: pattern selection and dimensions. */}
              <Card title="Weld Pattern Geometry" icon="fa-solid fa-shapes">
                <div className="space-y-4" >
                  <SelectInput<WeldPattern>
                    label="Pattern Configuration"
                    value={currentInput.pattern}
                    options={patternOptions}
                    onChange={(value) => update("pattern", value)}
                  />
                  <UnitInput label="Weld Leg Size (h)" quantity="length" value={currentInput.h} onChange={(value) => update("h", value)} min={0.000001} step={unitSystem === "imperial" ? 0.01 : 0.1} />
                  <UnitInput label="Width (b / D)" quantity="length" value={currentInput.b} onChange={(value) => update("b", value)} min={0.000001} step={unitSystem === "imperial" ? 0.1 : 1} />
                  <UnitInput label="Height (d)" quantity="length" value={currentInput.d} onChange={(value) => update("d", value)} min={0.000001} step={unitSystem === "imperial" ? 0.1 : 1} disabled={currentInput.pattern === "circle"} />
                  {currentInput.pattern === "circle" ? <p className="-mt-2 text-[10px] text-slate-400">Circular patterns use b/D as the diameter.</p> : null}
                </div>
              </Card>

              {/* Force magnitudes and load application coordinates. */}
              <LoadsInputCard
                values={currentInput}
                onChange={update}
              />

              {/* Allowable shear stress used for the safety-factor check. */}
              <Card title="Weld Strength Criteria" icon="fa-solid fa-shield-halved">
                <UnitInput
                  label="Allowable Shear Stress (τallow)"
                  quantity="stress"
                  value={currentInput.tauAllow}
                  onChange={(value) => update("tauAllow", value)}
                  min={0.000001}
                  step={unitSystem === "imperial" ? 500 : 1}
                  description="Standard E70XX electrodes: 0.30 × 70 ksi = 21.0 ksi allowable shear."
                />
              </Card>

              {/* Optional custom point for an additional stress evaluation. */}
              <Card title="Custom Point Stress Check" icon="fa-solid fa-crosshairs">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <UnitInput label="Point Xcustom" quantity="length" value={currentInput.xCustom} onChange={(value) => update("xCustom", value)} step={unitSystem === "imperial" ? 0.5 : 1} />
                  <UnitInput label="Point Ycustom" quantity="length" value={currentInput.yCustom} onChange={(value) => update("yCustom", value)} step={unitSystem === "imperial" ? 0.5 : 1} />
                </div>
              </Card>
            </div>

            <div className="space-y-6 lg:col-span-7">
              <DiagramPanel
                title="2D Weld Vector & Node Visualizer"
                legend={[
                  { label: "Weld", colorClassName: "bg-sky-400", swatch: "line" },
                  { label: "Nodes", colorClassName: "bg-amber-400" },
                  { label: "CG", colorClassName: "bg-red-500" },
                ]}
              >
                {result ? (
                  <WeldDiagram
                    result={result}
                    xLoadBase={toBase(currentInput.xL ?? 0, "length", unitSystem)}
                    yLoadBase={toBase(currentInput.yL ?? 0, "length", unitSystem)}
                    xCustomBase={toBase(currentInput.xCustom ?? 0, "length", unitSystem)}
                    yCustomBase={toBase(currentInput.yCustom ?? 0, "length", unitSystem)}
                  />
                ) : (
                  <div className="flex min-h-[380px] w-full max-w-2xl items-center justify-center rounded border border-red-900 bg-slate-900 p-6 text-center text-sm text-red-300">
                    Enter valid inputs to display the diagram.
                  </div>
                )}
              </DiagramPanel>

              {/* Display calculated result panels when the engineering calculation succeeds. */}
              {result ? (
                <>
                  <StatusBanner
                    FOS={result.factorOfSafety}
                    maxValue={result.maxStress}
                    maxQuantity="stress"
                    hotspotLabel="Max Hotspot Stress (τmax)"
                    system={unitSystem}
                  />
                  <SectionProperties result={result} system={unitSystem} />
                  <LoadSummary result={result} system={unitSystem} />
                </>
              ) : (
                <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">{resultState.error}</div>
              )}
            </div>
          </div>

          {/* Detailed stress breakdown for each hotspot/evaluation point. */}
          {result ? <HotspotTable result={result} system={unitSystem} /> : null}

          <p className="mt-4 text-center text-[11px] text-slate-400">
            Results are for preliminary estimation. Verify against the governing code, data sheets
            and engineering judgment before using them in a final design.
          </p>
        </>
      ) : <Theory />}
    </CalculatorPageShell>
  );
}

// Calculated weld-group section properties converted for display.
function SectionProperties({ result, system }: { result: NonNullable<ReturnType<typeof calculateWeldGroup>>; system: "imperial" | "si" }) {
  const lengthUnit = getUnitLabel("length", system);
  const areaScale = system === "imperial" ? 1 / 25.4 ** 2 : 1;
  const thirdScale = system === "imperial" ? 1 / 25.4 ** 3 : 1;
  const fourthScale = system === "imperial" ? 1 / 25.4 ** 4 : 1;
  const areaUnit = system === "imperial" ? "in²" : "mm²";
  const thirdUnit = system === "imperial" ? "in³" : "mm³";
  const fourthUnit = system === "imperial" ? "in⁴" : "mm⁴";
  return (
    <Card title="Calculated Section Properties" icon="fa-solid fa-calculator">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricTile align="center" label="Throat Thickness (t)" value={`${formatResultNumber(fromBase(result.throat, "length", system), 4)} ${lengthUnit}`} />
          <MetricTile align="center" label="Centroid (x̄, ȳ)" value={`(${formatResultNumber(fromBase(result.geometry.centroidX, "length", system), 2)}, ${formatResultNumber(fromBase(result.geometry.centroidY, "length", system), 2)}) ${lengthUnit}`} />
          <MetricTile align="center" label="Total Weld Area (Aw)" value={`${formatResultNumber(result.area * areaScale, 2)} ${areaUnit}`} />
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[640px] border-slate-100 text-center font-mono">
            <thead className="data-table-header"><tr><th className="px-3 py-2 text-left">Property Type</th><th className="px-3 py-2">Unit Property (per unit throat)</th><th className="px-3 py-2">Total Actual Property</th></tr></thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              <tr><td className="px-3 py-2 text-left font-sans font-semibold text-slate-600">Length / Area</td><td className="px-3 py-2 text-slate-800">{formatResultNumber(fromBase(result.geometry.unitLength, "length", system), 2)} {lengthUnit}</td><td className="px-3 py-2 font-bold text-slate-900">{formatResultNumber(result.area * areaScale, 2)} {areaUnit}</td></tr>
              <tr><td className="px-3 py-2 text-left font-sans font-semibold text-slate-600">Inertia Ix</td><td className="px-3 py-2 text-slate-800">{formatResultNumber(result.geometry.ixUnit * thirdScale, 1)} {thirdUnit}</td><td className="px-3 py-2 font-bold text-slate-900">{formatResultNumber(result.ix * fourthScale, 1)} {fourthUnit}</td></tr>
              <tr><td className="px-3 py-2 text-left font-sans font-semibold text-slate-600">Inertia Iy</td><td className="px-3 py-2 text-slate-800">{formatResultNumber(result.geometry.iyUnit * thirdScale, 1)} {thirdUnit}</td><td className="px-3 py-2 font-bold text-slate-900">{formatResultNumber(result.iy * fourthScale, 1)} {fourthUnit}</td></tr>
              <tr><td className="px-3 py-2 text-left font-sans font-semibold text-slate-600">Polar Inertia J</td><td className="px-3 py-2 text-slate-800">{formatResultNumber(result.geometry.jUnit * thirdScale, 1)} {thirdUnit}</td><td className="px-3 py-2 font-bold text-slate-900">{formatResultNumber(result.j * fourthScale, 1)} {fourthUnit}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

// Final combined forces and moments used by the calculation.
function LoadSummary({ result, system }: { result: NonNullable<ReturnType<typeof calculateWeldGroup>>; system: "imperial" | "si" }) {
  return (
    <Card title="Total Applied Loading" icon="fa-solid fa-calculator">
      <div className="overflow-x-auto">
        <table className="data-table min-w-[520px] border-slate-100 text-center font-mono">
          <thead className="data-table-header"><tr><th className="w-1/3 px-3 py-2 text-left">Direction</th><th className="w-1/3 px-3 py-2">Forces</th><th className="w-1/3 px-3 py-2">Moments</th></tr></thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            <LoadRow direction="X" force={displayResultValue(result.load.fx, "kforce", system, 2)} moment={displayResultValue(result.load.mx, "kmoment", system, 2)} />
            <LoadRow direction="Y" force={displayResultValue(result.load.fy, "kforce", system, 2)} moment={displayResultValue(result.load.my, "kmoment", system, 2)} />
            <LoadRow direction="Z" force={displayResultValue(result.load.fz, "kforce", system, 2)} moment={displayResultValue(result.load.mz, "kmoment", system, 2)} />
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// Reusable row for one loading direction.
function LoadRow({ direction, force, moment }: { direction: string; force: string; moment: string }) {
  return <tr><td className="px-3 py-2 text-left font-sans font-semibold text-slate-600">{direction}</td><td className="px-3 py-2 text-slate-800">{force}</td><td className="px-3 py-2 font-bold text-slate-900">{moment}</td></tr>;
}

// Detailed node-by-node stress-component table.
function HotspotTable({ result, system }: { result: NonNullable<ReturnType<typeof calculateWeldGroup>>; system: "imperial" | "si" }) {
  const stressUnit = getUnitLabel("stress", system);
  const lengthUnit = getUnitLabel("length", system);
  const row = (value: number) => `${formatResultNumber(fromBase(value, "stress", system), 1)}`;
  return (
    <Card className="mt-6" title="Hotspot Node Stress Breakdown" icon="fa-solid fa-list-check">
      <div className="overflow-x-auto">
        <table className="data-table min-w-[1080px] rounded-xl border-slate-100 text-left font-mono">
          <thead className="data-table-header border-b border-slate-200">
            <tr>
              <th rowSpan={2} className="border-r border-slate-200 px-3 py-2.5">Point</th>
              <th rowSpan={2} className="border-r border-slate-200 px-3 py-2.5 text-center">Coords (x, y)</th>
              <th colSpan={3} className="border-b border-r border-slate-200 px-3 py-2 text-center">Primary Shear ({"\u03C4"}')</th>
              <th colSpan={3} className="border-b border-r border-slate-200 px-3 py-2 text-center">Secondary Shear ({"\u03C4"}'')</th>
              <th colSpan={3} className="border-b border-r border-slate-200 px-3 py-2 text-center">Total Shear ({"\u03C4"})</th>
              <th rowSpan={2} className="border-b border-r border-slate-200 px-3 py-2.5 text-center">Max {"\u03C4"}</th>
              <th rowSpan={2} className="border-b border-slate-200 px-3 py-2.5 text-center">Status</th>
            </tr>
            <tr className="border-b border-slate-200">
              {['τx', 'τy', 'τz', 'τx', 'τy', 'τz', 'τx', 'τy', 'τz'].map((header, index) => <th key={`${header}-${index}`} className="border-r border-slate-200 px-2 py-2 text-center">{header}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {result.stresses.map((stress) => {
              const isMax = Math.abs(stress.tauTotal - result.maxStress) < 1e-9;
              const passes = stress.tauTotal <= result.allowableStress;
              return (
                <tr key={stress.name} className={isMax ? "bg-red-50" : ""}>
                  <td className="px-4 py-2 font-bold text-slate-800">{stress.name}{isMax ? " ★" : ""}</td>
                  <td className="px-4 py-2 text-slate-500">({formatResultNumber(fromBase(stress.x, "length", system), 2)}, {formatResultNumber(fromBase(stress.y, "length", system), 2)}) {lengthUnit}</td>
                  <td className="px-4 py-2 text-slate-600">{row(stress.tauPrimeX)}</td><td className="px-4 py-2 text-slate-600">{row(stress.tauPrimeY)}</td><td className="px-4 py-2 text-slate-600">{row(stress.tauPrimeZ)}</td>
                  <td className="px-4 py-2 text-slate-600">{row(stress.tauDoubleX)}</td><td className="px-4 py-2 text-slate-600">{row(stress.tauDoubleY)}</td><td className="px-4 py-2 text-slate-600">{row(stress.tauDoubleZ)}</td>
                  <td className="px-4 py-2 text-slate-600">{row(stress.tauX)}</td><td className="px-4 py-2 text-slate-600">{row(stress.tauY)}</td><td className="px-4 py-2 text-slate-600">{row(stress.tauZ)}</td>
                  <td className="px-4 py-2 font-bold text-slate-900">{row(stress.tauTotal)} {stressUnit}</td>
                  <td className="px-4 py-2 text-right"><span className={`rounded px-2 py-0.5 font-bold ${passes ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{passes ? "OK" : "EXCEEDED"}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

const weldTheoryNomenclature: Array<[string, string]> = [
  [String.raw`h`, "Fillet-weld leg size"],
  [String.raw`t`, "Effective weld throat thickness"],
  [String.raw`L_{total}`, "Total weld length"],
  [String.raw`\bar{x}, \bar{y}`, "Weld-group centroid coordinates"],
  [String.raw`I_x, I_y`, "Second moments of area about the centroid"],
  [String.raw`J`, "Polar moment of area, I_x + I_y"],
  [String.raw`\tau_{allow}`, "Allowable shear stress"],
  [String.raw`\tau_{resultant}`, "Resultant shear stress"],
];

const weldTheoryReferences: Array<[string, string]> = [
  ["AISC Steel Construction Manual", "Weld-group analysis methods and design guidance."],
  ["AWS D1.1 Structural Welding Code", "Requirements and design provisions for structural welds."],
  ["Shigley’s Mechanical Engineering Design", "Elastic weld-group analysis and line-pattern properties."],
];

// Theory/reference tab containing the calculation methodology and equations.
function Theory() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card>
        <div className="space-y-6">
          <div><h2 className="mb-2 text-lg font-bold text-slate-900">Weld Group Analysis Methodology</h2><p className="text-sm leading-relaxed text-slate-600">This calculator implements the Elastic Method (Unit Line Method) for weld group statics. Welds are treated as line segments with effective throat thickness t = 0.7071 · h. Review the applicable design standard and engineering judgment before using results for final design.</p></div>
          <hr className="border-slate-200" />
          <TheorySection title="1. Effective Throat & Area" description="For a standard equal-leg fillet weld with leg size h:">
            <TheoryPanel><Equation expression={String.raw`t = h \cdot \sin(45^\circ) \approx 0.7071 \cdot h, \quad A_w = t \cdot L_{total}`} /></TheoryPanel>
          </TheorySection>
          <TheorySection title="2. Centroid of Weld Group Line Pattern" description="The centroid (x̄, ȳ) of the multi-segment weld pattern is determined using the first moment of area method:">
            <TheoryPanel><Equation expression={String.raw`\bar{x} = \frac{\sum L_i \cdot x_i}{\sum L_i}, \quad \bar{y} = \frac{\sum L_i \cdot y_i}{\sum L_i}`} /></TheoryPanel>
          </TheorySection>
          <TheorySection title="3. Unit vs Total Moments of Inertia" description="Unit line inertias (Ixw, Iyw, Jw) are calculated per unit throat, then converted to actual section inertias:">
            <TheoryPanel><Equation expression={String.raw`I_x = t \cdot I_{xw}, \quad I_y = t \cdot I_{yw}, \quad J = t \cdot J_w = I_x + I_y`} /></TheoryPanel>
          </TheorySection>
          <TheorySection title="4. Induced Moments & Total Vector Stresses" description="Loads applied at location (xL, yL, zL) induce additional moments about the weld group centroid:">
            <TheoryPanel>
              <Equation expression={String.raw`\mathbf{M}_{total} = \mathbf{M}_{applied} + \mathbf{r} \times \mathbf{F}`} />
              <Equation expression={String.raw`\tau_{x,k} = \frac{F_x}{A_w} - \frac{M_{z,total}(y_k - \bar{y})}{J}, \quad \tau_{y,k} = \frac{F_y}{A_w} + \frac{M_{z,total}(x_k - \bar{x})}{J}`} />
              <Equation expression={String.raw`\tau_{z,k} = \frac{F_z}{A_w} + \frac{M_{x,total}(y_k - \bar{y})}{I_x} - \frac{M_{y,total}(x_k - \bar{x})}{I_y}`} />
              <Equation expression={String.raw`\tau_{resultant,k} = \sqrt{\tau_{x,k}^2 + \tau_{y,k}^2 + \tau_{z,k}^2}`} />
            </TheoryPanel>
          </TheorySection>
          <TheorySection title="5. Safety Factor Evaluation">
            <TheoryPanel><Equation expression={String.raw`\text{Factor of Safety } (n) = \frac{\tau_{allow}}{\max(\tau_{resultant})}`} /></TheoryPanel>
          </TheorySection>
          <TheorySection title="Nomenclature">
            <TheoryNomenclature entries={weldTheoryNomenclature} />
          </TheorySection>
          <TheorySection title="References">
            <TheoryReferences entries={weldTheoryReferences} />
          </TheorySection>
        </div>
      </Card>
    </div>
  );
}

