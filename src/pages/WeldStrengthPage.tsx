// Weld calculator imports React state/effects, reusable UI components, and the engineering engine.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Card } from "../components/Card";
import { Equation } from "../components/Equation";
import { SiteHeader } from "../components/SiteHeader";
import { UnitInput } from "../components/UnitInput";
import { UnitToggle } from "../components/UnitToggle";
import { WeldDiagram } from "../components/WeldDiagram";
import { useUnitSystem } from "../components/units/UnitContext";
import { displayResultValue, calculateWeldGroup, formatResultNumber, type WeldInput, type WeldPattern } from "../engineering/weldGroup";
import { fromBase, getUnitLabel, toBase } from "../engineering/units";

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
  Fx: 1200,
  Fy: -4500,
  Fz: 0,
  xL: 3.0,
  yL: 4.0,
  zL: 0,
  Mx: 0,
  My: 0,
  Mz: 18000,
  tauAllow: 21000,
  xCustom: 3.0,
  yCustom: 4.0,
};

// Main weld calculator page: manages state, tabs, unit synchronization, and results.
export function WeldStrengthPage() {
  const { unitSystem } = useUnitSystem();
  const [tab, setTab] = useState<"calc" | "theory">("calc");
  const [input, setInput] = useState<WeldInput>(initialInput);

  // Convert the visible form to the currently selected unit system when necessary.
  const currentInput = input.unitSystem === unitSystem ? input : convertFormState(input, input.unitSystem, unitSystem);

  // Keep form values synchronized when the global unit system changes.
  useEffect(() => {
    if (input.unitSystem !== unitSystem) {
      setInput(currentInput);
    }
  }, [currentInput, input.unitSystem, unitSystem]);

  // Run the engineering calculation when inputs change and capture errors for display.
  const resultState = useMemo(() => {
    try {
      return { result: calculateWeldGroup(currentInput), error: null as string | null };
    } catch (error) {
      return { result: null, error: error instanceof Error ? error.message : "Unable to calculate." };
    }
  }, [currentInput]);

  // Generic typed updater keeps the field name and value type connected.
  const update = <K extends keyof WeldInput>(field: K, value: WeldInput[K]) => {
    setInput((previous) => ({ ...previous, [field]: value, unitSystem }));
  };

  const result = resultState.result;
  const lengthUnit = getUnitLabel("length", unitSystem);

  return (
      <div className= "flex min-h-screen flex-col bg-slate-100 text-slate-800 antialiased" >
      {/* Calculator header contains the shared unit toggle and calculator tabs. */}
      <SiteHeader
        icon="fa-solid fa-layer-group"
        title={<>Weld Group Statics &amp; Stress <span className="rounded border border-sky-700/50 bg-sky-900/80 px-2 py-0.5 text-xs font-normal text-sky-200">Engineering Tool</span></>}
        subtitle="Analysis & Hotspot Efficiency Calculator"
        right={<UnitToggle />}
      >
        <div className="flex space-x-1 border-t border-slate-800 pt-2">
          <button
            type="button"
            onClick={() => setTab("calc")}
            className={tab === "calc" ? "flex items-center gap-2 border-b-2 border-sky-400 px-4 py-2 text-sm font-semibold text-sky-400" : "flex items-center gap-2 border-b-2 border-transparent px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200"}
          >
            <i className="fa-solid fa-calculator" aria-hidden="true" /> Interactive Calculator
          </button>
          <button
            type="button"
            onClick={() => setTab("theory")}
            className={tab === "theory" ? "flex items-center gap-2 border-b-2 border-sky-400 px-4 py-2 text-sm font-semibold text-sky-400" : "flex items-center gap-2 border-b-2 border-transparent px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200"}
          >
            <i className="fa-solid fa-book-open" aria-hidden="true" /> Theory &amp; References
          </button>
        </div>
      </SiteHeader>

      <main className="mx-auto w-full max-w-7xl flex-grow px-4 py-6 sm:px-6 lg:px-8">
        {tab === "calc" ? (
          <>
            {/* Main responsive layout: inputs on the left, visualization/results on the right. */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="space-y-6 lg:col-span-5">
                {/* Geometry inputs: pattern selection and dimensions. */}
                <Card title="Weld Pattern Geometry" icon="fa-solid fa-shapes">
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="pattern" className="label-input">Pattern Configuration</label>
                      <select id="pattern" value={currentInput.pattern} onChange={(event) => update("pattern", event.target.value as WeldPattern)} className="box-input font-sans pr-3">
                        {patternOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </div>
                    <UnitInput label="Weld Leg Size (h)" quantity="length" value={currentInput.h} onChange={(value) => update("h", value)} min={0.000001} step={unitSystem === "imperial" ? 0.01 : 0.1} />
                    <UnitInput label="Width (b / D)" quantity="length" value={currentInput.b} onChange={(value) => update("b", value)} min={0.000001} step={unitSystem === "imperial" ? 0.1 : 1} />
                    <UnitInput label="Height (d)" quantity="length" value={currentInput.d} onChange={(value) => update("d", value)} min={0.000001} step={unitSystem === "imperial" ? 0.1 : 1} disabled={currentInput.pattern === "circle"} />
                    {currentInput.pattern === "circle" ? <p className="-mt-2 text-[10px] text-slate-400">Circular patterns use b/D as the diameter.</p> : null}
                  </div>
                </Card>

                {/* Force magnitudes and load application coordinates. */}
                <Card title="Applied Forces & Load Application Points" icon="fa-solid fa-arrows-down-to-line">
                  <div className="mb-4 overflow-x-auto">
                    <table className="w-full min-w-[300px] overflow-hidden rounded-lg border border-slate-200 text-left text-xs font-mono">
                      <thead className="border-b border-slate-200 bg-slate-100 text-[10px] uppercase tracking-wider text-slate-600">
                        <tr><th className="p-2">Force Magnitude</th><th className="p-2">Application Coord</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-slate-50/50">
                        <tr>
                          <td className="p-2"><UnitInput label="Fx Shear" quantity="force" value={currentInput.Fx} onChange={(value) => update("Fx", value)} step={unitSystem === "imperial" ? 100 : 500} /></td>
                          <td className="p-2"><UnitInput label="XL Location" quantity="length" value={currentInput.xL} onChange={(value) => update("xL", value)} step={unitSystem === "imperial" ? 0.5 : 1} /></td>
                        </tr>
                        <tr>
                          <td className="p-2"><UnitInput label="Fy Direct" quantity="force" value={currentInput.Fy} onChange={(value) => update("Fy", value)} step={unitSystem === "imperial" ? 100 : 500} /></td>
                          <td className="p-2"><UnitInput label="YL Location" quantity="length" value={currentInput.yL} onChange={(value) => update("yL", value)} step={unitSystem === "imperial" ? 0.5 : 1} /></td>
                        </tr>
                        <tr>
                          <td className="p-2"><UnitInput label="Fz Out-of-Plane" quantity="force" value={currentInput.Fz} onChange={(value) => update("Fz", value)} step={unitSystem === "imperial" ? 100 : 500} /></td>
                          <td className="p-2"><UnitInput label="ZL Offset" quantity="length" value={currentInput.zL} onChange={(value) => update("zL", value)} step={unitSystem === "imperial" ? 0.5 : 1} /></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Direct applied moments are entered separately from the force table. */}
                  <div className="space-y-3 border-t border-slate-100 pt-2">
                    <h2 className="card-title"><i className="fa-solid fa-rotate-left mr-2 text-sky-600" aria-hidden="true" />Applied Direct Moments</h2>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <UnitInput label="Mx Bending" quantity="moment" value={currentInput.Mx} onChange={(value) => update("Mx", value)} step={unitSystem === "imperial" ? 500 : 50} />
                      <UnitInput label="My Bending" quantity="moment" value={currentInput.My} onChange={(value) => update("My", value)} step={unitSystem === "imperial" ? 500 : 50} />
                      <UnitInput label="Mz Torsion" quantity="moment" value={currentInput.Mz} onChange={(value) => update("Mz", value)} step={unitSystem === "imperial" ? 500 : 50} />
                    </div>
                  </div>
                </Card>

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
                {/* Dark visualization panel containing the weld diagram. */}
                <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
                    <div className="flex items-center space-x-2">
                      <span className="h-3 w-3 rounded-full bg-red-500" /><span className="h-3 w-3 rounded-full bg-yellow-500" /><span className="h-3 w-3 rounded-full bg-green-500" />
                      <h3 className="ml-2 text-xs font-mono uppercase tracking-wider text-slate-300">2D Weld Vector &amp; Node Visualizer</h3>
                    </div>
                    <div className="hidden items-center space-x-3 text-[11px] font-mono text-slate-400 sm:flex">
                      <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-sky-400" />Weld</span>
                      <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />Nodes</span>
                      <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-red-500" />CG</span>
                    </div>
                  </div>
                  <div className="flex justify-center bg-slate-950 p-4">
                    {result ? (
                      <WeldDiagram
                        result={result}
                        xLoadBase={toBase(currentInput.xL ?? 0, "length", unitSystem)}
                        yLoadBase={toBase(currentInput.yL ?? 0, "length", unitSystem)}
                        xCustomBase={toBase(currentInput.xCustom ?? 0, "length", unitSystem)}
                        yCustomBase={toBase(currentInput.yCustom ?? 0, "length", unitSystem)}
                      />
                    ) : (
                      <div className="flex min-h-[380px] w-full max-w-2xl items-center justify-center rounded border border-red-900 bg-slate-900 p-6 text-center text-sm text-red-300">Enter valid inputs to display the diagram.</div>
                    )}
                  </div>
                </div>

                {/* Display calculated result panels when the engineering calculation succeeds. */}
                {result ? (
                  <>
                    <StatusBanner result={result} system={unitSystem} />
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
          </>
        ) : <Theory />}
      </main>
    </div>
  );
}

// Pass/fail status, factor of safety, and maximum stress.
function StatusBanner({ result, system }: { result: NonNullable<ReturnType<typeof calculateWeldGroup>>; system: "imperial" | "si" }) {
  const stressUnit = getUnitLabel("stress", system);
  return (
    <div className={`flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${result.safe ? "border-emerald-500/30 bg-emerald-500/10" : "border-red-500/30 bg-red-500/10"}`}>
      <div className="flex items-center space-x-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-lg text-2xl font-bold text-white ${result.safe ? "bg-emerald-500" : "bg-red-500"}`}>
          <i className={result.safe ? "fa-solid fa-check" : "fa-solid fa-triangle-exclamation"} aria-hidden="true" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded px-2 py-0.5 text-xs font-extrabold uppercase tracking-wider text-white ${result.safe ? "bg-emerald-500" : "bg-red-500"}`}>{result.safe ? "Safe Design" : "Overstressed"}</span>
            <span className="text-xs text-slate-500">Reference method • verify applicable code</span>
          </div>
          <h4 className="mt-0.5 text-base font-bold text-slate-800">Factor of Safety n = {result.factorOfSafety.toFixed(2)}{result.safe ? "" : " (UNSAFE)"}</h4>
        </div>
      </div>
      <div className="text-left font-mono sm:text-right">
        <div className="text-xs text-slate-500">Max Hotspot Stress (τmax)</div>
        <div className="text-xl font-bold text-slate-900">{formatResultNumber(fromBase(result.maxStress, "stress", system), 0)} {stressUnit}</div>
      </div>
    </div>
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
        <div className="grid grid-cols-1 gap-3 text-center font-mono sm:grid-cols-3">
          <Metric label="Throat Thickness (t)" value={`${formatResultNumber(fromBase(result.throat, "length", system), 4)} ${lengthUnit}`} />
          <Metric label="Centroid (x̄, ȳ)" value={`(${formatResultNumber(fromBase(result.geometry.centroidX, "length", system), 2)}, ${formatResultNumber(fromBase(result.geometry.centroidY, "length", system), 2)}) ${lengthUnit}`} />
          <Metric label="Total Weld Area (Aw)" value={`${formatResultNumber(result.area * areaScale, 2)} ${areaUnit}`} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] overflow-hidden rounded-lg border border-slate-100 text-center text-xs font-mono">
            <thead className="bg-slate-100 text-[10px] uppercase tracking-wider text-slate-600"><tr><th className="px-3 py-2 text-left">Property Type</th><th className="px-3 py-2">Unit Property (per unit throat)</th><th className="px-3 py-2">Total Actual Property</th></tr></thead>
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
        <table className="w-full min-w-[520px] overflow-hidden rounded-lg border border-slate-100 text-center text-xs font-mono">
          <thead className="bg-slate-100 text-[10px] uppercase tracking-wider text-slate-600"><tr><th className="w-1/3 px-3 py-2 text-left">Direction</th><th className="w-1/3 px-3 py-2">Forces</th><th className="w-1/3 px-3 py-2">Moments</th></tr></thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            <LoadRow direction="X" force={displayResultValue(result.load.fx, "force", system, 0)} moment={displayResultValue(result.load.mx, "moment", system, 0)} />
            <LoadRow direction="Y" force={displayResultValue(result.load.fy, "force", system, 0)} moment={displayResultValue(result.load.my, "moment", system, 0)} />
            <LoadRow direction="Z" force={displayResultValue(result.load.fz, "force", system, 0)} moment={displayResultValue(result.load.mz, "moment", system, 0)} />
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

// Reusable small result tile.
function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5"><div className="font-sans text-[11px] text-slate-500">{label}</div><div className="mt-0.5 text-sm font-bold text-slate-800">{value}</div></div>;
}

// Detailed node-by-node stress-component table.
function HotspotTable({ result, system }: { result: NonNullable<ReturnType<typeof calculateWeldGroup>>; system: "imperial" | "si" }) {
  const stressUnit = getUnitLabel("stress", system);
  const lengthUnit = getUnitLabel("length", system);
  const row = (value: number) => `${formatResultNumber(fromBase(value, "stress", system), 1)}`;
  return (
    <Card className="mt-6" title="Hotspot Node Stress Breakdown" icon="fa-solid fa-list-check">
      <div className="overflow-x-auto">
        <table className="min-w-[1080px] w-full overflow-hidden rounded-xl border border-slate-100 text-left text-xs font-mono">
          <thead className="border-b border-slate-200 bg-slate-100 text-[10px] tracking-wider text-slate-600">
            <tr>
              <th rowSpan={2} className="border-r border-slate-200 px-3 py-2.5">Point</th>
              <th rowSpan={2} className="border-r border-slate-200 px-3 py-2.5 text-center">Coords (x, y)</th>
              <th colSpan={3} className="border-b border-r border-slate-200 px-3 py-2 text-center">Primary Shear (τ')</th>
              <th colSpan={3} className="border-b border-r border-slate-200 px-3 py-2 text-center">Secondary Shear (τ'')</th>
              <th colSpan={3} className="border-b border-r border-slate-200 px-3 py-2 text-center">Total Shear (τ)</th>
              <th rowSpan={2} className="border-b border-r border-slate-200 px-3 py-2.5 text-center">Max τ</th>
              <th rowSpan={2} className="border-b border-slate-200 px-3 py-2.5 text-center">Status</th>
            </tr>
            <tr className="border-b border-slate-200">
              {['τx','τy','τz','τx','τy','τz','τx','τy','τz'].map((header, index) => <th key={`${header}-${index}`} className="border-r border-slate-200 px-2 py-2 text-center">{header}</th>)}
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

// Theory/reference tab containing the calculation methodology and equations.
function Theory() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card>
        <div className="space-y-6">
          <div><h2 className="mb-2 text-lg font-bold text-slate-900">Weld Group Analysis Methodology</h2><p className="text-sm leading-relaxed text-slate-600">This calculator implements the Elastic Method (Unit Line Method) for weld group statics. Welds are treated as line segments with effective throat thickness t = 0.7071 · h. Review the applicable design standard and engineering judgment before using results for final design.</p></div>
          <hr className="border-slate-200" />
          <TheoryBlock title="1. Effective Throat & Area" description="For a standard equal-leg fillet weld with leg size h:"><Equation expression={String.raw`t = h \cdot \sin(45^\circ) \approx 0.7071 \cdot h, \quad A_w = t \cdot L_{total}`} /></TheoryBlock>
          <TheoryBlock title="2. Centroid of Weld Group Line Pattern" description="The centroid (x̄, ȳ) of the multi-segment weld pattern is determined using the first moment of area method:"><Equation expression={String.raw`\bar{x} = \frac{\sum L_i \cdot x_i}{\sum L_i}, \quad \bar{y} = \frac{\sum L_i \cdot y_i}{\sum L_i}`} /></TheoryBlock>
          <TheoryBlock title="3. Unit vs Total Moments of Inertia" description="Unit line inertias (Ixw, Iyw, Jw) are calculated per unit throat, then converted to actual section inertias:"><Equation expression={String.raw`I_x = t \cdot I_{xw}, \quad I_y = t \cdot I_{yw}, \quad J = t \cdot J_w = I_x + I_y`} /></TheoryBlock>
          <TheoryBlock title="4. Induced Moments & Total Vector Stresses" description="Loads applied at location (xL, yL, zL) induce additional moments about the weld group centroid:"><Equation expression={String.raw`\mathbf{M}_{total} = \mathbf{M}_{applied} + \mathbf{r} \times \mathbf{F}`} /><Equation expression={String.raw`\tau_{x,k} = \frac{F_x}{A_w} - \frac{M_{z,total}(y_k - \bar{y})}{J}, \quad \tau_{y,k} = \frac{F_y}{A_w} + \frac{M_{z,total}(x_k - \bar{x})}{J}`} /><Equation expression={String.raw`\tau_{z,k} = \frac{F_z}{A_w} + \frac{M_{x,total}(y_k - \bar{y})}{I_x} - \frac{M_{y,total}(x_k - \bar{x})}{I_y}`} /><Equation expression={String.raw`\tau_{resultant,k} = \sqrt{\tau_{x,k}^2 + \tau_{y,k}^2 + \tau_{z,k}^2}`} /></TheoryBlock>
          <TheoryBlock title="5. Safety Factor Evaluation"><Equation expression={String.raw`\text{Factor of Safety } (n) = \frac{\tau_{allow}}{\max(\tau_{resultant})}`} /></TheoryBlock>
          <div className="border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-500"><strong className="text-slate-700">References:</strong> The original project notes the AISC Steel Construction Manual, AWS D1.1 Structural Welding Code, and Shigley weld-group tables as sources for the method and line-pattern geometry.</div>
        </div>
      </Card>
    </div>
  );
}

// Reusable wrapper for one theory section.
function TheoryBlock({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <div className="space-y-2"><h3 className="text-sm font-bold text-slate-800">{title}</h3>{description ? <p className="text-xs text-slate-600">{description}</p> : null}<div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-mono text-center">{children}</div></div>;
}

// Convert all editable form values between Imperial and SI while preserving the physical problem.
function convertFormState(input: WeldInput, fromSystem: "imperial" | "si", toSystem: "imperial" | "si"): WeldInput {
  const convert = <T extends number | null>(value: T, quantity: "length" | "force" | "moment" | "stress"): T => {
    if (typeof value !== "number" || !Number.isFinite(value)) return value;
    return fromBase(toBase(value, quantity, fromSystem), quantity, toSystem) as T;
  };

  return {
    ...input,
    unitSystem: toSystem,
    h: convert(input.h, "length"),
    b: convert(input.b, "length"),
    d: convert(input.d, "length"),
    Fx: convert(input.Fx, "force"),
    Fy: convert(input.Fy, "force"),
    Fz: convert(input.Fz, "force"),
    xL: convert(input.xL, "length"),
    yL: convert(input.yL, "length"),
    zL: convert(input.zL, "length"),
    Mx: convert(input.Mx, "moment"),
    My: convert(input.My, "moment"),
    Mz: convert(input.Mz, "moment"),
    tauAllow: convert(input.tauAllow, "stress"),
    xCustom: convert(input.xCustom, "length"),
    yCustom: convert(input.yCustom, "length"),
  };
}
