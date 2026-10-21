// Bolt strength calculator page: independent fastener-system and display-unit toggles, live results,
// a dynamic joint diagram, and a detailed calculation section. The math lives in engineering/boltedJoint.ts.
import { useMemo, useState } from "react";
import { Card } from "../components/Card";
import { MetricTile } from "../components/MetricTile";
import { CalculatorPageShell } from "../components/CalculatorPageShell";
import { DiagramPanel } from "../components/DiagramPanel";
import { SelectInput } from "../components/Dropdown";
import { Equation } from "../components/Equation";
import { FastenerSelection } from "../components/FastenerSelection";
import { JointDiagram } from "../components/JointDiagram";
import { StatusBanner } from "../components/StatusBanner";
import { ReportExportActions } from "../components/ReportExportActions";
import { type PageTab } from "../components/SiteHeader";
import { UnitInput } from "../components/UnitInput";
import { useUnitSystem } from "../components/units/UnitContext";
import { TheoryNomenclature, TheoryPanel, TheoryReferences, TheorySection } from "../components/TheorySection";
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
import { createBoltedJointReportData, downloadWorkbook, getReportDiagramDataUrl, openPdfReport } from "../engineering/engineeringReport";

// ---------------------------------------------------------------------------------------------
// Form state. Everything is stored in SI base units (mm, N, MPa, N-mm); inputs convert for display.
// ---------------------------------------------------------------------------------------------

interface PlateForm {
  // A material ID selects database properties; custom fields are used only for custom materials.
  materialId: string;
  t: number | null;
  sy: number;
  su: number;
  e: number;
}

interface FormState {
  // Physical quantities use SI base units; dimensionless values remain unitless.
  fastenerSystem: FastenerSystem;
  series: ThreadSeries;
  sizeId: string;
  gradeId: string;
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

// Reset size-dependent dimensions whenever the selected fastener changes.
const NO_OVERRIDES = {
  washerOd: null,
  washerT: null,
  hole: null,
  engagement: null,
  boltLength: null,
} as const;

// Start with round display values in the active unit system, then store them in base units.
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

// Use database material properties unless the user selected a custom plate material.
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
  // Selected catalog objects and their derived properties for the current form values.
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

// Resolve standards-based defaults, build engineering inputs, and run the calculation.
function buildModel(f: FormState): Model {
  // Resolve bolt geometry and grade properties from the selected fastener system and thread series.
  const sizes = getSizes(f.fastenerSystem, f.series);
  const size = (sizes.find((s) => s.id === f.sizeId) ?? sizes[0]) as FastenerSize;
  const grades = getGrades(f.fastenerSystem);
  const grade = grades.find((g) => g.id === f.gradeId) ?? grades[0];
  const gp = grade ? grade.props(size.d) : { sp: 0, sy: 0, su: 0 };
  const p1 = resolvePlate(f.plate1);
  const p2 = resolvePlate(f.plate2);
  const isNut = f.config === "bolt_nut";

  // Standard dimensions can be overridden; disabled washers contribute no thickness to the stack.
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

  // Convert the selected tightening method into a preload scatter fraction.
  const scatterPreset = SCATTER_PRESETS.find((s) => s.id === f.scatterId);
  const scatter = !f.variation
    ? 0
    : f.scatterId === CUSTOM_SCATTER_ID
      ? (f.scatterCustom ?? 0) / 100
      : (scatterPreset?.fraction ?? 0);
  const nutPreset = NUT_FACTORS.find((n) => n.id === f.nutFactorId);
  const nutFactor = nutPreset ? nutPreset.k : (f.nutFactorCustom ?? 0);

  // Keep both automatic and effective values so the UI can label and reset overridden fields.
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

  // Return an input error before calling the engineering model when required values are missing.
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

  // Normalize calculation errors into page state so the result panels can show a useful message.
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
// Page-specific result components
// ---------------------------------------------------------------------------------------------

// Shared visual mapping for factor-of-safety status labels.
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

// Compact pass, warning, fail, or informational indicator.
function StatusPill({ status }: { status: FosStatus | "info" }) {
  return (
    <span
      className={`rounded px-2 py-0.5 text-[10px] font-bold tracking-wide ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// ---------------------------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------------------------

type TabId = "properties" | "preload" | "details";

export function BoltedJointPage() {
  const { unitSystem } = useUnitSystem();
  // Keep editable form values separate from the derived calculation model below.
  const [form, setForm] = useState<FormState>(() => initialForm(unitSystem));
  const [pageTab, setPageTab] = useState<PageTab>("calc");
  const [tab, setTab] = useState<TabId>("properties");
  const [resetKey, setResetKey] = useState(0);

  // Recompute automatic dimensions and results whenever a form value changes.
  const model = useMemo(() => buildModel(form), [form]);
  const { size, result } = model;
  const fastenerUnits: UnitSystem = form.fastenerSystem === "metric" ? "si" : "imperial";

  // Typed field updates keep the form model aligned with its declared field types.
  const update = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm((previous) => ({ ...previous, [field]: value }));
  const updatePlate = (which: "plate1" | "plate2", patch: Partial<PlateForm>) =>
    setForm((previous) => ({ ...previous, [which]: { ...previous[which], ...patch } }));

  // Changing the fastener system resets grade, thread series, and all size-specific overrides.
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

  // Use different units for fastener dimensions when the selected bolt system differs from the page toggle.
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
  const reportData = result && model.input ? createBoltedJointReportData(model.input, result, unitSystem, {
    fastenerLabel: size.label,
    gradeLabel: model.gradeLabel,
    targetFos: target,
  }) : null;

  // Render one plate's material and thickness fields, including custom strength inputs when needed.
  const plateFields = (which: "plate1" | "plate2", title: string) => {
    const plate = form[which];
    const material = findPlateMaterial(plate.materialId);
    return (
      <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
        <h3 className="text-xs font-bold text-slate-600">{title}</h3>
        <SelectInput
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
        </SelectInput>
        <UnitInput
          label="Thickness"
          quantity="length"
          value={plate.t}
          onChange={(value) => updatePlate(which, { t: value })}
          valueIsBase
          min={0.000001}
          step={unitSystem === "imperial" ? 0.0625 : 1}
        />
        {plate.materialId === CUSTOM_MATERIAL_ID ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <UnitInput
              label="Yield (Sy)"
              quantity="kstress"
              value={plate.sy}
              onChange={(value) => updatePlate(which, { sy: value ?? 0 })}
              valueIsBase
              min={0.000001}
            />
            <UnitInput
              label="Ultimate (Su)"
              quantity="kstress"
              value={plate.su}
              onChange={(value) => updatePlate(which, { su: value ?? 0 })}
              valueIsBase
              min={0.000001}
            />
            <UnitInput
              label="Modulus (E)"
              quantity="modulus"
              value={plate.e}
              onChange={(value) => updatePlate(which, { e: value ?? 0 })}
              valueIsBase
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
    <CalculatorPageShell
      icon="fa-solid fa-screwdriver-wrench"
      title="Bolt Strength Calculator"
      subtitle="Preloaded joint strength, separation, thread stripping and bearing"
      pageTab={pageTab}
      setPageTab={setPageTab}
      tabActions={pageTab === "calc" && reportData ? <ReportExportActions onPdfExport={() => openPdfReport(reportData, getReportDiagramDataUrl("bolted-joint"))} onExcelExport={async () => downloadWorkbook(reportData, await getReportDiagramDataUrl("bolted-joint"))} /> : null}
    >
      {pageTab === "calc" ? (
        <>
          {/* Main calculator content: joint inputs, diagram, and results. */}
          <p className="mb-5 text-sm text-slate-500">
            Analyze preloaded bolted joints using Shigley&apos;s method. The unit toggle sets how
            plate thickness, loads and stresses are displayed; the fastener system sets bolt sizes
            and thread series.
          </p>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Input cards for fastener selection, joint geometry, loads, and preload. */}
            <div key={resetKey} className="space-y-6 lg:col-span-7">
              {/* Fastener system, thread series, grade, size, and joint configuration. */}
              <Card title="Fastener & Joint Configuration" icon="fa-solid fa-screwdriver-wrench">
                <div className="space-y-4">
                  <FastenerSelection
                    fastenerSystem={form.fastenerSystem}
                    series={form.series}
                    sizeId={size.id}
                    onFastenerSystemChange={changeSystem}
                    onSeriesChange={changeSeries}
                    onSizeChange={(value) =>
                      setForm((previous) => ({ ...previous, sizeId: value, ...NO_OVERRIDES }))
                    }
                    gradeId={form.gradeId}
                    onGradeChange={(value) =>
                      setForm((previous) => ({ ...previous, gradeId: value, nutSu: null }))
                    }
                    config={form.config}
                    onConfigChange={(value) =>
                      setForm((previous) => ({
                        ...previous,
                        config: value,
                        engagement: null,
                        boltLength: null,
                      }))
                    }
                    showGrade
                    showJointConfiguration
                  />
                  <p className="rounded-lg bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-500">
                    {size.label} · d {fastLen(size.d)} · pitch {fastLen(size.pitch)} · At{" "}
                    {disp(size.at, "area", 4)} · Sp {disp(model.gp.sp, "kstress", 3)} · Sy{" "}
                    {disp(model.gp.sy, "kstress", 3)} · Su {disp(model.gp.su, "kstress", 3)}
                  </p>
                </div>
              </Card>

              {/* Plate materials, joint dimensions, washers, and clearance holes. */}
              <Card title="Joint Geometry" icon="fa-solid fa-layer-group">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {plateFields("plate1", "Plate 1 (under bolt head)")}
                    {plateFields("plate2", isNut ? "Plate 2 (nut side)" : "Plate 2 (tapped)")}
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <SelectInput
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
                    </SelectInput>
                    <SelectInput
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
                    </SelectInput>
                  </div>

                  <div>
                    <h3 className="mb-2 text-xs font-bold text-slate-600">
                      Fastener dimensions{" "}
                      <span className="font-normal text-slate-400">
                        (standard values; overwrite any field)
                      </span>
                    </h3>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <UnitInput
                        label="Hole diameter"
                        quantity="length"
                        unitSystem={fastenerUnits}
                        value={form.hole}
                        standardValue={model.auto.hole}
                        valueIsBase
                        showStandard
                        onChange={(value) => update("hole", value)}
                      />
                      {form.washerEnabled ? (
                        <UnitInput
                          label="Washer OD"
                          quantity="length"
                          unitSystem={fastenerUnits}
                          value={form.washerOd}
                          standardValue={model.auto.washerOd}
                          valueIsBase
                          showStandard
                          onChange={(value) => update("washerOd", value)}
                        />
                      ) : null}
                      {form.washerEnabled ? (
                        <UnitInput
                          label="Washer thickness"
                          quantity="length"
                          unitSystem={fastenerUnits}
                          value={form.washerT}
                          standardValue={model.auto.washerT}
                          valueIsBase
                          showStandard
                          onChange={(value) => update("washerT", value)}
                        />
                      ) : null}
                      <UnitInput
                        label={isNut ? "Thread engagement (nut)" : "Thread engagement"}
                        quantity="length"
                        unitSystem={fastenerUnits}
                        value={form.engagement}
                        standardValue={model.auto.engagement}
                        valueIsBase
                        showStandard
                        onChange={(value) => update("engagement", value)}
                      />
                      <UnitInput
                        label="Bolt length"
                        quantity="length"
                        unitSystem={fastenerUnits}
                        value={form.boltLength}
                        standardValue={model.auto.boltLength}
                        valueIsBase
                        showStandard
                        onChange={(value) => update("boltLength", value)}
                      />
                      {isNut ? (
                        <UnitInput
                          label="Nut ultimate strength"
                          quantity="kstress"
                          unitSystem={unitSystem}
                          value={form.nutSu}
                          standardValue={model.auto.nutSu}
                          valueIsBase
                          showStandard
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

              {/* Applied loading and preload method, including optional variation. */}
              <Card title="Loads & Preload" icon="fa-solid fa-arrows-down-to-line">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <UnitInput
                      label="External tensile load"
                      quantity="kforce"
                      value={form.tensile}
                      onChange={(value) => update("tensile", value)}
                      valueIsBase
                      min={0}
                      step={unitSystem === "imperial" ? 0.1 : 0.5}
                    />
                    <UnitInput
                      label="Shear load"
                      quantity="kforce"
                      value={form.shear}
                      onChange={(value) => update("shear", value)}
                      valueIsBase
                      min={0}
                      step={unitSystem === "imperial" ? 0.1 : 0.5}
                    />
                    <UnitInput
                      label="Required clamp force"
                      quantity="kforce"
                      value={form.requiredClamp}
                      onChange={(value) => update("requiredClamp", value)}
                      valueIsBase
                      min={0}
                      step={unitSystem === "imperial" ? 0.1 : 0.5}
                      description="0 = no requirement."
                    />
                    <UnitInput
                      label="Friction coefficient (μ)"
                      quantity="unitless"
                      value={form.mu}
                      onChange={(value) => update("mu", value)}
                      min={0}
                      step={0.01}
                      description="For slip resistance."
                    />
                  </div>
                  <SelectInput
                    label="Shear plane passes through"
                    value={form.shearPlane}
                    onChange={(value) => update("shearPlane", value as ShearPlane)}
                  >
                    <option value="threads">Threads (tensile stress area)</option>
                    <option value="shank">Unthreaded shank (full area)</option>
                  </SelectInput>

                  <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
                    <SelectInput
                      label="Preload type"
                      value={form.preloadMode}
                      onChange={(value) => update("preloadMode", value as PreloadMode)}
                    >
                      <option value="percent">Target preload (% of proof load)</option>
                      <option value="force">Specified preload force</option>
                      <option value="torque">Tightening torque</option>
                    </SelectInput>
                    {form.preloadMode === "percent" ? (
                      <UnitInput
                        label="Target preload"
                        quantity="unitless"
                        value={form.preloadPercent}
                        onChange={(value) => update("preloadPercent", value)}
                        suffix="%"
                        min={0}
                        step={5}
                        description="Typically 75 % (reusable) to 90 % (permanent)."
                      />
                    ) : form.preloadMode === "force" ? (
                      <UnitInput
                        label="Preload force"
                        quantity="kforce"
                        value={form.preloadForce}
                        onChange={(value) => update("preloadForce", value)}
                        valueIsBase
                        min={0.000001}
                        step={unitSystem === "imperial" ? 0.5 : 1}
                      />
                    ) : (
                      <UnitInput
                        label="Tightening torque"
                        quantity="torque"
                        value={form.preloadTorque}
                        onChange={(value) => update("preloadTorque", value)}
                        valueIsBase
                        min={0.000001}
                        step={10}
                      />
                    )}
                    <SelectInput
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
                    </SelectInput>
                    {form.nutFactorId === "custom" ? (
                      <UnitInput
                        label="Custom K"
                        quantity="unitless"
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
                        <SelectInput
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
                        </SelectInput>
                        {form.scatterId === CUSTOM_SCATTER_ID ? (
                          <UnitInput
                            label="Variation (±)"
                            quantity="unitless"
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

            {/* Joint visualization and strength check results. */}
            <div className="space-y-6 lg:col-span-5">
              <DiagramPanel title="Joint Diagram">
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
              </DiagramPanel>

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

          {/* Detailed geometry, preload, and calculation result tabs. */}
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
            Results are for preliminary estimation. Verify against the governing code, data sheets
            and engineering judgment before using them in a final design.
          </p>
        </>
      ) : (
        <>
          {/* Theory tab with methodology and references. */}
          <Theory />
        </>
      )}
    </CalculatorPageShell>
  );
}

// ---------------------------------------------------------------------------------------------
// Theory and references
// ---------------------------------------------------------------------------------------------

const theoryNomenclature: Array<[string, string]> = [
  [String.raw`d, D`, "Major (nominal) thread diameter"],
  [String.raw`p, n`, "Metric pitch; imperial threads per inch, with p = 1/n"],
  [String.raw`d_2, E`, "Thread pitch diameter"],
  [String.raw`d_3, d_r`, "External thread minor (root) diameter"],
  [String.raw`D_1`, "Internal thread minor diameter"],
  [String.raw`A_t, A_d`, "Tensile stress area; major-diameter shank area"],
  [String.raw`S_p, S_y, S_u`, "Bolt proof, yield and ultimate strength"],
  [String.raw`E_b, E_i`, "Bolt modulus; modulus of member layer i"],
  [String.raw`t_1, t_2, t_w`, "Plate 1, plate 2 and washer thickness"],
  [String.raw`l, l_{eff}`, "Grip length; effective grip used for stiffness"],
  [String.raw`L, L_T`, "Bolt length under the head; threaded length"],
  [String.raw`l_d, l_t`, "Unthreaded and threaded bolt length within the grip"],
  [String.raw`k_b, k_m, C`, "Bolt stiffness, member stiffness and joint constant"],
  [String.raw`F_p, F_i`, "Proof load; preload"],
  [String.raw`P, V`, "External tensile load; shear load on the bolt"],
  [String.raw`F_b, F_m`, "Bolt force; remaining clamp force"],
  [String.raw`K, T`, "Nut factor; tightening torque"],
  [String.raw`s`, "Preload variation as a fraction of nominal preload"],
  [String.raw`L_e`, "Thread engagement length"],
  [String.raw`D_w`, "Bearing diameter under head or nut"],
  [String.raw`\mu`, "Friction coefficient for slip resistance"],
];

const boltedJointReferences: Array<[string, string]> = [
  ["Shigley's Mechanical Engineering Design (Budynas & Nisbett), Chapter 8", "Bolt and member stiffness, joint constant, preload, separation and proof-strength checks; Tables 8-9 (SAE grades), 8-11 (ISO classes) and 8-15 (torque coefficients)."],
  ["ISO 724 and ISO 261", "Metric thread basic dimensions: pitch, pitch diameter and minor diameters."],
  ["ISO 898-1", "Mechanical properties of carbon and alloy steel bolts, classes 4.6 to 12.9, and the metric tensile stress area."],
  ["ASME B1.1", "Unified inch screw threads, UNC and UNF: basic dimensions and tensile stress area."],
  ["SAE J429; ASTM F3125 (A325, A490)", "Inch bolt grades with size-dependent proof, yield and tensile strength."],
  ["ISO 273, ISO 7089, ISO 4032, ISO 4017", "Metric clearance holes, plain washers, hex nuts and hex bolts."],
  ["ASME B18.2.1, B18.2.2, B18.22.1", "Inch hex bolts, hex nuts and flat washers."],
  ["Machinery's Handbook (Industrial Press)", "Unified and metric thread dimensions, and thread-stripping shear area equations."],
  ["Bickford, An Introduction to the Design and Behavior of Bolted Joints", "Preload scatter by tightening method, nut factors and thread-stripping behavior."],
  ["VDI 2230 Part 1", "Systematic calculation of highly stressed bolted joints. A cross-reference only; its procedure is not implemented here."],
  ["CSA G40.21; ASTM A36, A572, A514 / A709-100; SSAB Quard data sheets", "Plate material strengths used in the material list."],
];

const theoryEquation = (expression: string) => <Equation expression={expression} />;

function Theory() {
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

          <TheorySection title="1. Thread geometry from major diameter and pitch" description="Both systems use the same 60° thread profile, so the pitch diameter and the internal minor diameter are identical in form. The formulas differ in how the root of the external thread is taken, which changes the tensile stress area. Every diameter and the stress area follow from the major diameter and the pitch alone.">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <TheoryPanel label="Metric — ISO 724, ISO 898-1 (pitch p, mm)">
                {theoryEquation(String.raw`d_2 = d - 0.649519\,p`)}
                {theoryEquation(String.raw`d_3 = d - 1.226869\,p`)}
                {theoryEquation(String.raw`D_1 = d - 1.082532\,p`)}
                {theoryEquation(String.raw`A_t = \frac{\pi}{4}\left(\frac{d_2 + d_3}{2}\right)^2 = \frac{\pi}{4}\left(d - 0.938194\,p\right)^2`)}
              </TheoryPanel>
              <TheoryPanel label="Imperial — ASME B1.1, UNC / UNF (n threads per inch)">
                {theoryEquation(String.raw`p = \frac{1}{n}`)}
                {theoryEquation(String.raw`E = D - \frac{0.649519}{n}`)}
                {theoryEquation(String.raw`d_r = D - \frac{1.299038}{n}`)}
                {theoryEquation(String.raw`D_1 = D - \frac{1.082532}{n}`)}
                {theoryEquation(String.raw`A_t = \frac{\pi}{4}\left(\frac{E + d_r}{2}\right)^2 = 0.7854\left(D - \frac{0.9743}{n}\right)^2`)}
              </TheoryPanel>
            </div>
            <TheoryPanel label="Both systems">{theoryEquation(String.raw`A_d = \frac{\pi d^2}{4}`)}</TheoryPanel>
          </TheorySection>

          <TheorySection title="2. Thread length of the bolt" description="Standard thread length for hex bolts, used to split the grip into unthreaded and threaded parts.">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <TheoryPanel label="Metric (mm)">{theoryEquation(String.raw`L_T = \begin{cases} 2d + 6 & L \le 125 \\ 2d + 12 & 125 < L \le 200 \\ 2d + 25 & L > 200 \end{cases}`)}</TheoryPanel>
              <TheoryPanel label="Imperial (in)">{theoryEquation(String.raw`L_T = \begin{cases} 2D + \tfrac{1}{4} & L \le 6 \\ 2D + \tfrac{1}{2} & L > 6 \end{cases}`)}</TheoryPanel>
            </div>
          </TheorySection>

          <TheorySection title="3. Grip, bolt stiffness and member stiffness" description="For a bolt and nut the grip is the full stack. For a tapped hole Shigley's effective grip adds half the tapped plate thickness, limited to d/2.">
            <TheoryPanel label="Grip length">
              {theoryEquation(String.raw`l = t_1 + t_2 + 2\,t_w \quad (\text{bolt + nut})`)}
              {theoryEquation(String.raw`h = t_1 + t_w, \qquad l_{eff} = \begin{cases} h + t_2/2 & t_2 < d \\ h + d/2 & t_2 \ge d \end{cases} \quad (\text{tapped hole})`)}
              {theoryEquation(String.raw`l_d = \min\!\big(\max(L - L_T,\,0),\,l\big), \qquad l_t = l - l_d`)}
            </TheoryPanel>
            <TheoryPanel label="Bolt stiffness (Shigley, Ch. 8)">{theoryEquation(String.raw`k_b = \frac{A_d\,A_t\,E_b}{A_d\,l_t + A_t\,l_d}`)}</TheoryPanel>
            <TheoryPanel label="Member stiffness (frustum method, 30° half-angle)">
              {theoryEquation(String.raw`k_i = \frac{0.5774\,\pi\,E_i\,d}{\ln\dfrac{\left(1.155\,t_i + D - d\right)\left(D + d\right)}{\left(1.155\,t_i + D + d\right)\left(D - d\right)}}`)}
              {theoryEquation(String.raw`k_m = \left(\sum_i \frac{1}{k_i}\right)^{-1}`)}
            </TheoryPanel>
            <p className="text-xs leading-relaxed text-slate-600">
              Two opposing pressure cones start at the head and nut bearing diameters D<sub>w</sub> and meet at mid-grip. The cones are cut at each plate and washer
              boundary, so each layer is one frustum with its own modulus E<sub>i</sub>, and D is the cone diameter at the narrow end of that frustum (D<sub>w</sub> + 1.155·z at depth z).
              Frustum stiffnesses add in series, which handles dissimilar plates and washers.
            </p>
            <TheoryPanel label="Joint constant">{theoryEquation(String.raw`C = \frac{k_b}{k_b + k_m}`)}</TheoryPanel>
          </TheorySection>

          <TheorySection title="4. Preload" description="Target preload as a percentage of proof load (Shigley suggests 75% for reusable and 90% for permanent joints), a specified force, or a tightening torque with nut factor K. Min and max preload apply the selected variation s.">
            <TheoryPanel>
              {theoryEquation(String.raw`F_p = S_p\,A_t`)}
              {theoryEquation(String.raw`F_i = \frac{\%}{100}\,F_p \quad\text{or}\quad F_i = \frac{T}{K\,d}`)}
              {theoryEquation(String.raw`T = K\,F_i\,d`)}
              {theoryEquation(String.raw`F_{i,\min} = (1 - s)\,F_i, \qquad F_{i,\max} = (1 + s)\,F_i`)}
            </TheoryPanel>
          </TheorySection>

          <TheorySection title="5. Bolt load and tensile yield"><TheoryPanel>
            {theoryEquation(String.raw`F_b = F_i + C\,P`)}
            {theoryEquation(String.raw`n_y = \frac{S_y\,A_t}{F_b}`)}
          </TheoryPanel></TheorySection>
          <TheorySection title="6. Joint separation"><TheoryPanel>
            {theoryEquation(String.raw`F_m = F_i - (1 - C)\,P`)}
            {theoryEquation(String.raw`n_0 = \frac{F_i}{(1 - C)\,P}`)}
          </TheoryPanel></TheorySection>

          <TheorySection title="7. Thread stripping" description="Shear areas of the engaged threads from the basic thread profile (Machinery's Handbook). The thread density is n = 1/p for metric threads and n = threads per inch for imperial threads, so the same expressions apply to both. Shear strength is taken as 0.6 times the ultimate strength of the weaker material, and the check uses the maximum bolt force.">
            <TheoryPanel>
              {theoryEquation(String.raw`A_{s,ext} = \pi\,n\,L_e\,D_1\left[\frac{1}{2n} + 0.57735\,(d_2 - D_1)\right]`)}
              {theoryEquation(String.raw`A_{s,int} = \pi\,n\,L_e\,d\left[\frac{1}{2n} + 0.57735\,(d - d_2)\right]`)}
              {theoryEquation(String.raw`F_{strip} = 0.6\,S_u\,A_s, \qquad n_{strip} = \frac{F_{strip}}{F_{b,\max}}`)}
            </TheoryPanel>
            <p className="text-xs leading-relaxed text-slate-600">
              The external thread uses the bolt S<sub>u</sub>. The internal thread uses the nut S<sub>u</sub> (matched to the bolt unless overwritten) or, for a tapped hole, the S<sub>u</sub> of plate 2.
              For a tapped hole the default engagement is the length that lets the internal threads carry the full bolt strength, limited to between 1d and 3d and to the plate thickness:
            </p>
            <TheoryPanel>{theoryEquation(String.raw`L_{e,req} = \frac{S_{u,bolt}\,A_t}{0.6\,S_{u,int}\,A_{s,int}/L_e}`)}</TheoryPanel>
          </TheorySection>

          <TheorySection title="8. Pull-through and plate bearing" description="Pull-through is the shear of a plug the size of the washer (or head / nut across flats) through the plate. Bearing compares the shear load with the yield bearing strength of the weaker plate.">
            <TheoryPanel>
              {theoryEquation(String.raw`F_{pt} = 0.6\,S_u\,\pi\,D_w\,t, \qquad n_{pt} = \frac{F_{pt}}{F_{b,\max}}`)}
              {theoryEquation(String.raw`F_{br} = S_y\,d\,t, \qquad n_{br} = \frac{F_{br}}{V}`)}
            </TheoryPanel>
          </TheorySection>

          <TheorySection title="9. Shear, slip and combined loading" description="The shear area A_s is A_t when the shear plane passes through the threads and A_d through the unthreaded shank. Slip uses the clamp force remaining at minimum preload. The combined check uses the von Mises stress at maximum bolt force.">
            <TheoryPanel>
              {theoryEquation(String.raw`n_{shear} = \frac{0.577\,S_y\,A_s}{V}`)}
              {theoryEquation(String.raw`n_{slip} = \frac{\mu\,F_{m,\min}}{V}`)}
              {theoryEquation(String.raw`\sigma_{vm} = \sqrt{\left(\frac{F_{b,\max}}{A_t}\right)^2 + 3\left(\frac{V}{A_s}\right)^2}, \qquad n = \frac{S_y}{\sigma_{vm}}`)}
            </TheoryPanel>
          </TheorySection>

          <TheorySection title="10. Bolt strength properties">
            <p className="text-xs leading-relaxed text-slate-600">
              Metric property classes a.b follow ISO 898-1: nominal ultimate strength is 100·a MPa and nominal yield strength is 10·a·b MPa (class 10.9: 1000 and 900 MPa).
              The calculator uses the minimum proof, yield and ultimate values tabulated in Shigley Table 8-11. Inch grades use Shigley Table 8-9 (SAE J429) and
              ASTM F3125 (A325, A490), with the size breaks those standards define, for example Grade 5 above 1 in.
            </p>
          </TheorySection>

          <TheorySection title="Nomenclature"><TheoryNomenclature entries={theoryNomenclature} /></TheorySection>
          <TheorySection title="Assumptions and limits">
            <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-600">
              <li>One bolt in single shear, static loading only. Bolt patterns and fatigue are not included.</li>
              <li>The external tensile load acts along the bolt axis and is split between bolt and members by C.</li>
              <li>Yield checks use S<sub>y</sub>·A<sub>t</sub>. Residual torsion from tightening is neglected.</li>
              <li>Thread-strip areas use basic (nominal) thread dimensions, not tolerance limits.</li>
              <li>Quard 400 and 450 strengths are typical values; yield is not guaranteed in the supplier data sheet.</li>
            </ul>
          </TheorySection>
          <TheorySection title="References"><TheoryReferences entries={boltedJointReferences} /></TheorySection>
        </div>
      </Card>
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

// Choose the governing factor-of-safety check and display every check with its status.
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

  // Keep the rows in display order; the governing result is calculated separately below.
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

  // The governing check is the smallest finite FOS; clamp force is reported as a pass/fail check.
  const governing = rows.reduce<ResultRow | null>(
    (best, row) =>
      row.fos !== undefined &&
        Number.isFinite(row.fos) &&
        (best === null || (best.fos ?? Infinity) > row.fos)
        ? row
        : best,
    null,
  );
  return (
    <div className="space-y-4">
      <StatusBanner
        FOS={governing?.fos ?? 0}
        minimumFos={target}
        rightTitle="Critical FOS"
        rightText={governing?.label ?? "No loads applied"}
        system={unitSystem}
      />

      <div className="flex items-end justify-between gap-3">
        <p className="text-[11px] text-slate-400">
          Pass at or above the target FOS, warning between 1.0 and the target, fail below 1.0.
        </p>
        <div className="w-28 shrink-0">
          <UnitInput
            label="Target FOS"
            quantity="unitless"
            value={form.targetFos}
            onChange={onTarget}
            min={1}
            step={0.1}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table min-w-[360px] text-left">
          <thead className="data-table-header">
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
  // Format lengths in page units, while thread dimensions follow the selected fastener system.
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
          <MetricTile label="Major diameter (d)" value={flen(g.major)} />
          <MetricTile
            label={fastenerSystem === "metric" ? "Pitch (p)" : "Threads per inch (n)"}
            value={
              fastenerSystem === "metric"
                ? flen(g.pitch)
                : `${formatSignificantFigures(25.4 / g.pitch, 4)} TPI`
            }
          />
          <MetricTile label="Pitch diameter (d2)" value={flen(g.pitchDiameter)} />
          <MetricTile label="Minor diameter, bolt (d3)" value={flen(g.minorExternal)} />
          <MetricTile label="Minor diameter, nut / tapped hole (D1)" value={flen(g.minorInternal)} />
          <MetricTile label="Tensile stress area (At)" value={q(result.at, "area")} />
          <MetricTile label="Major-diameter area (Ad)" value={q(result.ad, "area")} />
          <MetricTile label="Thread engagement (Le)" value={flen(result.engagement)} />
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-xs font-bold text-slate-600">Grip and stiffness</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricTile label="Clamped grip length" value={len(result.grip)} />
          <MetricTile label="Effective grip for stiffness" value={len(result.gripEffective)} />
          <MetricTile label="Bolt length" value={flen(model.values.boltLength)} />
          <MetricTile label="Thread length (LT)" value={flen(result.threadLength)} />
          <MetricTile label="Unthreaded in grip (ld)" value={len(result.unthreadedInGrip)} />
          <MetricTile label="Threaded in grip (lt)" value={len(result.threadedInGrip)} />
          <MetricTile label="Bolt stiffness (kb)" value={q(result.kb, "stiffness")} />
          <MetricTile label="Member stiffness (km)" value={q(result.km, "stiffness")} />
          <MetricTile label="Joint constant (C)" value={formatSignificantFigures(result.c, 3)} />
        </div>
      </div>
    </div>
  );
}

function PreloadTab({ result, unitSystem }: { result: BoltedJointResult; unitSystem: UnitSystem }) {
  // Show nominal preload alongside the min/nominal/max values used for variation checks.
  const f = (value: number) =>
    `${formatSignificantFigures(fromBase(value, "kforce", unitSystem), 4)} ${getUnitLabel("kforce", unitSystem)}`;
  const cols = [result.cases.min, result.cases.nominal, result.cases.max];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <MetricTile label="Proof load (Fp = Sp·At)" value={f(result.proofLoad)} />
        <MetricTile
          label="Nominal preload / proof load"
          value={`${formatSignificantFigures((result.nominalPreload / result.proofLoad) * 100, 3)} %`}
        />
        <MetricTile
          label="Torque for nominal preload (T = K·Fi·d)"
          value={`${formatSignificantFigures(fromBase(result.torque, "torque", unitSystem), 4)} ${getUnitLabel("torque", unitSystem)}`}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="data-table min-w-[420px]">
          <thead className="data-table-header">
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

// Assemble the full calculation trace into labeled sections for the detailed-results tab.
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

  // Each section lists the quantities and intermediate results used by the engineering model.
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
        <table className="data-table min-w-[560px]">
          <thead className="data-table-header">
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
