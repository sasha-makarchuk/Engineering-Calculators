// Bolt strength calculator page: independent fastener-system and display-unit toggles, live results,
// a dynamic joint diagram, and a detailed calculation section. The math lives in engineering/boltedJoint.ts.
import { useId, useMemo, useState, type ReactNode } from "react";
import { Card } from "../components/Card";
import { JointDiagram } from "../components/JointDiagram";
import { SiteHeader, type PageTab } from "../components/SiteHeader";
import { UnitInput } from "../components/UnitInput";
import { UnitToggle } from "../components/UnitToggle";
import { useUnitSystem } from "../components/units/UnitContext";
import { BoltedJointTheory } from "./BoltedJointTheory";
import {
  CUSTOM_MATERIAL_ID,
  CUSTOM_SCATTER_ID,
  NUT_FACTORS,
  PLATE_MATERIALS,
  SCATTER_PRESETS,
  findPlateMaterial,
} from "../data/plateMaterials";
import {
  DEFAULT_GRADE,
  HOLE_FIT_LABELS,
  getGrades,
  getSizes,
  nearestSize,
  type FastenerSize,
  type HoleFit,
  type ThreadSeries,
} from "../data/fasteners";
import {
  STEEL_E,
  autoBoltLength,
  autoTappedEngagement,
  calculateBoltedJoint,
  fosStatus,
  formatFos,
  type BoltedJointInput,
  type BoltedJointResult,
  type FastenerSystem,
  type FosStatus,
  type JointConfig,
  type PreloadMode,
  type ShearPlane,
} from "../engineering/boltedJoint";
import {
  formatSignificantFigures,
  fromBase,
  getUnitLabel,
  toBase,
  type UnitQuantity,
  type UnitSystem,
} from "../engineering/units";

// ---------------------------------------------------------------------------------------------
// Form state. Everything is stored in SI base units (mm, N, MPa, N-mm); inputs convert for display.
// ---------------------------------------------------------------------------------------------

interface PlateForm {
  materialId: string;
  t: number | null;
  // Values used only when materialId === "custom"
  sy: number;
  su: number;
  e: number;
}

interface FormState {
  fastenerSystem: FastenerSystem;
  series: ThreadSeries;
  sizeId: string;
  gradeId: string;
  commonOnly: boolean;
  config: JointConfig;
  plate1: PlateForm;
  plate2: PlateForm;
  washerEnabled: boolean;
  holeFit: HoleFit;
  // Overrides: null means "use the standard / automatic value"
  washerOd: number | null;
  washerT: number | null;
  hole: number | null;
  engagement: number | null;
  boltLength: number | null;
  nutSu: number | null;
  tensile: number | null;
  shear: number | null;
  requiredClamp: number | null;
  mu: number | null;
  shearPlane: ShearPlane;
  preloadMode: PreloadMode;
  preloadPercent: number | null;
  preloadForce: number | null;
  preloadTorque: number | null;
  nutFactorId: string;
  nutFactorCustom: number | null;
  variation: boolean;
  scatterId: string;
  scatterCustom: number | null; // percent
  targetFos: number | null;
}

const NO_OVERRIDES = {
  washerOd: null,
  washerT: null,
  hole: null,
  engagement: null,
  boltLength: null,
} as const;

// Start with round numbers in whichever display system is active when the page opens.
function initialForm(system: UnitSystem): FormState {
  const imperial = system === "imperial";
  const plate = (mm: number, inches: number): PlateForm => ({
    materialId: "44w",
    t: toBase(imperial ? inches : mm, "length", system),
    sy: 355,
    su: 490,
    e: STEEL_E,
  });
  return {
    fastenerSystem: "metric",
    series: "coarse",
    sizeId: "M12x1.75",
    gradeId: DEFAULT_GRADE.metric,
    commonOnly: false,
    config: "bolt_nut",
    plate1: plate(10, 0.375),
    plate2: plate(12, 0.5),
    washerEnabled: true,
    holeFit: "normal",
    ...NO_OVERRIDES,
    nutSu: null,
    tensile: toBase(imperial ? 2 : 8, "kforce", system),
    shear: toBase(imperial ? 0.5 : 2, "kforce", system),
    requiredClamp: 0,
    mu: 0.15,
    shearPlane: "threads",
    preloadMode: "percent",
    preloadPercent: 75,
    preloadForce: toBase(imperial ? 10 : 50, "kforce", system),
    preloadTorque: toBase(imperial ? 100 : 150, "torque", system),
    nutFactorId: "zinc",
    nutFactorCustom: 0.2,
    variation: true,
    scatterId: "torque",
    scatterCustom: 25,
    targetFos: 1.5,
  };
}

function resolvePlate(plate: PlateForm): { sy: number; su: number; e: number } {
  if (plate.materialId === CUSTOM_MATERIAL_ID) return { sy: plate.sy, su: plate.su, e: plate.e };
  const material = findPlateMaterial(plate.materialId) ?? PLATE_MATERIALS[0];
  return material
    ? { sy: material.sy, su: material.su, e: material.e }
    : { sy: plate.sy, su: plate.su, e: plate.e };
}

// ---------------------------------------------------------------------------------------------
// Model: turn form state into engineering inputs, automatic values, and results.
// ---------------------------------------------------------------------------------------------

interface Model {
  size: FastenerSize;
  gradeLabel: string;
  gp: { sp: number; sy: number; su: number };
  values: {
    washerOd: number;
    washerT: number;
    hole: number;
    engagement: number;
    boltLength: number;
    nutSu: number;
  };
  auto: {
    washerOd: number;
    washerT: number;
    hole: number;
    engagement: number;
    boltLength: number;
    nutSu: number;
  };
  scatter: number;
  nutFactor: number;
  input: BoltedJointInput | null;
  result: BoltedJointResult | null;
  error: string | null;
}

function buildModel(f: FormState): Model {
  const sizes = getSizes(f.fastenerSystem, f.series);
  const size = (sizes.find((s) => s.id === f.sizeId) ?? sizes[0]) as FastenerSize;
  const grades = getGrades(f.fastenerSystem);
  const grade = grades.find((g) => g.id === f.gradeId) ?? grades[0];
  const gp = grade ? grade.props(size.d) : { sp: 0, sy: 0, su: 0 };
  const p1 = resolvePlate(f.plate1);
  const p2 = resolvePlate(f.plate2);
  const isNut = f.config === "bolt_nut";

  const t1 = f.plate1.t ?? 0;
  const t2 = f.plate2.t ?? 0;
  const washerOd = f.washerOd ?? size.washerOd;
  const washerT = f.washerT ?? size.washerT;
  const tw = f.washerEnabled ? washerT : 0;
  const hole = f.hole ?? size.holes[f.holeFit];
  const nutSuAuto = gp.su;
  const engagementAuto = isNut
    ? size.nutHeight
    : autoTappedEngagement(
        size.d,
        size.pitch,
        size.at,
        gp.su,
        p2.su,
        t2 || size.d,
        f.fastenerSystem,
      );
  const engagement = f.engagement ?? engagementAuto;
  const stack = isNut ? t1 + t2 + 2 * tw : t1 + tw;
  const boltLengthAuto = autoBoltLength(
    f.fastenerSystem,
    stack,
    isNut ? size.nutHeight : Math.min(engagement, t2 || engagement),
    size.pitch,
  );
  const boltLength = f.boltLength ?? boltLengthAuto;
  const nutSu = f.nutSu ?? nutSuAuto;

  const scatterPreset = SCATTER_PRESETS.find((s) => s.id === f.scatterId);
  const scatter = !f.variation
    ? 0
    : f.scatterId === CUSTOM_SCATTER_ID
      ? (f.scatterCustom ?? 0) / 100
      : (scatterPreset?.fraction ?? 0);
  const nutPreset = NUT_FACTORS.find((n) => n.id === f.nutFactorId);
  const nutFactor = nutPreset ? nutPreset.k : (f.nutFactorCustom ?? 0);

  const base = {
    size,
    gradeLabel: grade?.label ?? "",
    gp,
    values: { washerOd, washerT, hole, engagement, boltLength, nutSu },
    auto: {
      washerOd: size.washerOd,
      washerT: size.washerT,
      hole: size.holes[f.holeFit],
      engagement: engagementAuto,
      boltLength: boltLengthAuto,
      nutSu: nutSuAuto,
    },
    scatter,
    nutFactor,
  };

  if (f.plate1.t === null || f.plate2.t === null) {
    return { ...base, input: null, result: null, error: "Enter both plate thicknesses." };
  }
  if (!grade) return { ...base, input: null, result: null, error: "Select a bolt grade." };

  const input: BoltedJointInput = {
    fastenerSystem: f.fastenerSystem,
    config: f.config,
    d: size.d,
    pitch: size.pitch,
    headAF: size.headAF,
    headHeight: size.headHeight,
    nutHeight: size.nutHeight,
    boltLength,
    sp: gp.sp,
    sy: gp.sy,
    su: gp.su,
    eBolt: STEEL_E,
    washerEnabled: f.washerEnabled,
    washerOd,
    washerT,
    hole,
    plate1: { t: t1, ...p1 },
    plate2: { t: t2, ...p2 },
    engagement,
    nutSu,
    tensileLoad: f.tensile ?? 0,
    shearLoad: f.shear ?? 0,
    requiredClamp: f.requiredClamp ?? 0,
    mu: f.mu ?? 0,
    shearPlane: f.shearPlane,
    preloadMode: f.preloadMode,
    preloadPercent: f.preloadPercent ?? 0,
    preloadForce: f.preloadForce ?? 0,
    preloadTorque: f.preloadTorque ?? 0,
    nutFactor,
    scatter,
  };

  try {
    return { ...base, input, result: calculateBoltedJoint(input), error: null };
  } catch (error) {
    return {
      ...base,
      input,
      result: null,
      error: error instanceof Error ? error.message : "Unable to calculate.",
    };
  }
}

// ---------------------------------------------------------------------------------------------
// Small form components
// ---------------------------------------------------------------------------------------------

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  label?: string;
}) {
  return (
    <div>
      {label ? <span className="label-input">{label}</span> : null}
      <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-1 text-xs">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={
              value === option.value
                ? "flex-1 rounded-md bg-sky-600 px-3 py-1.5 font-medium text-white transition-all"
                : "flex-1 rounded-md px-3 py-1.5 font-medium text-slate-500 transition-all hover:text-slate-800"
            }
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
  description,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  description?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="label-input">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="box-input pr-3 font-sans"
      >
        {children}
      </select>
      {description ? <p className="mt-1 text-[11px] text-slate-400">{description}</p> : null}
    </div>
  );
}

// Plain numeric field (no units) that keeps what the user typed while editing.
function NumberField({
  label,
  value,
  onChange,
  suffix,
  step,
  min,
  description,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  suffix?: string;
  step?: number;
  min?: number;
  description?: string;
}) {
  const id = useId();
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (value === null ? "" : formatSignificantFigures(value, 6));
  return (
    <div>
      <label htmlFor={id} className="label-input">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={shown}
          step={step}
          min={min}
          onChange={(event) => {
            const raw = event.target.value;
            setText(raw);
            if (raw === "") {
              onChange(null);
              return;
            }
            const parsed = Number(raw);
            onChange(Number.isFinite(parsed) ? parsed : null);
          }}
          onBlur={() => setText(null)}
          className="box-input"
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-3 top-2 text-xs text-slate-400">
            {suffix}
          </span>
        ) : null}
      </div>
      {description ? <p className="mt-1 text-[11px] text-slate-400">{description}</p> : null}
    </div>
  );
}

// UnitInput wrapper that stores values in SI base units and converts to the active display system.
function BaseUnitInput({
  label,
  quantity,
  base,
  onBase,
  steps,
  min,
  description,
}: {
  label: string;
  quantity: UnitQuantity;
  base: number | null;
  onBase: (value: number | null) => void;
  steps?: [number, number];
  min?: number;
  description?: string;
}) {
  const { unitSystem } = useUnitSystem();
  return (
    <UnitInput
      label={label}
      quantity={quantity}
      value={base === null ? null : fromBase(base, quantity, unitSystem)}
      onChange={(value) => onBase(value === null ? null : toBase(value, quantity, unitSystem))}
      step={steps ? (unitSystem === "imperial" ? steps[1] : steps[0]) : undefined}
      min={min}
      description={description}
    />
  );
}

// Field pre-filled with a standard/automatic value that the user can overwrite, with a reset link.
function OverrideInput({
  label,
  quantity,
  unitSystem,
  autoBase,
  overrideBase,
  onChange,
  step,
}: {
  label: string;
  quantity: UnitQuantity;
  unitSystem: UnitSystem;
  autoBase: number;
  overrideBase: number | null;
  onChange: (base: number | null) => void;
  step?: number;
}) {
  const id = useId();
  const [text, setText] = useState<string | null>(null);
  const unit = getUnitLabel(quantity, unitSystem);
  const overridden = overrideBase !== null;
  const shownValue = fromBase(overridden ? overrideBase : autoBase, quantity, unitSystem);
  const shown = text ?? formatSignificantFigures(shownValue, 4);
  return (
    <div>
      <label htmlFor={id} className="label-input flex items-center justify-between">
        <span>{label}</span>
        {overridden ? (
          <button
            type="button"
            onClick={() => {
              setText(null);
              onChange(null);
            }}
            className="text-[10px] font-medium text-sky-600 hover:text-sky-800"
          >
            reset
          </button>
        ) : (
          <span className="text-[10px] font-normal text-slate-400">standard</span>
        )}
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={shown}
          step={step}
          onChange={(event) => {
            const raw = event.target.value;
            setText(raw);
            if (raw === "") {
              onChange(null);
              return;
            }
            const parsed = Number(raw);
            if (Number.isFinite(parsed)) onChange(toBase(parsed, quantity, unitSystem));
          }}
          onBlur={() => setText(null)}
          className={`box-input ${overridden ? "" : "text-slate-500"}`}
        />
        <span className="pointer-events-none absolute right-3 top-2 text-xs text-slate-400">
          {unit}
        </span>
      </div>
    </div>
  );
}

const STATUS_STYLES: Record<FosStatus | "info", string> = {
  pass: "bg-emerald-100 text-emerald-700",
  warn: "bg-amber-100 text-amber-700",
  fail: "bg-red-100 text-red-700",
  info: "bg-slate-100 text-slate-500",
};
const STATUS_LABELS: Record<FosStatus | "info", string> = {
  pass: "PASS",
  warn: "WARNING",
  fail: "FAIL",
  info: "—",
};

function StatusPill({ status }: { status: FosStatus | "info" }) {
  return (
    <span
      className={`rounded px-2 py-0.5 text-[10px] font-bold tracking-wide ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-0.5 font-mono text-sm font-bold text-slate-800">{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------------------------

type TabId = "properties" | "preload" | "details";

export function BoltedJointPage() {
  const { unitSystem } = useUnitSystem();
  const [form, setForm] = useState<FormState>(() => initialForm(unitSystem));
  const [pageTab, setPageTab] = useState<PageTab>("calc");
  const [tab, setTab] = useState<TabId>("properties");
  const [resetKey, setResetKey] = useState(0);

  const model = useMemo(() => buildModel(form), [form]);
  const { size, result } = model;
  const fastenerUnits: UnitSystem = form.fastenerSystem === "metric" ? "si" : "imperial";

  const update = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm((previous) => ({ ...previous, [field]: value }));
  const updatePlate = (which: "plate1" | "plate2", patch: Partial<PlateForm>) =>
    setForm((previous) => ({ ...previous, [which]: { ...previous[which], ...patch } }));

  // Changing system, series or size clears overrides because the standard values belong to the old size.
  const changeSystem = (system: FastenerSystem) => {
    setForm((previous) => {
      const list = getSizes(system, "coarse");
      const next = nearestSize(list, size.d);
      return {
        ...previous,
        fastenerSystem: system,
        series: "coarse",
        sizeId: next?.id ?? previous.sizeId,
        gradeId: DEFAULT_GRADE[system],
        nutSu: null,
        ...NO_OVERRIDES,
      };
    });
  };
  const changeSeries = (series: ThreadSeries) => {
    setForm((previous) => {
      const next = nearestSize(getSizes(previous.fastenerSystem, series), size.d);
      return { ...previous, series, sizeId: next?.id ?? previous.sizeId, ...NO_OVERRIDES };
    });
  };

  const allSizes = getSizes(form.fastenerSystem, form.series);
  const visibleSizes = form.commonOnly
    ? allSizes.filter((s) => s.common || s.id === size.id)
    : allSizes;
  const commonSizes = visibleSizes.filter((s) => s.common);
  const otherSizes = visibleSizes.filter((s) => !s.common);
  const grades = getGrades(form.fastenerSystem);
  const isNut = form.config === "bolt_nut";

  const lengthUnit = getUnitLabel("length", unitSystem);
  const fastenerLengthUnit = getUnitLabel("length", fastenerUnits);
  const dispLen = (mm: number, digits = 4) =>
    `${formatSignificantFigures(fromBase(mm, "length", unitSystem), digits)} ${lengthUnit}`;
  const fastLen = (mm: number, digits = 4) =>
    `${formatSignificantFigures(fromBase(mm, "length", fastenerUnits), digits)} ${fastenerLengthUnit}`;
  const disp = (value: number, quantity: UnitQuantity, digits = 4) =>
    `${formatSignificantFigures(fromBase(value, quantity, unitSystem), digits)} ${getUnitLabel(quantity, unitSystem)}`;

  const target = form.targetFos ?? 1.5;

  const plateFields = (which: "plate1" | "plate2", title: string) => {
    const plate = form[which];
    const material = findPlateMaterial(plate.materialId);
    return (
      <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
        <h3 className="text-xs font-bold text-slate-600">{title}</h3>
        <SelectField
          label="Material"
          value={plate.materialId}
          onChange={(value) => updatePlate(which, { materialId: value })}
          description={material?.note}
        >
          {PLATE_MATERIALS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
          <option value={CUSTOM_MATERIAL_ID}>Custom material…</option>
        </SelectField>
        <BaseUnitInput
          label="Thickness"
          quantity="length"
          base={plate.t}
          onBase={(value) => updatePlate(which, { t: value })}
          min={0.000001}
          steps={[1, 0.0625]}
        />
        {plate.materialId === CUSTOM_MATERIAL_ID ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <BaseUnitInput
              label="Yield (Sy)"
              quantity="kstress"
              base={plate.sy}
              onBase={(value) => updatePlate(which, { sy: value ?? 0 })}
              min={0.000001}
            />
            <BaseUnitInput
              label="Ultimate (Su)"
              quantity="kstress"
              base={plate.su}
              onBase={(value) => updatePlate(which, { su: value ?? 0 })}
              min={0.000001}
            />
            <BaseUnitInput
              label="Modulus (E)"
              quantity="modulus"
              base={plate.e}
              onBase={(value) => updatePlate(which, { e: value ?? 0 })}
              min={0.000001}
            />
          </div>
        ) : material ? (
          <p className="text-[11px] text-slate-400">
            Sy {disp(material.sy, "kstress", 3)} · Su {disp(material.su, "kstress", 3)} · E{" "}
            {disp(material.e, "modulus", 3)}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-800 antialiased">
      <SiteHeader
        icon="fa-solid fa-screwdriver-wrench"
        title={
          <>
            Bolt Strength Calculator{" "}
            <span className="rounded border border-sky-700/50 bg-sky-900/80 px-2 py-0.5 text-xs font-normal text-sky-200">
              Engineering Tool
            </span>
          </>
        }
        subtitle="Preloaded joint strength, separation, thread stripping and bearing"
        right = {< UnitToggle />}
        pageTab = { pageTab }
        setPageTab = { setPageTab }
      >
      </SiteHeader>

      <main className="mx-auto w-full max-w-7xl flex-grow px-4 py-6 sm:px-6 lg:px-8">
        {pageTab === "theory" ? (
          <BoltedJointTheory />
        ) : (
          <>
            <p className="mb-5 text-sm text-slate-500">
              Analyze preloaded bolted joints using Shigley&apos;s method. The unit toggle sets how
              plate thickness, loads and stresses are displayed; the fastener system sets bolt sizes
              and thread series.
            </p>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Inputs */}
              <div key={resetKey} className="space-y-6 lg:col-span-7">
                <Card
                  title="1. Fastener & Joint Configuration"
                  icon="fa-solid fa-screwdriver-wrench"
                >
                  <div className="space-y-4">
                    <Segmented
                      label="Fastener system"
                      value={form.fastenerSystem}
                      onChange={changeSystem}
                      options={[
                        { value: "metric", label: "Metric bolts" },
                        { value: "imperial", label: "Imperial bolts" },
                      ]}
                    />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <SelectField
                        label="Thread type"
                        value={form.series}
                        onChange={(value) => changeSeries(value as ThreadSeries)}
                      >
                        <option value="coarse">
                          {form.fastenerSystem === "metric" ? "Coarse" : "Coarse (UNC)"}
                        </option>
                        <option value="fine">
                          {form.fastenerSystem === "metric" ? "Fine" : "Fine (UNF)"}
                        </option>
                      </SelectField>
                      <SelectField
                        label="Material / grade"
                        value={grades.find((g) => g.id === form.gradeId)?.id ?? grades[0]?.id ?? ""}
                        onChange={(value) =>
                          setForm((previous) => ({ ...previous, gradeId: value, nutSu: null }))
                        }
                      >
                        {grades.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.label} ({g.standard})
                          </option>
                        ))}
                      </SelectField>
                      <div>
                        <SelectField
                          label="Bolt size"
                          value={size.id}
                          onChange={(value) =>
                            setForm((previous) => ({ ...previous, sizeId: value, ...NO_OVERRIDES }))
                          }
                        >
                          {commonSizes.length > 0 ? (
                            <optgroup label="★ Common sizes">
                              {commonSizes.map((s) => (
                                <option key={s.id} value={s.id}>
                                  ★ {s.label}
                                </option>
                              ))}
                            </optgroup>
                          ) : null}
                          {otherSizes.length > 0 ? (
                            <optgroup label="Other sizes">
                              {otherSizes.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.label}
                                </option>
                              ))}
                            </optgroup>
                          ) : null}
                        </SelectField>
                        <label className="mt-2 flex cursor-pointer items-center gap-2 text-[11px] text-slate-500">
                          <input
                            type="checkbox"
                            checked={form.commonOnly}
                            onChange={(event) => update("commonOnly", event.target.checked)}
                            className="h-3.5 w-3.5 accent-sky-600"
                          />
                          Show common sizes only
                        </label>
                      </div>
                      <div>
                        <span className="label-input">Joint configuration</span>
                        <div className="flex gap-4 pt-1.5 text-xs text-slate-700">
                          <label className="flex cursor-pointer items-center gap-2">
                            <input
                              type="radio"
                              name="config"
                              checked={isNut}
                              onChange={() =>
                                setForm((previous) => ({
                                  ...previous,
                                  config: "bolt_nut",
                                  engagement: null,
                                  boltLength: null,
                                }))
                              }
                              className="accent-sky-600"
                            />{" "}
                            Bolt + nut
                          </label>
                          <label className="flex cursor-pointer items-center gap-2">
                            <input
                              type="radio"
                              name="config"
                              checked={!isNut}
                              onChange={() =>
                                setForm((previous) => ({
                                  ...previous,
                                  config: "tapped_hole",
                                  engagement: null,
                                  boltLength: null,
                                }))
                              }
                              className="accent-sky-600"
                            />{" "}
                            Tapped hole
                          </label>
                        </div>
                      </div>
                    </div>
                    <p className="rounded-lg bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-500">
                      {size.label} · d {fastLen(size.d)} · pitch {fastLen(size.pitch)} · At{" "}
                      {disp(size.at, "area", 4)} · Sp {disp(model.gp.sp, "kstress", 3)} · Sy{" "}
                      {disp(model.gp.sy, "kstress", 3)} · Su {disp(model.gp.su, "kstress", 3)}
                    </p>
                  </div>
                </Card>

                <Card title="2. Joint Geometry" icon="fa-solid fa-layer-group">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {plateFields("plate1", "Plate 1 (under bolt head)")}
                      {plateFields("plate2", isNut ? "Plate 2 (nut side)" : "Plate 2 (tapped)")}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <SelectField
                        label="Washers"
                        value={form.washerEnabled ? "standard" : "none"}
                        onChange={(value) => update("washerEnabled", value === "standard")}
                        description={
                          isNut
                            ? "Standard washers go under the head and the nut."
                            : "A standard washer goes under the head."
                        }
                      >
                        <option value="standard">Standard flat washers</option>
                        <option value="none">None</option>
                      </SelectField>
                      <SelectField
                        label="Clearance hole fit"
                        value={form.holeFit}
                        onChange={(value) =>
                          setForm((previous) => ({
                            ...previous,
                            holeFit: value as HoleFit,
                            hole: null,
                          }))
                        }
                      >
                        {(Object.keys(HOLE_FIT_LABELS[form.fastenerSystem]) as HoleFit[]).map(
                          (fit) => (
                            <option key={fit} value={fit}>
                              {HOLE_FIT_LABELS[form.fastenerSystem][fit]}
                            </option>
                          ),
                        )}
                      </SelectField>
                    </div>

                    <div>
                      <h3 className="mb-2 text-xs font-bold text-slate-600">
                        Fastener dimensions{" "}
                        <span className="font-normal text-slate-400">
                          (standard values; overwrite any field)
                        </span>
                      </h3>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <OverrideInput
                          label="Hole diameter"
                          quantity="length"
                          unitSystem={fastenerUnits}
                          autoBase={model.auto.hole}
                          overrideBase={form.hole}
                          onChange={(value) => update("hole", value)}
                        />
                        {form.washerEnabled ? (
                          <OverrideInput
                            label="Washer OD"
                            quantity="length"
                            unitSystem={fastenerUnits}
                            autoBase={model.auto.washerOd}
                            overrideBase={form.washerOd}
                            onChange={(value) => update("washerOd", value)}
                          />
                        ) : null}
                        {form.washerEnabled ? (
                          <OverrideInput
                            label="Washer thickness"
                            quantity="length"
                            unitSystem={fastenerUnits}
                            autoBase={model.auto.washerT}
                            overrideBase={form.washerT}
                            onChange={(value) => update("washerT", value)}
                          />
                        ) : null}
                        <OverrideInput
                          label={isNut ? "Thread engagement (nut)" : "Thread engagement"}
                          quantity="length"
                          unitSystem={fastenerUnits}
                          autoBase={model.auto.engagement}
                          overrideBase={form.engagement}
                          onChange={(value) => update("engagement", value)}
                        />
                        <OverrideInput
                          label="Bolt length"
                          quantity="length"
                          unitSystem={fastenerUnits}
                          autoBase={model.auto.boltLength}
                          overrideBase={form.boltLength}
                          onChange={(value) => update("boltLength", value)}
                        />
                        {isNut ? (
                          <OverrideInput
                            label="Nut ultimate strength"
                            quantity="kstress"
                            unitSystem={unitSystem}
                            autoBase={model.auto.nutSu}
                            overrideBase={form.nutSu}
                            onChange={(value) => update("nutSu", value)}
                          />
                        ) : null}
                      </div>
                      <p className="mt-2 text-[11px] text-slate-400">
                        Bolt lengths, washers and holes follow the fastener system. Grip length
                        (computed): {result ? dispLen(result.grip) : "—"}.
                        {isNut
                          ? " The nut is assumed matched to the bolt unless you overwrite its strength."
                          : " Thread engagement defaults to the length needed to develop the bolt strength."}
                      </p>
                    </div>
                  </div>
                </Card>

                <Card title="3. Loads & Preload" icon="fa-solid fa-arrows-down-to-line">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <BaseUnitInput
                        label="External tensile load"
                        quantity="kforce"
                        base={form.tensile}
                        onBase={(value) => update("tensile", value)}
                        min={0}
                        steps={[0.5, 0.1]}
                      />
                      <BaseUnitInput
                        label="Shear load"
                        quantity="kforce"
                        base={form.shear}
                        onBase={(value) => update("shear", value)}
                        min={0}
                        steps={[0.5, 0.1]}
                      />
                      <BaseUnitInput
                        label="Required clamp force"
                        quantity="kforce"
                        base={form.requiredClamp}
                        onBase={(value) => update("requiredClamp", value)}
                        min={0}
                        steps={[0.5, 0.1]}
                        description="0 = no requirement."
                      />
                      <NumberField
                        label="Friction coefficient (μ)"
                        value={form.mu}
                        onChange={(value) => update("mu", value)}
                        min={0}
                        step={0.01}
                        description="For slip resistance."
                      />
                    </div>
                    <SelectField
                      label="Shear plane passes through"
                      value={form.shearPlane}
                      onChange={(value) => update("shearPlane", value as ShearPlane)}
                    >
                      <option value="threads">Threads (tensile stress area)</option>
                      <option value="shank">Unthreaded shank (full area)</option>
                    </SelectField>

                    <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
                      <SelectField
                        label="Preload type"
                        value={form.preloadMode}
                        onChange={(value) => update("preloadMode", value as PreloadMode)}
                      >
                        <option value="percent">Target preload (% of proof load)</option>
                        <option value="force">Specified preload force</option>
                        <option value="torque">Tightening torque</option>
                      </SelectField>
                      {form.preloadMode === "percent" ? (
                        <NumberField
                          label="Target preload"
                          value={form.preloadPercent}
                          onChange={(value) => update("preloadPercent", value)}
                          suffix="%"
                          min={0}
                          step={5}
                          description="Typically 75 % (reusable) to 90 % (permanent)."
                        />
                      ) : form.preloadMode === "force" ? (
                        <BaseUnitInput
                          label="Preload force"
                          quantity="kforce"
                          base={form.preloadForce}
                          onBase={(value) => update("preloadForce", value)}
                          min={0.000001}
                          steps={[1, 0.5]}
                        />
                      ) : (
                        <BaseUnitInput
                          label="Tightening torque"
                          quantity="torque"
                          base={form.preloadTorque}
                          onBase={(value) => update("preloadTorque", value)}
                          min={0.000001}
                          steps={[10, 10]}
                        />
                      )}
                      <SelectField
                        label="Nut factor (K)"
                        value={form.nutFactorId}
                        onChange={(value) => update("nutFactorId", value)}
                        description="Used for the torque ⇄ preload conversion, T = K·Fi·d."
                      >
                        {NUT_FACTORS.map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.label} (K = {n.k})
                          </option>
                        ))}
                        <option value="custom">Custom…</option>
                      </SelectField>
                      {form.nutFactorId === "custom" ? (
                        <NumberField
                          label="Custom K"
                          value={form.nutFactorCustom}
                          onChange={(value) => update("nutFactorCustom", value)}
                          min={0.01}
                          step={0.01}
                        />
                      ) : null}
                    </div>

                    <div className="space-y-3 border-t border-slate-100 pt-4">
                      <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={form.variation}
                          onChange={(event) => update("variation", event.target.checked)}
                          className="h-3.5 w-3.5 accent-sky-600"
                        />
                        Include preload variation (min / max)
                      </label>
                      {form.variation ? (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <SelectField
                            label="Tightening method"
                            value={form.scatterId}
                            onChange={(value) => update("scatterId", value)}
                          >
                            {SCATTER_PRESETS.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.label}
                              </option>
                            ))}
                            <option value={CUSTOM_SCATTER_ID}>Custom variation…</option>
                          </SelectField>
                          {form.scatterId === CUSTOM_SCATTER_ID ? (
                            <NumberField
                              label="Variation (±)"
                              value={form.scatterCustom}
                              onChange={(value) => update("scatterCustom", value)}
                              suffix="%"
                              min={0}
                              step={5}
                            />
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setForm(initialForm(unitSystem));
                        setResetKey((key) => key + 1);
                      }}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-sky-300 hover:text-sky-700"
                    >
                      <i className="fa-solid fa-rotate-left" aria-hidden="true" /> Reset to defaults
                    </button>
                  </div>
                </Card>
              </div>

              {/* Diagram and results */}
              <div className="space-y-6 lg:col-span-5">
                <Card title="Joint Diagram" icon="fa-solid fa-ruler-combined">
                  <div className="flex justify-center">
                    {result && model.input ? (
                      <JointDiagram
                        config={form.config}
                        d={size.d}
                        headAF={size.headAF}
                        headHeight={size.headHeight}
                        nutHeight={size.nutHeight}
                        washerEnabled={form.washerEnabled}
                        washerOd={model.values.washerOd}
                        washerT={model.values.washerT}
                        hole={model.values.hole}
                        t1={model.input.plate1.t}
                        t2={model.input.plate2.t}
                        grip={result.grip}
                        engagement={result.engagement}
                        boltLength={model.values.boltLength}
                        threadLength={result.threadLength}
                        system={unitSystem}
                      />
                    ) : (
                      <div className="flex min-h-[320px] w-full items-center justify-center rounded-lg border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600">
                        Enter valid inputs to display the diagram.
                      </div>
                    )}
                  </div>
                </Card>

                <Card title="Key Results" icon="fa-solid fa-list-check">
                  {result ? (
                    <ResultsPanel
                      result={result}
                      model={model}
                      form={form}
                      target={target}
                      onTarget={(value) => update("targetFos", value)}
                      unitSystem={unitSystem}
                    />
                  ) : (
                    <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
                      {model.error}
                    </div>
                  )}
                </Card>
              </div>
            </div>

            {/* Calculation details */}
            <Card className="mt-6" title="Calculation Details" icon="fa-solid fa-calculator">
              <p className="mb-3 text-[11px] text-slate-400">
                Computed values for the current inputs. Equations and references are on the Theory
                &amp; References tab.
              </p>
              <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
                {(
                  [
                    ["properties", "Joint Properties"],
                    ["preload", "Preload Details"],
                    ["details", "Detailed Calculations"],
                  ] as Array<[TabId, string]>
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={
                      tab === id
                        ? "border-b-2 border-sky-500 px-4 py-2 text-xs font-semibold text-sky-600"
                        : "border-b-2 border-transparent px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-800"
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              {result && model.input ? (
                tab === "properties" ? (
                  <PropertiesTab
                    result={result}
                    model={model}
                    unitSystem={unitSystem}
                    fastenerUnits={fastenerUnits}
                    fastenerSystem={form.fastenerSystem}
                  />
                ) : tab === "preload" ? (
                  <PreloadTab result={result} unitSystem={unitSystem} />
                ) : (
                  <DetailsTab
                    result={result}
                    model={model}
                    unitSystem={unitSystem}
                    fastenerUnits={fastenerUnits}
                    fastenerSystem={form.fastenerSystem}
                    target={target}
                  />
                )
              ) : (
                <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
                  {model.error}
                </div>
              )}
            </Card>

            <p className="mt-4 text-center text-[11px] text-slate-400">
              Results are for preliminary estimation. Verify against the governing code, bolt
              supplier data and engineering judgment before using them in a final design.
            </p>
          </>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Results summary
// ---------------------------------------------------------------------------------------------

interface ResultRow {
  label: string;
  fos?: number;
  text?: string;
  status: FosStatus | "info";
}

function ResultsPanel({
  result,
  model,
  form,
  target,
  onTarget,
  unitSystem,
}: {
  result: BoltedJointResult;
  model: Model;
  form: FormState;
  target: number;
  onTarget: (value: number | null) => void;
  unitSystem: UnitSystem;
}) {
  const fos = (label: string, value: number): ResultRow => ({
    label,
    fos: value,
    status: fosStatus(value, target),
  });
  const { min, nominal, max } = result.cases;
  const requiredClamp = form.requiredClamp ?? 0;
  const clampOk =
    result.minClampForce > 0 && (requiredClamp <= 0 || result.minClampForce >= requiredClamp);

  const rows: ResultRow[] = [
    fos("Bolt tensile yield FOS — nominal preload", nominal.yieldFos),
    fos("Bolt tensile yield FOS — minimum preload", min.yieldFos),
    fos("Bolt tensile yield FOS — maximum preload", max.yieldFos),
    fos("Separation FOS — nominal preload", nominal.separationFos),
    fos("Separation FOS — minimum preload", min.separationFos),
    fos("Separation FOS — maximum preload", max.separationFos),
    fos("Internal thread stripping FOS", result.internalStripFos),
    fos("External thread stripping FOS", result.externalStripFos),
    fos("Pull-through FOS", result.pullThroughFos),
    fos("Plate bearing FOS", result.bearingFos),
    fos("Bolt shear FOS", result.boltShearFos),
    fos("Slip FOS (friction)", result.slipFos),
    fos("Combined tension + shear yield FOS", result.combinedFos),
  ];
  if (requiredClamp > 0) rows.push(fos("Clamp force FOS (remaining ÷ required)", result.clampFos));
  rows.push({
    label: "Remaining clamping force (min preload)",
    text: `${formatSignificantFigures(fromBase(result.minClampForce, "kforce", unitSystem), 4)} ${getUnitLabel("kforce", unitSystem)}`,
    status: clampOk ? "pass" : "fail",
  });

  const governing = rows.reduce<ResultRow | null>(
    (best, row) =>
      row.fos !== undefined &&
      Number.isFinite(row.fos) &&
      (best === null || (best.fos ?? Infinity) > row.fos)
        ? row
        : best,
    null,
  );
  const overall: FosStatus = rows.some((row) => row.status === "fail")
    ? "fail"
    : rows.some((row) => row.status === "warn")
      ? "warn"
      : "pass";
  const banner =
    overall === "pass"
      ? "border-emerald-500/30 bg-emerald-500/10"
      : overall === "warn"
        ? "border-amber-500/30 bg-amber-500/10"
        : "border-red-500/30 bg-red-500/10";

  return (
    <div className="space-y-4">
      <div className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${banner}`}>
        <div>
          <div className="text-[11px] text-slate-500">Governing check</div>
          <div className="text-sm font-bold text-slate-800">
            {governing ? governing.label : "No loads applied"}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-lg font-bold text-slate-900">
            {governing && governing.fos !== undefined ? formatFos(governing.fos) : "—"}
          </div>
          <StatusPill status={overall} />
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <p className="text-[11px] text-slate-400">
          Pass at or above the target FOS, warning between 1.0 and the target, fail below 1.0.
        </p>
        <div className="w-28 shrink-0">
          <NumberField
            label="Target FOS"
            value={form.targetFos}
            onChange={onTarget}
            min={1}
            step={0.1}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[360px] overflow-hidden rounded-lg border border-slate-200 text-left text-xs">
          <thead className="bg-slate-100 text-[10px] uppercase tracking-wider text-slate-600">
            <tr>
              <th className="px-3 py-2">Check</th>
              <th className="px-3 py-2 text-right">Result</th>
              <th className="px-3 py-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="px-3 py-2 text-slate-700">{row.label}</td>
                <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900">
                  {row.text ?? formatFos(row.fos ?? NaN)}
                </td>
                <td className="px-3 py-2 text-right">
                  <StatusPill status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!form.variation ? (
        <p className="text-[11px] text-slate-400">
          Preload variation is off, so minimum, nominal and maximum preload cases are identical.
        </p>
      ) : null}
      {model.scatter > 0 ? (
        <p className="text-[11px] text-slate-400">
          Minimum / maximum preload = nominal ∓ / ±{" "}
          {formatSignificantFigures(model.scatter * 100, 3)} %.
        </p>
      ) : null}

      {result.warnings.length > 0 ? (
        <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          {result.warnings.map((warning) => (
            <li key={warning}>
              <i className="fa-solid fa-triangle-exclamation mr-2" aria-hidden="true" />
              {warning}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Calculation detail tabs
// ---------------------------------------------------------------------------------------------

function PropertiesTab({
  result,
  model,
  unitSystem,
  fastenerUnits,
  fastenerSystem,
}: {
  result: BoltedJointResult;
  model: Model;
  unitSystem: UnitSystem;
  fastenerUnits: UnitSystem;
  fastenerSystem: FastenerSystem;
}) {
  const len = (mm: number) =>
    `${formatSignificantFigures(fromBase(mm, "length", unitSystem), 4)} ${getUnitLabel("length", unitSystem)}`;
  const flen = (mm: number) =>
    `${formatSignificantFigures(fromBase(mm, "length", fastenerUnits), 4)} ${getUnitLabel("length", fastenerUnits)}`;
  const q = (value: number, quantity: UnitQuantity) =>
    `${formatSignificantFigures(fromBase(value, quantity, unitSystem), 4)} ${getUnitLabel(quantity, unitSystem)}`;
  const g = result.geometry;
  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-2 text-xs font-bold text-slate-600">
          Thread geometry{" "}
          <span className="font-normal text-slate-400">
            (from major diameter and pitch, {fastenerSystem === "metric" ? "ISO 724" : "ASME B1.1"})
          </span>
        </h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label="Major diameter (d)" value={flen(g.major)} />
          <Tile
            label={fastenerSystem === "metric" ? "Pitch (p)" : "Threads per inch (n)"}
            value={
              fastenerSystem === "metric"
                ? flen(g.pitch)
                : `${formatSignificantFigures(25.4 / g.pitch, 4)} TPI`
            }
          />
          <Tile label="Pitch diameter (d2)" value={flen(g.pitchDiameter)} />
          <Tile label="Minor diameter, bolt (d3)" value={flen(g.minorExternal)} />
          <Tile label="Minor diameter, nut / tapped hole (D1)" value={flen(g.minorInternal)} />
          <Tile label="Tensile stress area (At)" value={q(result.at, "area")} />
          <Tile label="Major-diameter area (Ad)" value={q(result.ad, "area")} />
          <Tile label="Thread engagement (Le)" value={flen(result.engagement)} />
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-xs font-bold text-slate-600">Grip and stiffness</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label="Clamped grip length" value={len(result.grip)} />
          <Tile label="Effective grip for stiffness" value={len(result.gripEffective)} />
          <Tile label="Bolt length" value={flen(model.values.boltLength)} />
          <Tile label="Thread length (LT)" value={flen(result.threadLength)} />
          <Tile label="Unthreaded in grip (ld)" value={len(result.unthreadedInGrip)} />
          <Tile label="Threaded in grip (lt)" value={len(result.threadedInGrip)} />
          <Tile label="Bolt stiffness (kb)" value={q(result.kb, "stiffness")} />
          <Tile label="Member stiffness (km)" value={q(result.km, "stiffness")} />
          <Tile label="Joint constant (C)" value={formatSignificantFigures(result.c, 3)} />
        </div>
      </div>
    </div>
  );
}

function PreloadTab({ result, unitSystem }: { result: BoltedJointResult; unitSystem: UnitSystem }) {
  const f = (value: number) =>
    `${formatSignificantFigures(fromBase(value, "kforce", unitSystem), 4)} ${getUnitLabel("kforce", unitSystem)}`;
  const cols = [result.cases.min, result.cases.nominal, result.cases.max];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Tile label="Proof load (Fp = Sp·At)" value={f(result.proofLoad)} />
        <Tile
          label="Nominal preload / proof load"
          value={`${formatSignificantFigures((result.nominalPreload / result.proofLoad) * 100, 3)} %`}
        />
        <Tile
          label="Torque for nominal preload (T = K·Fi·d)"
          value={`${formatSignificantFigures(fromBase(result.torque, "torque", unitSystem), 4)} ${getUnitLabel("torque", unitSystem)}`}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] overflow-hidden rounded-lg border border-slate-200 text-xs">
          <thead className="bg-slate-100 text-[10px] uppercase tracking-wider text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">Quantity</th>
              <th className="px-3 py-2 text-right">Minimum</th>
              <th className="px-3 py-2 text-right">Nominal</th>
              <th className="px-3 py-2 text-right">Maximum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white font-mono">
            <tr>
              <td className="px-3 py-2 font-sans text-slate-600">Preload Fi</td>
              {cols.map((c) => (
                <td key={c.label} className="px-3 py-2 text-right">
                  {f(c.preload)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-3 py-2 font-sans text-slate-600">Bolt force Fb = Fi + C·P</td>
              {cols.map((c) => (
                <td key={c.label} className="px-3 py-2 text-right">
                  {f(c.boltForce)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-3 py-2 font-sans text-slate-600">Clamp force Fm = Fi − (1−C)·P</td>
              {cols.map((c) => (
                <td key={c.label} className="px-3 py-2 text-right">
                  {f(c.clampForce)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-3 py-2 font-sans text-slate-600">Yield FOS</td>
              {cols.map((c) => (
                <td key={c.label} className="px-3 py-2 text-right">
                  {formatFos(c.yieldFos)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-3 py-2 font-sans text-slate-600">Separation FOS</td>
              {cols.map((c) => (
                <td key={c.label} className="px-3 py-2 text-right">
                  {formatFos(c.separationFos)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface DetailRow {
  symbol: string;
  label: string;
  value: string;
}

function DetailsTab({
  result,
  model,
  unitSystem,
  fastenerUnits,
  fastenerSystem,
  target,
}: {
  result: BoltedJointResult;
  model: Model;
  unitSystem: UnitSystem;
  fastenerUnits: UnitSystem;
  fastenerSystem: FastenerSystem;
  target: number;
}) {
  const n = (value: number, digits = 4) => formatSignificantFigures(value, digits);
  const q = (value: number, quantity: UnitQuantity) =>
    `${n(fromBase(value, quantity, unitSystem))} ${getUnitLabel(quantity, unitSystem)}`;
  const len = (mm: number) => q(mm, "length");
  const flen = (mm: number) =>
    `${n(fromBase(mm, "length", fastenerUnits))} ${getUnitLabel("length", fastenerUnits)}`;
  const fos = (value: number) => formatFos(value);
  const { min, nominal, max } = result.cases;
  const three = (fn: (c: typeof min) => string) => `${fn(min)}  |  ${fn(nominal)}  |  ${fn(max)}`;
  const g = result.geometry;
  const input = model.input;
  const isNut = input?.config === "bolt_nut";

  const sections: Array<{ title: string; rows: DetailRow[] }> = [
    {
      title: `Thread geometry (${fastenerSystem === "metric" ? "metric, ISO 724" : "imperial, ASME B1.1"})`,
      rows: [
        { symbol: "d", label: "Major (nominal) diameter", value: flen(g.major) },
        fastenerSystem === "metric"
          ? { symbol: "p", label: "Pitch", value: flen(g.pitch) }
          : { symbol: "n", label: "Threads per inch", value: `${n(25.4 / g.pitch)} TPI` },
        { symbol: "d2", label: "Pitch diameter", value: flen(g.pitchDiameter) },
        { symbol: "d3", label: "Minor diameter, external thread", value: flen(g.minorExternal) },
        { symbol: "D1", label: "Minor diameter, internal thread", value: flen(g.minorInternal) },
        { symbol: "At", label: "Tensile stress area", value: q(result.at, "area") },
        { symbol: "Ad", label: "Major-diameter area", value: q(result.ad, "area") },
      ],
    },
    {
      title: "Grip and stiffness",
      rows: [
        {
          symbol: "l",
          label: isNut
            ? "Grip length (plates + washers)"
            : "Clamped thickness h (plate 1 + washer)",
          value: len(result.grip),
        },
        {
          symbol: "leff",
          label: "Effective grip used for stiffness",
          value: len(result.gripEffective),
        },
        { symbol: "LT", label: "Thread length of bolt", value: flen(result.threadLength) },
        {
          symbol: "ld / lt",
          label: "Unthreaded / threaded length in grip",
          value: `${len(result.unthreadedInGrip)}  |  ${len(result.threadedInGrip)}`,
        },
        { symbol: "kb", label: "Bolt stiffness", value: q(result.kb, "stiffness") },
        { symbol: "km", label: "Member stiffness", value: q(result.km, "stiffness") },
        { symbol: "C", label: "Joint constant", value: n(result.c, 3) },
      ],
    },
    {
      title: "Preload  (minimum | nominal | maximum)",
      rows: [
        { symbol: "Fp", label: "Proof load", value: q(result.proofLoad, "kforce") },
        { symbol: "Fi", label: "Preload", value: three((c) => q(c.preload, "kforce")) },
        { symbol: "T", label: "Torque at nominal preload", value: q(result.torque, "torque") },
      ],
    },
    {
      title: "Bolt load and tensile yield  (minimum | nominal | maximum)",
      rows: [
        { symbol: "Fb", label: "Bolt force", value: three((c) => q(c.boltForce, "kforce")) },
        { symbol: "ny", label: "Yield FOS", value: three((c) => fos(c.yieldFos)) },
      ],
    },
    {
      title: "Joint separation  (minimum | nominal | maximum)",
      rows: [
        {
          symbol: "Fm",
          label: "Remaining clamp force",
          value: three((c) => q(c.clampForce, "kforce")),
        },
        { symbol: "n0", label: "Separation FOS", value: three((c) => fos(c.separationFos)) },
      ],
    },
    {
      title: "Thread stripping (at maximum bolt force)",
      rows: [
        { symbol: "Le", label: "Thread engagement", value: flen(result.engagement) },
        {
          symbol: "As,ext",
          label: "External (bolt) thread shear area",
          value: q(result.externalStripArea, "area"),
        },
        {
          symbol: "As,int",
          label: "Internal (nut / tapped) thread shear area",
          value: q(result.internalStripArea, "area"),
        },
        {
          symbol: "Fext / Fint",
          label: "Stripping capacity, external | internal",
          value: `${q(result.externalStripCapacity, "kforce")}  |  ${q(result.internalStripCapacity, "kforce")}`,
        },
        {
          symbol: "next / nint",
          label: "Stripping FOS, external | internal",
          value: `${fos(result.externalStripFos)}  |  ${fos(result.internalStripFos)}`,
        },
      ],
    },
    {
      title: "Pull-through and plate bearing",
      rows: [
        {
          symbol: "Fpt",
          label: "Pull-through capacity",
          value: q(result.pullThroughCapacity, "kforce"),
        },
        { symbol: "npt", label: "Pull-through FOS", value: fos(result.pullThroughFos) },
        {
          symbol: "Fbr",
          label: "Plate bearing capacity",
          value: q(result.bearingCapacity, "kforce"),
        },
        { symbol: "nbr", label: "Plate bearing FOS", value: fos(result.bearingFos) },
      ],
    },
    {
      title: "Shear, slip and combined loading",
      rows: [
        { symbol: "As", label: "Shear area", value: q(result.shearArea, "area") },
        { symbol: "nshear", label: "Bolt shear FOS", value: fos(result.boltShearFos) },
        { symbol: "nslip", label: "Slip FOS at minimum preload", value: fos(result.slipFos) },
        {
          symbol: "σvm",
          label: "von Mises stress at maximum bolt force",
          value: q(result.combinedStress, "kstress"),
        },
        {
          symbol: "n",
          label: "Combined tension + shear yield FOS",
          value: fos(result.combinedFos),
        },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-slate-400">
        Target FOS for pass status: {n(target, 3)}. Symbols are defined on the Theory &amp;
        References tab.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] overflow-hidden rounded-lg border border-slate-200 text-xs">
          <thead className="bg-slate-100 text-[10px] uppercase tracking-wider text-slate-600">
            <tr>
              <th className="w-28 px-3 py-2 text-left">Symbol</th>
              <th className="px-3 py-2 text-left">Quantity</th>
              <th className="px-3 py-2 text-right">Value</th>
            </tr>
          </thead>
          {sections.map((section) => (
            <tbody key={section.title} className="divide-y divide-slate-100 bg-white">
              <tr className="bg-slate-50">
                <td colSpan={3} className="px-3 py-1.5 text-[11px] font-bold text-slate-700">
                  {section.title}
                </td>
              </tr>
              {section.rows.map((row) => (
                <tr key={row.symbol + row.label}>
                  <td className="px-3 py-1.5 font-mono text-slate-500">{row.symbol}</td>
                  <td className="px-3 py-1.5 text-slate-700">{row.label}</td>
                  <td className="whitespace-pre px-3 py-1.5 text-right font-mono font-semibold text-slate-900">
                    {row.value}
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}
