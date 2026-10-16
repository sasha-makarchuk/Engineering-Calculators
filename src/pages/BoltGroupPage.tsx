// Weld calculator imports React state/effects, reusable UI components, and the engineering engine.
import { useEffect, useMemo, useState, useRef, type ReactNode } from "react";
import { Card } from "../components/Card";
import { Equation } from "../components/Equation";
import { SiteHeader, type PageTab } from "../components/SiteHeader";
import { UnitInput } from "../components/UnitInput";
import { UnitToggle } from "../components/UnitToggle";
import { WeldDiagram } from "../components/WeldDiagram";
import { useUnitSystem } from "../components/units/UnitContext";
import { LoadsInputCard, type BaseLoadInput } from "../components/LoadsInputCard";
import {
  calculateBoltGroup,
  type BoltGroupInput,
  type GroupBolt,
  MAX_BOLTS,
  type PatternKind,
  type BoltPattern,
  generatePatternBolts,
} from "../engineering/boltGroup";
import { BoltGroupDiagram, type DiagramBolt } from "../components/BoltGroupDiagram";
import { fromBase, getUnitLabel, toBase, type UnitSystem } from "../engineering/units";
import { FASTENER_SIZES, getFastenerOptions, type FastenerSize } from "../data/fasteners";
import { SelectInput, type SelectOption } from "../components/Dropdown";

// Dropdown display data for each supported weld pattern.
const patternOptions: Array<{ value: PatternKind; label: string }> = [
  { value: "line", label: "Line" },
  { value: "rectangle", label: "Rectangle" },
  { value: "single", label: "Single" },
];

export interface PatternFieldConfig {
  key: keyof BoltPattern;
  label: string;
  quantity: "length" | "unitless"; // Add 'unitless' or handle step logic
  step: number;
  stepSI?: number;
}

export interface PatternOptionConfig {
  value: PatternKind;
  label: string;
    fields: PatternFieldConfig[];
}

export const PATTERN_CONFIGS: PatternOptionConfig[] = [
  {
    value: "rectangle",
    label: "Rectangle Grid",
    fields: [
      { key: "cx", label: "Center X", quantity: "length", step: 0.1, stepSI: 1 },
      { key: "cy", label: "Center Y", quantity: "length", step: 0.1, stepSI: 1 },
      { key: "dx", label: "Spacing X", quantity: "length", step: 0.1, stepSI: 1 },
      { key: "dy", label: "Spacing Y", quantity: "length", step: 0.1, stepSI: 1 },
      { key: "cols", label: "Columns", quantity: "unitless", step: 1 },
      { key: "rows", label: "Rows", quantity: "unitless", step: 1 },
    ],
  },
  {
    value: "line",
    label: "Linear Row",
    fields: [
      { key: "cx", label: "Start X", quantity: "length", step: 0.1, stepSI: 1 },
      { key: "cy", label: "Start Y", quantity: "length", step: 0.1, stepSI: 1 },
      { key: "dx", label: "Spacing X", quantity: "length", step: 0.1, stepSI: 1 },
      { key: "dy", label: "Spacing Y", quantity: "length", step: 0.1, stepSI: 1 },
      { key: "cols", label: "Number of Bolts", quantity: "unitless", step: 1 },
    ],
  },
  {
    value: "single",
    label: "Bolt Circle",
    fields: [
      { key: "cx", label: "Center X", quantity: "length", step: 0.1, stepSI: 1 },
      { key: "cy", label: "Center Y", quantity: "length", step: 0.1, stepSI: 1 },
    ],
  },
];


type Weighting = "tensile" | "shank";

interface BoltRow {
    id: number;
    sizeId: string;
    x: number | null;
    y: number | null;
}

interface ForceRow {
    id: number;
    fx: number | null;
    fy: number | null;
    x: number | null;
    y: number | null;
}

/*
interface BoltGroupInput {
    pattern: PatternKind;
    cols: number | null;
    rows: number | null;
    dx: number | null;
    dy: number | null;
    perimeterOnly: boolean;
    count: number | null;
    cx: number | null;
    cy: number | null;
    commonOnly: boolean;
    weighting: Weighting;
    bolts: BoltRow[];
    forces: ForceRow[];
    moment: number | null;
    unitSystem: UnitSystem;
}
*/

const initialBolts: GroupBolt[] = [
  // Bottom Row (y = -100 mm)
  {
    id: 1,
    sizeId: "M10x1.5",
    x: -75,
    y: -100,
  },
  {
    id: 2,
    sizeId: "M10x1.25",
    x: 75,
    y: -100,
  },

  // Middle Row (y = 0 mm)
  {
    id: 3,
    sizeId: "M10x1.5",
    x: -75,
    y: 0,
  },
  {
    id: 4,
    sizeId: "M16x2",
    x: 75,
    y: 0,
  },

  // Top Row (y = +100 mm)
  {
    id: 5,
    sizeId: "M10x1.5",
    x: -75,
    y: 100,
  },
  {
    id: 6,
    sizeId: "M10x1.5",
    x: 75,
    y: 100,
  },
];

const initialPattern: BoltPattern = {
    type: "rectangle",
    cx: 5,
    cy: 5,
    cols: 3,
    rows: 2,
    dx: 10,
    dy: 10,
}

const initialLoads: BaseLoadInput = {
    Fx: 0,
    Fy: 0,
    Fz: 0,
    xL: 0,
    yL: 0,
    zL: 0,
    Mx: 0,
    My: 0,
    Mz: 0,

}

// Default example inputs displayed when the calculator opens.
const initialInput: BoltGroupInput = {
    pattern: initialPattern,
    commonOnly: true,
    bolts: initialBolts,
    unitSystem: "imperial",
    ...initialLoads
};

/*
function buildModel(input: BoltGroupInput): Model {
    const empty = { result: null, sizes: [], diagramBolts: [], diagramForces: [] };
    const sizes: FastenerSize[] = [];
    const bolts: GroupBolt[] = [];
    for (const row of input.bolts) {
        const size = sizeById(row.sizeId);
        if (!size) return { ...empty, error: "Select a size for every bolt." };
        if (row.x === null || row.y === null)
            return { ...empty, error: "Enter x and y for every bolt." };
        sizes.push(size);
        bolts.push({
            x: row.x,
            y: row.y,
            area: input.weighting === "tensile" ? size.at : (Math.PI * size.d * size.d) / 4,
        });
    }
    const forces = input.forces.map((row) => ({
        fx: row.fx ?? 0,
        fy: row.fy ?? 0,
        x: row.x ?? 0,
        y: row.y ?? 0,
    }));
    try {
        const result = calculateBoltGroup({ bolts, forces, moment: input.moment ?? 0 });
        return {
            result,
            error: null,
            sizes,
            diagramBolts: result.bolts.map((bolt, i) => ({
                index: bolt.index,
                x: bolt.x,
                y: bolt.y,
                d: sizes[i]?.d ?? 1,
                fx: bolt.fx,
                fy: bolt.fy,
                ratio: bolt.ratio,
                isMax: bolt.isMax,
            })),
            diagramForces: forces,
        };
    } catch (error) {
        return { ...empty, error: error instanceof Error ? error.message : "Unable to calculate." };
    }
}
*/


// Main weld calculator page: manages state, tabs, unit synchronization, and results.
export function BoltGroupPage() {
  const { unitSystem } = useUnitSystem();
  const [pageTab, setPageTab] = useState<PageTab>("calc");
  const [input, setInput] = useState<BoltGroupInput>(initialInput);
  const [hover, setHover] = useState<number | null>(null);

  // Convert the visible form to the currently selected unit system when necessary.
  const currentInput =
    input.unitSystem === unitSystem
      ? input
      : convertFormState(input, input.unitSystem, unitSystem);

  // Keep form values synchronized when the global unit system changes.
  useEffect(() => {
    if (input.unitSystem !== unitSystem) {
      setInput(currentInput);
    }
  }, [currentInput, input.unitSystem, unitSystem]);

  // Run the engineering calculation when inputs change and capture errors for display.
  const resultState = useMemo(() => {
    try {
      return {
        result: calculateBoltGroup(currentInput),
        error: null as string | null,
      };
    } catch (error) {
      return {
        result: null,
        error: error instanceof Error ? error.message : "Unable to calculate.",
      };
    }
  }, [currentInput]);

const result = resultState.result;

const maxInitialId = Math.max(0, ...input.bolts.map((b) => b.id));
const nextId = useRef(maxInitialId + 1);

  // Generic typed updater keeps the field name and value type connected.
  const update = <K extends keyof BoltGroupInput>(field: K, value: BoltGroupInput[K]) => {
    setInput((previous) => ({ ...previous, [field]: value, unitSystem }));
  };

const updateBolt = (id: number, patch: Partial<BoltRow>, all?: boolean) =>
    setInput((previous) => ({
        ...previous,
        bolts: previous.bolts.map((row) => {
            if (all || row.id === id) {
                const updated = { ...row, ...patch };
                return {
                    ...updated,
                    x: updated.x ?? 0,
                    y: updated.y ?? 0,
                };
            }
            return row;
        }),
    }));
    
    const addBolt = () => {
      // 1. Fallback fastener size from existing bolts or default
      const defaultSize = currentInput.bolts[currentInput.bolts.length - 1]?.sizeId ?? "M10x1.5";

      // 2. Generate new coordinates according to current pattern settings
      const newBolts = generatePatternBolts(currentInput.pattern, defaultSize);

      // 3. Calculate how many bolts we can add before hitting MAX_BOLTS
      const remainingSlots = MAX_BOLTS - currentInput.bolts.length;
      if (remainingSlots <= 0) return;

      // 4. Assign new IDs and slice to respect MAX_BOLTS
      const boltsToAdd = newBolts.slice(0, remainingSlots).map((bolt) => ({
        ...bolt,
        id: nextId.current++,
      }));

      // 5. Append new pattern bolts to existing array
      update("bolts", [...input.bolts, ...boltsToAdd]);
    };   


    // Update a single key inside currentInput.pattern
    const updatePattern = <K extends keyof BoltPattern>(field: K, value: BoltPattern[K]) => {
        setInput((previous) => ({...previous, unitSystem, pattern: {...previous.pattern, [field]: value, },}));
    };

  const sizeOptions = useMemo(
      () => getFastenerOptions("coarse", currentInput.commonOnly),
      [unitSystem, currentInput.commonOnly]
  );

    const diagramBolts: DiagramBolt[] = (result?.bolts ?? []).map((bolt) => {
      const rawBolt = currentInput.bolts[bolt.index - 1];
      const size = FASTENER_SIZES.find((s) => s.id === rawBolt?.sizeId);

      return {
        ...bolt,
        d: size?.d ?? 10, // Assign diameter in mm (defaults to 10 if lookup fails)
      };
    });

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-800 antialiased">
    {/* Calculator header contains the shared unit toggle and calculator tabs. */ }
      <SiteHeader
        icon="fa-solid fa-layer-group"
        title = {<> Bolt Group Shear Calculator</>}
        subtitle="In-plane forces and moment on a bolt pattern, elastic method"
        right = {< UnitToggle/>}
        pageTab = { pageTab }
        setPageTab = { setPageTab }
      >
      </SiteHeader>

      <main className="mx-auto w-full max-w-7xl flex-grow px-4 py-6 sm:px-6 lg:px-8">
        {pageTab === "calc" ? (
          <>
            {/* Main responsive layout: inputs on the left, visualization/results on the right. */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="space-y-6 lg:col-span-5">
                {/* Geometry inputs: pattern selection and dimensions. */}
                <Card title="Bolt Coordinates" icon="fa-solid fa-shapes">
                <div className = "grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-1" >
                    <div className="space-y-4" >
                        <div className = "grid grid-cols-2 gap-3 items-end" >
                          <SelectInput
                            label="Select bolt pattern"
                            value={currentInput.pattern.type}
                            options={patternOptions}
                            onChange={(value) => updatePattern("type", value)}
                          />
                         <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={addBolt}
                            disabled={input.bolts.length >= MAX_BOLTS}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition-colors hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            + Add bolt
                          </button>
                          <span className="text-[11px] text-slate-400">
                            {input.bolts.length} of {MAX_BOLTS} bolts
                          </span>
                        </div>
                        </div>
                        <div className = "grid grid-cols-2 gap-3" >
                          {PATTERN_CONFIGS.find((p) => p.value === currentInput.pattern.type)?.fields.map((field) => {
                              const val = currentInput.pattern[field.key as keyof BoltPattern];

                              return (
                                <UnitInput
                                  key={field.key}
                                  label={field.label}
                                  quantity={field.quantity}
                                  value={(val as number) ?? 0}
                                  onChange={(v) => updatePattern(field.key as keyof BoltPattern, v ?? 0)}
                                  step={unitSystem === "imperial" ? field.step : field.stepSI}
                                />
                              );
                            })}
                    </div>
{/*
                    <div>
                      <SelectInput
                        label="Set all bolts to"
                        value={currentInput.sizeId}
                        options={sizeOptions}
                        onChange={(value) => updateBolt(0, { sizeId: value }, true)}
                      />
                      < label className = "mt-2 flex cursor-pointer items-center gap-2 text-[11px] text-slate-500" >
                        <input
                            type="checkbox"
                            checked = { currentInput.commonOnly }
                            onChange = {(event) => update("commonOnly", event.target.checked)}
                            className = "h-3.5 w-3.5 accent-sky-600"
                        />
                        Show common sizes only
                      </label>
                    </div>
*/}
                </div>
    
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[360px] overflow-hidden rounded-lg border border-slate-200 text-left text-xs">
                    <thead className="bg-slate-100 text-[10px] uppercase tracking-wider text-slate-600">
                      <tr>
                        <th className="px-2 py-2">#</th>
                        <th className="px-2 py-2">Size</th>
                        <th className="px-2 py-2 text-right">x</th>
                        <th className="px-2 py-2 text-right">y</th>
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {input.bolts.map((row, i) => (
                        <tr
                          key={row.id}
                          onMouseEnter={() => setHover(i + 1)}
                          onMouseLeave={() => setHover(null)}
                          className={hover === i + 1 ? "bg-violet-50" : ""}
                        >
                          <td className="px-2 py-1.5 font-mono text-slate-500">
                            {i + 1}
                          </td>
                          <td className="px-2 py-1.5">
                              <SelectInput
                                aria-label={`Bolt ${i + 1} size`}
                                value={row.sizeId}
                                options={sizeOptions}
                                onChange={(value) => updateBolt(row.id, { sizeId: value })}
                                className="min-w-[7.5rem] px-2 py-1 font-sans text-xs"
                              />
                          </td>
                          <td>
                            <UnitInput
                              label=""
                              quantity="length"
                              value={row.x}
                              onChange={(value) => updateBolt(row.id, { x: value })}
                              step={unitSystem === "imperial" ? 0.1 : 1}
                            />
                          </td>
                          <td>
                            <UnitInput
                              label=""
                              quantity="length"
                              value={row.y}
                              onChange={(value) => updateBolt(row.id, { y: value })}
                              step={unitSystem === "imperial" ? 0.1 : 1}
                            />
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <button
                              type="button"
                              aria-label={`Delete bolt ${i + 1}`}
                              onClick={() => update("bolts", input.bolts.filter((b) => b.id !== row.id))}
                              className="rounded px-2 py-1 text-red-600 hover:bg-red-50"
                            >
                              <i className="fa-solid fa-xmark" aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </div>
                </Card>

                {/* Force magnitudes and load application coordinates. */}
                <LoadsInputCard
                  values={currentInput}
                  onChange={(field, value) => update(field as keyof BoltGroupInput, value ?? 0)}
                  enableZ = {false}
                />
              </div>

              <div className="space-y-6 lg:col-span-7">
                {/* Dark visualization panel containing the weld diagram. */}
                <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
                    <div className="flex items-center space-x-2">
                      <span className="h-3 w-3 rounded-full bg-red-500" />
                      <span className="h-3 w-3 rounded-full bg-yellow-500" />
                      <span className="h-3 w-3 rounded-full bg-green-500" />
                      <h3 className="ml-2 text-xs font-mono uppercase tracking-wider text-slate-300">
                        2D Weld Vector & Node Visualizer
                      </h3>
                    </div>
                    <div className="hidden items-center space-x-3 text-[11px] font-mono text-slate-400 sm:flex">
                      <span>
                        <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-sky-400" />{" "}
                        Weld
                      </span>
                      <span>
                        <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />{" "}
                        Nodes
                      </span>
                      <span>
                        <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-red-500" />{" "}
                        CG
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-center bg-slate-950 p-4">
                  {
                      result?(
                    <BoltGroupDiagram
                      bolts = { diagramBolts }
                      forces = {
                            [
                            {
                                fx: currentInput.Fx ?? 0,
                                fy: currentInput.Fy ?? 0,
                                x: currentInput.xL ?? 0,
                                y: currentInput.yL ?? 0,
                            },
                      ]}
                      cogX = { result.cogX }
                      cogY = { result.cogY }
                      momentAtCog = { result.momentAtCog }
                      highlight = { hover }
                      system = { unitSystem }
                            />
                    ) : (
                      <div className="flex min-h-[380px] w-full max-w-2xl items-center justify-center rounded border border-red-900 bg-slate-900 p-6 text-center text-sm text-red-300">
                        Enter valid inputs to display the diagram.
                      </div>
                    )}
                  </div>
                </div>

                {/* Display calculated result panels when the engineering calculation succeeds. */}
                {result ? (
                  <>
                  </>
                ) : (
                  <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
                    {resultState.error}
                  </div>
                )}
              </div>
            </div>

            {/* Detailed stress breakdown for each hotspot/evaluation point. */}

          </>
        ) : (
          <Theory />
        )}
      </main>
    </div>
  );
}


// Calculated weld-group section properties converted for display.


// Reusable small result tile.
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
      <div className="font-sans text-[11px] text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-bold text-slate-800">{value}</div>
    </div>
  );
}


// Theory/reference tab containing the calculation methodology and equations.
function Theory() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card>
        <div className="space-y-6">
          <div>
            <h2 className="mb-2 text-lg font-bold text-slate-900">
              Weld Group Analysis Methodology
            </h2>
            <p className="text-sm leading-relaxed text-slate-600">
              This calculator implements the Elastic Method (Unit Line Method)
              for weld group statics. Welds are treated as line segments with
              effective throat thickness t = 0.7071 · h. Review the applicable
              design standard and engineering judgment before using results for
              final design.
            </p>
          </div>
          <hr className="border-slate-200" />
          <TheoryBlock
            title="1. Effective Throat & Area"
            description="For a standard equal-leg fillet weld with leg size h:"
          >
            <Equation
              expression={String.raw`t = h \cdot \sin(45^\circ) \approx 0.7071 \cdot h, \quad A_w = t \cdot L_{total}`}
            />
          </TheoryBlock>
          <TheoryBlock
            title="2. Centroid of Weld Group Line Pattern"
            description="The centroid (x̄, ȳ) of the multi-segment weld pattern is determined using the first moment of area method:"
          >
            <Equation
              expression={String.raw`\bar{x} = \frac{\sum L_i \cdot x_i}{\sum L_i}, \quad \bar{y} = \frac{\sum L_i \cdot y_i}{\sum L_i}`}
            />
          </TheoryBlock>
          <TheoryBlock
            title="3. Unit vs Total Moments of Inertia"
            description="Unit line inertias (Ixw, Iyw, Jw) are calculated per unit throat, then converted to actual section inertias:"
          >
            <Equation
              expression={String.raw`I_x = t \cdot I_{xw}, \quad I_y = t \cdot I_{yw}, \quad J = t \cdot J_w = I_x + I_y`}
            />
          </TheoryBlock>
          <TheoryBlock
            title="4. Induced Moments & Total Vector Stresses"
            description="Loads applied at location (xL, yL, zL) induce additional moments about the weld group centroid:"
          >
            <Equation
              expression={String.raw`\mathbf{M}_{total} = \mathbf{M}_{applied} + \mathbf{r} \times \mathbf{F}`}
            />
            <Equation
              expression={String.raw`\tau_{x,k} = \frac{F_x}{A_w} - \frac{M_{z,total}(y_k - \bar{y})}{J}, \quad \tau_{y,k} = \frac{F_y}{A_w} + \frac{M_{z,total}(x_k - \bar{x})}{J}`}
            />
            <Equation
              expression={String.raw`\tau_{z,k} = \frac{F_z}{A_w} + \frac{M_{x,total}(y_k - \bar{y})}{I_x} - \frac{M_{y,total}(x_k - \bar{x})}{I_y}`}
            />
            <Equation
              expression={String.raw`\tau_{resultant,k} = \sqrt{\tau_{x,k}^2 + \tau_{y,k}^2 + \tau_{z,k}^2}`}
            />
          </TheoryBlock>
          <TheoryBlock title="5. Safety Factor Evaluation">
            <Equation
              expression={String.raw`\text{Factor of Safety } (n) = \frac{\tau_{allow}}{\max(\tau_{resultant})}`}
            />
          </TheoryBlock>
          <div className="border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-500">
            <strong className="text-slate-700">References: </strong>
            The original project notes the AISC Steel Construction Manual, AWS
            D1.1 Structural Welding Code, and Shigley weld-group tables as sources
            for the method and line-pattern geometry.
          </div>
        </div>
      </Card>
    </div>
  );
}

// Reusable wrapper for one theory section.
function TheoryBlock({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      {description ? (
        <p className="text-xs text-slate-600">{description}</p>
      ) : null}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center font-mono text-sm">
        {children}
      </div>
    </div>
  );
}

// Convert all editable form values between Imperial and SI while preserving the physical problem.
function convertFormState(
  input: BoltGroupInput,
  fromSystem: "imperial" | "si",
  toSystem: "imperial" | "si"
): BoltGroupInput {
  const convert = <T extends number | null>(
    value: T,
    quantity: "length" | "force" | "moment" | "stress"
  ): T => {
    if (typeof value !== "number" || !Number.isFinite(value)) return value;
    return fromBase(toBase(value, quantity, fromSystem), quantity, toSystem) as T;
  };

  return {
    ...input,
    unitSystem: toSystem,
    Fx: convert(input.Fx, "force"),
    Fy: convert(input.Fy, "force"),
    Fz: convert(input.Fz, "force"),
    xL: convert(input.xL, "length"),
    yL: convert(input.yL, "length"),
    zL: convert(input.zL, "length"),
    Mx: convert(input.Mx, "moment"),
    My: convert(input.My, "moment"),
    Mz: convert(input.Mz, "moment"),
    bolts: input.bolts.map((bolt) => ({
        ...bolt,
        x: convert(bolt.x, "length"),
        y: convert(bolt.y, "length"),
    })),
  };
}