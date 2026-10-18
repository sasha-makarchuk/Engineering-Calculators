// Bolt-group calculator imports React state, shared UI components, and the engineering engine.
import { useMemo, useState, type ReactNode } from "react";
import { Card } from "../components/Card";
import { CalculatorPageShell } from "../components/CalculatorPageShell";
import { DiagramPanel } from "../components/DiagramPanel";
import { Equation } from "../components/Equation";
import { type PageTab } from "../components/SiteHeader";
import { UnitInput } from "../components/UnitInput";
import { useUnitSystem } from "../components/units/UnitContext";
import { useCurrentInput } from "../hooks/useCurrentInput";
import {
  TheoryNomenclature,
  TheoryPanel,
  TheoryReferences,
  TheorySection,
} from "../components/TheorySection";
import { LoadsInputCard, type BaseLoadInput } from "../components/LoadsInputCard";
import {
  calculateBoltGroup,
  type BoltGroupInput,
  type GroupBolt,
  type BoltPatternGroup,
  MAX_BOLTS,
  type PatternKind,
  type BoltPattern,
  generatePatternBolts,
} from "../engineering/boltGroup";
import { BoltGroupDiagram } from "../components/BoltGroupDiagram";
import { convertFromState, formatSignificantFigures, fromBase, getUnitLabel, toBase, type UnitSchema, type UnitSystem } from "../engineering/units";
import { FASTENER_SIZES, getFastenerOptions } from "../data/fasteners";
import { SelectInput } from "../components/Dropdown";
import { useCalculationResult } from "../hooks/useCalculationResult";

// Dropdown display data for each supported bolt pattern.
const patternOptions: Array<{ value: PatternKind; label: string }> = [
  { value: "line", label: "Line" },
  { value: "rectangle", label: "Rectangle" },
  { value: "single", label: "Single Bolt" },
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
    label: "Line",
    fields: [
      { key: "startX", label: "Start X", quantity: "length", step: 0.1, stepSI: 1 },
      { key: "startY", label: "Start Y", quantity: "length", step: 0.1, stepSI: 1 },
      { key: "endX", label: "End X", quantity: "length", step: 0.1, stepSI: 1 },
      { key: "endY", label: "End Y", quantity: "length", step: 0.1, stepSI: 1 },
      { key: "cols", label: "Number of Bolts", quantity: "unitless", step: 1 },
    ],
  },
  {
    value: "single",
    label: "Single Bolt",
    fields: [
      { key: "cx", label: "Center X", quantity: "length", step: 0.1, stepSI: 1 },
      { key: "cy", label: "Center Y", quantity: "length", step: 0.1, stepSI: 1 },
    ],
  },
];


interface BoltRow {
  id: number;
  sizeId: string;
  x: number | null;
  y: number | null;
}

type BoltPatternWithUnits = BoltPattern & { unitSystem: UnitSystem };

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
  startX: 0,
  startY: 0,
  endX: 20,
  endY: 20,
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
  patternGroups: [],
  commonOnly: true,
  bolts: initialBolts,
  unitSystem: "imperial",
  ...initialLoads
};

// Main bolt-group page: manages inputs, units, visualization, and results.
export function BoltGroupPage() {
  const { unitSystem } = useUnitSystem();
  const [pageTab, setPageTab] = useState<PageTab>("calc");
  const [input, setInput] = useState<BoltGroupInput>(initialInput);
  const [hover, setHover] = useState<number | null>(null);
  const [editingPatternId, setEditingPatternId] = useState<number | null>(null);

  const currentInput = useCurrentInput(input, setInput, unitSystem, convertFormState);

  const resultState = useCalculationResult(currentInput, calculateBoltGroup);

  const result = resultState.result;

  // Generic typed updater keeps the field name and value type connected.
  const update = <K extends keyof BoltGroupInput>(field: K, value: BoltGroupInput[K]) => {
    setInput((previous) => ({ ...previous, [field]: value, unitSystem }));
  };

  const updateBolt = (id: number, patch: Partial<BoltRow>) => {
    const patternId = input.bolts.find((bolt) => bolt.id === id)?.patternId;
    if (editingPatternId === patternId) setEditingPatternId(null);
    setInput((previous) => {
      const editedBolt = previous.bolts.find((bolt) => bolt.id === id);
      const detachedPatternId = editedBolt?.patternId;
      return {
        ...previous,
        // An individual edit detaches the entire generated pattern; its other bolts remain editable.
        bolts: previous.bolts.map((row) => {
          const detached = detachedPatternId !== undefined && row.patternId === detachedPatternId
            ? { ...row, patternId: undefined }
            : row;
          if (row.id !== id) return detached;
          const updated = { ...detached, ...patch };
          return { ...updated, x: updated.x ?? 0, y: updated.y ?? 0 };
        }),
        patternGroups: detachedPatternId === undefined
          ? previous.patternGroups
          : previous.patternGroups.filter((pattern) => pattern.id !== detachedPatternId),
      };
    });
  };

  const appendPatternBolts = () => {
    const defaultSize = currentInput.bolts[currentInput.bolts.length - 1]?.sizeId ?? "M10x1.5";
    const patternId = Math.max(0, ...currentInput.patternGroups.map((pattern) => pattern.id)) + 1;
    const firstBoltId = Math.max(0, ...currentInput.bolts.map((bolt) => bolt.id)) + 1;
    const remainingSlots = MAX_BOLTS - currentInput.bolts.length;
    if (remainingSlots <= 0) return;
    const generated = generatePatternBolts(currentInput.pattern, defaultSize).slice(0, remainingSlots);
    const boltsToAdd = generated.map((bolt, index) => ({ ...bolt, id: firstBoltId + index, patternId }));
    const group: BoltPatternGroup = {
      id: patternId,
      pattern: { ...currentInput.pattern },
      boltIds: boltsToAdd.map((bolt) => bolt.id),
    };
    setInput((previous) => {
      return {
        ...previous,
        bolts: [...previous.bolts, ...boltsToAdd],
        patternGroups: [...previous.patternGroups, group],
      };
    });
    setEditingPatternId(patternId);
  };

  const removeBolt = (id: number) => {
    const patternId = input.bolts.find((bolt) => bolt.id === id)?.patternId;
    setInput((previous) => ({
      ...previous,
      bolts: previous.bolts
        .filter((bolt) => bolt.id !== id)
        .map((bolt) => patternId !== undefined && bolt.patternId === patternId
          ? { ...bolt, patternId: undefined }
          : bolt),
      patternGroups: patternId === undefined
        ? previous.patternGroups
        : previous.patternGroups.filter((pattern) => pattern.id !== patternId),
    }));
    if (editingPatternId === patternId) setEditingPatternId(null);
  };

  const editPattern = (group: BoltPatternGroup) => {
    setEditingPatternId(group.id);
    setInput((previous) => ({
      ...previous,
      unitSystem,
      pattern: { ...group.pattern },
    }));
  };

  const removePattern = (group: BoltPatternGroup) => {
    setInput((previous) => ({
      ...previous,
      bolts: previous.bolts.filter((bolt) => !group.boltIds.includes(bolt.id)),
      patternGroups: previous.patternGroups.filter((pattern) => pattern.id !== group.id),
    }));
    if (editingPatternId === group.id) setEditingPatternId(null);
  };


  // Update a single key inside currentInput.pattern
  const updatePattern = <K extends keyof BoltPattern>(field: K, value: BoltPattern[K]) => {
    setInput((previous) => {
      const updatedPattern = { ...previous.pattern, [field]: value };
      if (editingPatternId === null) {
        return { ...previous, unitSystem, pattern: updatedPattern };
      }
      return regeneratePatternGroup(previous, editingPatternId, updatedPattern, unitSystem);
    });
  };

  const sizeOptions = useMemo(
    () => getFastenerOptions("coarse", currentInput.commonOnly),
    [unitSystem, currentInput.commonOnly]
  );

  return (
    <CalculatorPageShell
      icon="fa-solid fa-layer-group"
      title={<> Bolt Group Shear Calculator</>}
      subtitle="In-plane forces and moment on a bolt pattern, elastic method"
      pageTab={pageTab}
      setPageTab={setPageTab}
    >
      {pageTab === "calc" ? (
        <>
          {/* Main responsive layout: inputs on the left, visualization/results on the right. */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left column: input cards for geometry, forces, and moments. */}
            <div className="space-y-6 lg:col-span-5">
              {/* Geometry inputs: pattern selection and dimensions. */}
              <Card title="Bolt Coordinates" icon="fa-solid fa-shapes">
                <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-1" >
                  <div className="space-y-4" >
                    <div className="grid grid-cols-2 gap-3 items-end" >
                      <SelectInput
                        label="Select bolt pattern"
                        value={currentInput.pattern.type}
                        options={patternOptions}
                        onChange={(value) => updatePattern("type", value)}
                      />
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={appendPatternBolts}
                          disabled={input.bolts.length >= MAX_BOLTS}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition-colors hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          + Add pattern
                        </button>
                        <span className="text-[11px] text-slate-400">
                          {input.bolts.length} of {MAX_BOLTS} bolts
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3" >
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
                    {input.patternGroups.length > 0 ? (
                      <div className="rounded-lg border border-slate-200 bg-slate-50">
                        <h3 className="text-xs font-semibold text-slate-700 p-2">Added patterns</h3>
                        {input.patternGroups.map((group, index) => (
                          <div
                            key={group.id}
                            className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 text-xs ${group.id === editingPatternId ? "bg-violet-50" : "bg-white"
                              }`}
                          >                            <span className="text-slate-700">
                              Pattern {index + 1}: {PATTERN_CONFIGS.find((item) => item.value === group.pattern.type)?.label ?? group.pattern.type}
                              <span className="ml-1 text-slate-400">(Bolts: {group.boltIds.join(",")})</span>
                            </span>
                            <div className="flex shrink-0 gap-2">
                              {editingPatternId === group.id ? (
                                <button type="button" onClick={() => setEditingPatternId(null)} className="shrink-0 font-semibold hover:text-sky-950">Done</button>
                              ) : editingPatternId === null ? (
                                <>
                                  <button type="button" onClick={() => editPattern(group)} className="font-semibold text-sky-700 hover:text-sky-900">Edit</button>
                                  <button type="button" onClick={() => removePattern(group)} className="font-semibold text-red-600 hover:text-red-800">Remove</button>
                                </>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="overflow-hidden rounded-lg">
                    <div className="max-h-[390px] overflow-auto">
                      <table className="w-full min-w-[360px] border-collapse rounded-lg text-left text-xs">
                        <thead className="bg-slate-100 text-[10px] uppercase tracking-wider text-slate-600">
                          <tr>
                            <th className="sticky top-0 z-10 bg-slate-100 px-2 py-2 text-center">#</th>
                            <th className="sticky top-0 z-10 bg-slate-100 px-2 py-2 text-center">Size</th>
                            <th className="sticky top-0 z-10 bg-slate-100 px-2 py-2 text-center">x</th>
                            <th className="sticky top-0 z-10 bg-slate-100 px-2 py-2 text-center">y</th>
                            <th className="sticky top-0 z-10 bg-slate-100 px-2 py-2 text-center" />
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
                              <td className="px-1 py-1.5 font-mono text-slate-500">
                                {i + 1}
                              </td>
                              <td className="px-1 py-1.5">
                                <SelectInput
                                  aria-label={`Bolt ${i + 1} size`}
                                  value={row.sizeId}
                                  options={sizeOptions}
                                  onChange={(value) => updateBolt(row.id, { sizeId: value })}
                                  className="min-w-[7.5rem] font-sans text-xs"
                                />
                              </td>
                              <td className="px-1 py-1.5">
                                <UnitInput
                                  label=""
                                  quantity="length"
                                  value={row.x}
                                  onChange={(value) => updateBolt(row.id, { x: value })}
                                  step={unitSystem === "imperial" ? 0.1 : 1}
                                />
                              </td>
                              <td className="px-1 py-1.5">
                                <UnitInput
                                  label=""
                                  quantity="length"
                                  value={row.y}
                                  onChange={(value) => updateBolt(row.id, { y: value })}
                                  step={unitSystem === "imperial" ? 0.1 : 1}
                                />
                              </td>
                              <td className="px-1 py-1.5 text-right">
                                <button
                                  type="button"
                                  aria-label={`Delete bolt ${i + 1}`}
                                  onClick={() => removeBolt(row.id)}
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
                </div>
              </Card>

              {/* Force magnitudes and load application coordinates. */}
              <LoadsInputCard
                values={currentInput}
                onChange={(field, value) => update(field as keyof BoltGroupInput, value ?? 0)}
                enableZ={false}
              />
            </div>

            {/* Right column: visualization panel and result tiles. */}
            <div className="space-y-6 lg:col-span-7">
              {result ? (
                <>
                  {/* Dark visualization panel containing the bolt-group diagram. */}
                  <DiagramPanel
                    title="2D Bolt-Force Vector & Group Diagram"
                    legend={[
                      { label: "Bolt force", colorClassName: "bg-sky-700", swatch: "line" },
                      {
                        label: "Bolt resultant: low → high",
                        colorClassName: "bg-gradient-to-r from-sky-300 to-orange-500",
                        swatch: "gradient",
                      },
                      { label: "Applied force", colorClassName: "bg-red-600", swatch: "line" },
                      { label: "CG / moment", colorClassName: "bg-violet-600" },
                    ]}
                  >
                    <BoltGroupDiagram
                      bolts={result.bolts}
                      forces={[
                        {
                          fx: currentInput.Fx ?? 0,
                          fy: currentInput.Fy ?? 0,
                          x: currentInput.xL ?? 0,
                          y: currentInput.yL ?? 0,
                        },
                      ]}
                      cogX={result.cogX}
                      cogY={result.cogY}
                      momentAtCog={result.momentAtCog}
                      highlight={hover}
                      system={unitSystem}
                    />
                  </DiagramPanel>

                  <BoltGroupSummary result={result} system={unitSystem} />

                  {/* Detailed stress breakdown for each hotspot/evaluation point. */}
                  <ResultsTable result={result} system={unitSystem} />

                </>
              ) : (
                <div>
                  <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
                    {resultState.error}
                  </div>
                  <div className="flex min-h-[380px] w-full max-w-2xl items-center justify-center rounded border border-red-900 bg-slate-900 p-6 text-center text-sm text-red-300">
                    Enter valid inputs to display the diagram.
                  </div>
                </div>
              )}
            </div>
          </div>


        </>
      ) : (
        <Theory />
      )}
    </CalculatorPageShell>
  );
}

// Reusable small result tile.
function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
      <div className="font-sans text-[11px] text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-bold text-slate-800">{value}</div>
      {sub ? <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div> : null}
    </div>
  );
}

// Summary properties for the calculated bolt group, matching the weld page's section summary structure.
function BoltGroupSummary({
  result,
  system,
}: {
  result: NonNullable<ReturnType<typeof calculateBoltGroup>>;
  system: UnitSystem;
}) {
  const lengthUnit = getUnitLabel("length", system);
  const forceUnit = getUnitLabel("force", system);
  const momentUnit = getUnitLabel("moment", system);

  return (
    <Card title="Pattern, Loads and Bolt Forces" icon="fa-solid fa-bullseye">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          label="Pattern COG (area-weighted)"
          value={`${formatSignificantFigures(result.cogX, 4)}, ${formatSignificantFigures(result.cogY, 4)} ${lengthUnit}`}
        />
        <Metric
          label="Total force at COG"
          value={`${formatSignificantFigures(result.Fx, 4)}, ${formatSignificantFigures(result.Fy, 4)} ${forceUnit}`}
          sub="ΣFx, ΣFy"
        />
        <Metric
          label="Moment at COG"
          value={`${formatSignificantFigures(result.momentAtCog, 4)} ${momentUnit}`}
          sub={result.momentAtCog > 0 ? "counter-clockwise" : result.momentAtCog < 0 ? "clockwise" : undefined}
        />
        <Metric
          label="Maximum bolt force"
          value={`${formatSignificantFigures(result.maxForce, 4)} ${forceUnit}`}
          sub={result.maxBolts.length > 0 ? `bolt ${result.maxBolts.join(", ")}` : "no load"}
        />
      </div>
    </Card>
  );
}

function regeneratePatternGroup(
  input: BoltGroupInput,
  patternId: number,
  pattern: BoltPattern,
  unitSystem: UnitSystem,
): BoltGroupInput {
  const group = input.patternGroups.find((item) => item.id === patternId);
  if (!group) return { ...input, unitSystem, pattern };

  const previousBolts = group.boltIds
    .map((id) => input.bolts.find((bolt) => bolt.id === id))
    .filter((bolt): bolt is GroupBolt => bolt !== undefined);
  const freeSlots = MAX_BOLTS - (input.bolts.length - previousBolts.length);
  const defaultSizeId = previousBolts.at(-1)?.sizeId ?? "M10x1.5";
  const generated = generatePatternBolts(pattern, defaultSizeId).slice(0, freeSlots);
  let nextBoltId = Math.max(0, ...input.bolts.map((bolt) => bolt.id)) + 1;

  const nextBolts = generated.map((bolt, index) => ({
    ...bolt,
    id: previousBolts[index]?.id ?? nextBoltId++,
    sizeId: previousBolts[index]?.sizeId ?? defaultSizeId,
    patternId,
  }));
  const nextById = new Map(nextBolts.map((bolt) => [bolt.id, bolt]));
  const previousIds = new Set(group.boltIds);
  const nextIds = new Set(nextBolts.map((bolt) => bolt.id));
  const bolts = input.bolts.flatMap((bolt) => {
    if (!previousIds.has(bolt.id)) return [bolt];
    const replacement = nextById.get(bolt.id);
    return replacement ? [replacement] : [];
  });

  for (const bolt of nextBolts) {
    if (!previousIds.has(bolt.id)) bolts.push(bolt);
  }

  return {
    ...input,
    unitSystem,
    pattern,
    bolts,
    patternGroups: input.patternGroups.map((item) =>
      item.id === patternId ? { ...item, pattern, boltIds: nextBolts.map((bolt) => bolt.id) } : item,
    ),
  };
}

// Convert all editable form values between Imperial and SI while preserving the physical problem.
function convertFormState(
  input: BoltGroupInput,
  fromSystem: UnitSystem,
  toSystem: UnitSystem
): BoltGroupInput {
  const convertedInput = convertFromState(input, boltGroupUnitSchema, fromSystem, toSystem);
  const convertedPatternWithUnits = convertFromState(
    { ...input.pattern, unitSystem: fromSystem },
    boltPatternUnitSchema,
    fromSystem,
    toSystem,
  );
  const { unitSystem: _patternUnitSystem, ...pattern } = convertedPatternWithUnits;

  return {
    ...convertedInput,
    bolts: input.bolts.map((bolt) => {
      const convertedBoltWithUnits = convertFromState(
        { ...bolt, unitSystem: fromSystem },
        boltCoordinatesUnitSchema,
        fromSystem,
        toSystem,
      );
      const { unitSystem: _boltUnitSystem, ...convertedBolt } = convertedBoltWithUnits;
      return convertedBolt;
    }),
    pattern,
    patternGroups: input.patternGroups.map((group) => {
      const convertedPatternWithUnits = convertFromState(
        { ...group.pattern, unitSystem: fromSystem },
        boltPatternUnitSchema,
        fromSystem,
        toSystem,
      );
      const { unitSystem: _groupPatternUnitSystem, ...groupPattern } = convertedPatternWithUnits;
      return { ...group, pattern: groupPattern };
    }),
  };
}

// Per-bolt force-component breakdown.
function ResultsTable({ result, system }: { result: NonNullable<ReturnType<typeof calculateBoltGroup>>; system: "imperial" | "si" }) {
  const lengthUnit = getUnitLabel("length", system);
  const forceUnit = getUnitLabel("force", system);
  return (
    <Card className="mt-6" title="Bolt Force Breakdown" icon="fa-solid fa-list-check">
      <div className="overflow-x-auto">
        <table className="w-full overflow-hidden rounded-xl border border-slate-100 text-left text-xs font-mono">
          <thead className="border-b border-slate-200 bg-slate-100 text-[10px] tracking-wider text-slate-600">
            <tr>
              <th rowSpan={2} className="border-r border-slate-200 px-3 py-2.5 text-center">Bolt</th>
              <th rowSpan={2} className="border-r border-slate-200 px-3 py-2.5 text-center">Size</th>
              <th rowSpan={2} className="border-r border-slate-200 px-3 py-2.5 text-center">Coords (x, y)</th>
              <th colSpan={2} className="border-b border-r border-slate-200 px-3 py-2 text-center">Directional Force</th>
              <th rowSpan={2} className="border-b border-r border-slate-200 px-3 py-2 text-center">Total Force</th>
            </tr>
            <tr className="border-b border-slate-200">
              {['Fx', 'Fy'].map((header, index) => <th key={`${header}-${index}`} className="border-r border-slate-200 px-2 py-2 text-center">{header}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {result.bolts.map((bolt, i) => {
              const isMax = bolt.isMax;
              return (
                <tr key={bolt.id} className={isMax ? "bg-red-50" : ""}>
                  <td className="px-4 py-2 text-slate-800">{i}</td>
                  <td className="px-4 py-2 text-slate-800">{bolt.sizeId}{isMax ? " ★" : ""}</td>
                  <td className="px-4 py-2 text-slate-500">({formatSignificantFigures(bolt.x, 2)}, {formatSignificantFigures(bolt.y, 2)}) {lengthUnit}</td>
                  <td className="px-4 py-2 text-slate-500">{formatSignificantFigures(bolt.fx, 2)} {forceUnit}</td>
                  <td className="px-4 py-2 text-slate-500">{formatSignificantFigures(bolt.fy, 2)} {forceUnit}</td>
                  <td className="px-4 py-2 text-slate-600">{formatSignificantFigures(bolt.resultant, 2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

const theoryEquation = (expression: string) => (
  <Equation key={expression} expression={expression} />
);

const theoryNomenclature: Array<[string, string]> = [
  [String.raw`x_i, y_i`, "Coordinates of bolt i in the common origin"],
  [String.raw`A_i`, "Shank area used to weight bolt i"],
  [String.raw`A`, "Total area, sum of A_i"],
  [String.raw`\bar{x}, \bar{y}`, "Area-weighted centroid of the pattern"],
  [String.raw`r_{xi}, r_{yi}`, "Position of bolt i relative to the centroid"],
  [String.raw`J`, "Polar moment of the bolt areas about the centroid"],
  [String.raw`F_{xk}, F_{yk}`, "Applied force components at point (x_k, y_k)"],
  [String.raw`M`, "Applied free couple, counter-clockwise positive"],
  [String.raw`\Sigma F_x, \Sigma F_y`, "Total force reduced to the centroid"],
  [String.raw`M_c`, "Total moment about the centroid"],
  [String.raw`F'_i`, "Direct (primary) shear on bolt i"],
  [String.raw`F''_i`, "Moment-induced (secondary) shear on bolt i"],
  [String.raw`R_i`, "Resultant force on bolt i"],
];

const theoryReferences: Array<[string, string]> = [
  [
    "Shigley's Mechanical Engineering Design (Budynas & Nisbett), Chapter 8",
    "Bolted joints loaded in shear: centroid of the bolt group, primary and secondary shear, and the torsion formula for eccentric loads.",
  ],
  [
    "AISC Steel Construction Manual, Part 7",
    "Eccentrically loaded bolt groups: elastic vector method and instantaneous-center method.",
  ],
  ["ISO 724 and ISO 898-1", "Metric thread dimensions and tensile stress area."],
  ["ASME B1.1", "Unified inch threads and tensile stress area."],
];

function Theory() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card>
        <div className="space-y-6">
          <div>
            <h2 className="mb-2 text-lg font-bold text-slate-900">Bolt Group Shear Methodology</h2>
            <p className="text-sm leading-relaxed text-slate-600">
              This calculator finds the shear force carried by each bolt when forces and a moment
              act in the plane of the bolt pattern. It uses the elastic vector method: the plates
              are rigid, bolt deflection is proportional to distance from the centroid, and the
              load is distributed according to each bolt&apos;s area. All formulas are evaluated in
              SI units; the unit toggle changes display only.
            </p>
          </div>
          <hr className="border-slate-200" />

          <TheorySection
            title="1. Bolt shear area"
            description="The current calculation weights each bolt using its major-diameter shank area. The tensile stress area formula is included for reference but is not used by this calculator."
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <TheoryPanel label="Metric tensile stress area — ISO 724 / ISO 898-1">
                {theoryEquation(String.raw`A_t = \frac{\pi}{4}\left(d - 0.938194\,p\right)^2`)}
              </TheoryPanel>
              <TheoryPanel label="Imperial tensile stress area — ASME B1.1">
                {theoryEquation(String.raw`A_t = 0.7854\left(D - \frac{0.9743}{n}\right)^2`)}
              </TheoryPanel>
            </div>
            <TheoryPanel label="Shank area used in the calculation">
              {theoryEquation(String.raw`A_d = \frac{\pi d^2}{4}`)}
            </TheoryPanel>
          </TheorySection>

          <TheorySection
            title="2. Centroid of the pattern"
            description="The centroid is the area-weighted average of the bolt coordinates. For identical bolts it is the geometric center."
          >
            <TheoryPanel>
              {theoryEquation(
                String.raw`\bar{x} = \frac{\sum A_i\,x_i}{\sum A_i}, \qquad \bar{y} = \frac{\sum A_i\,y_i}{\sum A_i}`,
              )}
              {theoryEquation(String.raw`r_{xi} = x_i - \bar{x}, \qquad r_{yi} = y_i - \bar{y}`)}
              {theoryEquation(String.raw`J = \sum A_i\left(r_{xi}^2 + r_{yi}^2\right)`)}
            </TheoryPanel>
          </TheorySection>

          <TheorySection
            title="3. Loads reduced to the centroid"
            description="Each applied force is moved to the centroid, adding its moment about the centroid. The applied free couple is unchanged."
          >
            <TheoryPanel>
              {theoryEquation(String.raw`\Sigma F_x = \sum_k F_{xk}, \qquad \Sigma F_y = \sum_k F_{yk}`)}
              {theoryEquation(
                String.raw`M_c = M + \sum_k\Big[(x_k - \bar{x})\,F_{yk} - (y_k - \bar{y})\,F_{xk}\Big]`,
              )}
            </TheoryPanel>
          </TheorySection>

          <TheorySection title="4. Direct (primary) shear" description="The total force is shared in proportion to each bolt&apos;s shank area.">
            <TheoryPanel>
              {theoryEquation(
                String.raw`F'_{xi} = \Sigma F_x\,\frac{A_i}{A}, \qquad F'_{yi} = \Sigma F_y\,\frac{A_i}{A}`,
              )}
            </TheoryPanel>
          </TheorySection>

          <TheorySection
            title="5. Moment-induced (secondary) shear"
            description="The moment is resisted by forces perpendicular to the radius from the centroid, proportional to bolt area and distance."
          >
            <TheoryPanel>
              {theoryEquation(
                String.raw`F''_{xi} = -\,\frac{M_c\,A_i\,r_{yi}}{J}, \qquad F''_{yi} = \frac{M_c\,A_i\,r_{xi}}{J}`,
              )}
              {theoryEquation(
                String.raw`\lvert F''_i\rvert = \frac{M_c\,A_i\,r_i}{J}, \qquad r_i = \sqrt{r_{xi}^2 + r_{yi}^2}`,
              )}
            </TheoryPanel>
            <p className="text-xs leading-relaxed text-slate-600">
              For identical bolts this becomes the standard torsion formula F&apos;&apos; = M_c·r_i / Σr².
            </p>
          </TheorySection>

          <TheorySection title="6. Total force on each bolt">
            <TheoryPanel>
              {theoryEquation(String.raw`F_{xi} = F'_{xi} + F''_{xi}, \qquad F_{yi} = F'_{yi} + F''_{yi}`)}
              {theoryEquation(
                String.raw`R_i = \sqrt{F_{xi}^2 + F_{yi}^2}, \qquad \theta_i = \operatorname{atan2}(F_{yi},\,F_{xi})`,
              )}
            </TheoryPanel>
          </TheorySection>

          <TheorySection
            title="7. Equilibrium check"
            description="The calculator verifies that the bolt forces reproduce the loads at the centroid."
          >
            <TheoryPanel>
              {theoryEquation(String.raw`\sum F_{xi} = \Sigma F_x, \qquad \sum F_{yi} = \Sigma F_y`)}
              {theoryEquation(String.raw`\sum\left(r_{xi}\,F_{yi} - r_{yi}\,F_{xi}\right) = M_c`)}
            </TheoryPanel>
          </TheorySection>

          <TheorySection
            title="8. Pattern generators"
            description="Generated bolts remain individually editable in the bolt table."
          >
            <TheoryPanel label="Rectangle grid">
              {theoryEquation(
                String.raw`x = c_x + \left(i - \tfrac{n_c-1}{2}\right)s_x, \qquad y = c_y + \left(j - \tfrac{n_r-1}{2}\right)s_y`,
              )}
            </TheoryPanel>
            <TheoryPanel label="Line between start (x_s, y_s) and end (x_e, y_e)">
              {theoryEquation(
                String.raw`t_i = \frac{i}{n-1}, \qquad x_i = x_s + t_i(x_e-x_s), \qquad y_i = y_s + t_i(y_e-y_s)`,
              )}
              <p className="text-xs text-slate-600">For a one-bolt line, the bolt is placed at the segment midpoint.</p>
            </TheoryPanel>
            <TheoryPanel label="Single bolt at (c_x, c_y)">
              {theoryEquation(String.raw`x = c_x, \qquad y = c_y`)}
            </TheoryPanel>
          </TheorySection>

          <TheorySection title="Nomenclature">
            <TheoryNomenclature entries={theoryNomenclature} />
          </TheorySection>

          <TheorySection title="Sign conventions and assumptions">
            <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-600">
              <li>x points right, y points up, and positive moments are counter-clockwise.</li>
              <li>
                Bolt forces are shown in the same sense as applied loads. Reverse the signs for the
                force the bolt exerts back on the plate.
              </li>
              <li>All forces and moments lie in the plane of the pattern; bolts carry shear only.</li>
              <li>
                The elastic method assumes rigid plates and linear bolt response. The
                instantaneous-center method, which allows redistribution after yielding, is not
                implemented.
              </li>
              <li>This page reports forces only; it does not check bolt shear, bearing, or slip capacity.</li>
              <li>A single bolt, or bolts all at the centroid, cannot resist a moment.</li>
            </ul>
          </TheorySection>

          <TheorySection title="References">
            <TheoryReferences entries={theoryReferences} />
          </TheorySection>
        </div>
      </Card>
    </div>
  );
}

type BoltCoordinatesWithUnits = GroupBolt & { unitSystem: UnitSystem };

const boltGroupUnitSchema: UnitSchema<BoltGroupInput> = {
  Fx: "force",
  Fy: "force",
  Fz: "force",
  xL: "length",
  yL: "length",
  zL: "length",
  Mx: "moment",
  My: "moment",
  Mz: "moment",
};

const boltCoordinatesUnitSchema: UnitSchema<BoltCoordinatesWithUnits> = {
  x: "length",
  y: "length",
};

const boltPatternUnitSchema: UnitSchema<BoltPatternWithUnits> = {
  cx: "length",
  cy: "length",
  dx: "length",
  dy: "length",
  startX: "length",
  startY: "length",
  endX: "length",
  endY: "length",
};