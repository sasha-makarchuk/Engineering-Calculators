// // Bolt group shear calculator page: bolt coordinates or generated patterns, per-bolt sizes, applied
// // forces and moment, and the resulting shear force on each bolt. The math lives in engineering/boltGroup.ts.
// import { useId, useMemo, useRef, useState, type ReactNode } from "react";
// import {
//     BoltGroupDiagram,
//     type DiagramBolt,
//     type DiagramForce,
// } from "../components/BoltGroupDiagram";
// import { Card } from "../components/Card";
// import { SiteHeader, type PageTab } from "../components/SiteHeader";
// import { UnitInput } from "../components/UnitInput";
// import { UnitToggle } from "../components/UnitToggle";
// import { useUnitSystem } from "../components/units/UnitContext";
// import { FASTENER_SIZES, type FastenerSize } from "../data/fasteners";
// import {
//     MAX_BOLTS,
//     calculateBoltGroup,
//     circlePattern,
//     linePattern,
//     rectanglePattern,
//     type BoltGroupResult,
//     type GroupBolt,
//     type Point,
// } from "../engineering/boltGroup";
// import {
//     formatSignificantFigures,
//     fromBase,
//     getUnitLabel,
//     toBase,
//     type UnitQuantity,
//     type UnitSystem,
// } from "../engineering/units";
// import { BoltGroupTheory } from "./BoltGroupTheory";

// // ---------------------------------------------------------------------------------------------
// // Form state. Everything is stored in SI base units (mm, N, N-mm); inputs convert for display.
// // ---------------------------------------------------------------------------------------------

// type PatternKind = "rectangle" | "line" | "circle" | "custom";
// type Weighting = "tensile" | "shank";

// interface BoltRow {
//     id: number;
//     sizeId: string;
//     x: number | null;
//     y: number | null;
// }

// interface ForceRow {
//     id: number;
//     fx: number | null;
//     fy: number | null;
//     x: number | null;
//     y: number | null;
// }

// interface FormState {
//     pattern: PatternKind;
//     cols: number | null;
//     rows: number | null;
//     dx: number | null;
//     dy: number | null;
//     perimeterOnly: boolean;
//     count: number | null;
//     spacing: number | null;
//     angle: number | null;
//     diameter: number | null;
//     startAngle: number | null;
//     cx: number | null;
//     cy: number | null;
//     commonOnly: boolean;
//     weighting: Weighting;
//     bolts: BoltRow[];
//     forces: ForceRow[];
//     moment: number | null;
// }

// const DEFAULT_SIZE: Record<UnitSystem, string> = { si: "M12x1.75", imperial: "1/2-13UNC" };

// // Start with round numbers in whichever display system is active when the page opens.
// function initialForm(system: UnitSystem): { form: FormState; nextId: number } {
//     const imperial = system === "imperial";
//     const len = (mm: number, inches: number) => toBase(imperial ? inches : mm, "length", system);
//     const force = (kn: number, kip: number) => toBase(imperial ? kip : kn, "kforce", system);
//     const sizeId = DEFAULT_SIZE[system];
//     const points = rectanglePattern({
//         cols: 3,
//         rows: 2,
//         dx: len(100, 4),
//         dy: len(100, 4),
//         cx: len(100, 4),
//         cy: len(50, 2),
//         perimeterOnly: false,
//     });
//     const form: FormState = {
//         pattern: "rectangle",
//         cols: 3,
//         rows: 2,
//         dx: len(100, 4),
//         dy: len(100, 4),
//         perimeterOnly: false,
//         count: 6,
//         spacing: len(100, 4),
//         angle: 0,
//         diameter: len(200, 8),
//         startAngle: 0,
//         cx: len(100, 4),
//         cy: len(50, 2),
//         commonOnly: false,
//         weighting: "tensile",
//         bolts: points.map((p, i) => ({ id: i + 1, sizeId, x: p.x, y: p.y })),
//         forces: [{ id: 1, fx: 0, fy: -force(12, 3), x: len(250, 10), y: len(50, 2) }],
//         moment: 0,
//     };
//     return { form, nextId: points.length + 2 };
// }

// // ---------------------------------------------------------------------------------------------
// // Model: turn form state into engineering input and results.
// // ---------------------------------------------------------------------------------------------

// interface Model {
//     result: BoltGroupResult | null;
//     error: string | null;
//     sizes: FastenerSize[];
//     diagramBolts: DiagramBolt[];
//     diagramForces: DiagramForce[];
// }

// function sizeById(id: string): FastenerSize | undefined {
//     return FASTENER_SIZES.find((size) => size.id === id);
// }

// function buildModel(form: FormState): Model {
//     const empty = { result: null, sizes: [], diagramBolts: [], diagramForces: [] };
//     const sizes: FastenerSize[] = [];
//     const bolts: GroupBolt[] = [];
//     for (const row of form.bolts) {
//         const size = sizeById(row.sizeId);
//         if (!size) return { ...empty, error: "Select a size for every bolt." };
//         if (row.x === null || row.y === null)
//             return { ...empty, error: "Enter x and y for every bolt." };
//         sizes.push(size);
//         bolts.push({
//             x: row.x,
//             y: row.y,
//             area: form.weighting === "tensile" ? size.at : (Math.PI * size.d * size.d) / 4,
//         });
//     }
//     const forces = form.forces.map((row) => ({
//         fx: row.fx ?? 0,
//         fy: row.fy ?? 0,
//         x: row.x ?? 0,
//         y: row.y ?? 0,
//     }));
//     try {
//         const result = calculateBoltGroup({ bolts, forces, moment: form.moment ?? 0 });
//         return {
//             result,
//             error: null,
//             sizes,
//             diagramBolts: result.bolts.map((bolt, i) => ({
//                 index: bolt.index,
//                 x: bolt.x,
//                 y: bolt.y,
//                 d: sizes[i]?.d ?? 1,
//                 fx: bolt.fx,
//                 fy: bolt.fy,
//                 ratio: bolt.ratio,
//                 isMax: bolt.isMax,
//             })),
//             diagramForces: forces,
//         };
//     } catch (error) {
//         return { ...empty, error: error instanceof Error ? error.message : "Unable to calculate." };
//     }
// }

// // ---------------------------------------------------------------------------------------------
// // Small form components
// // ---------------------------------------------------------------------------------------------
// //Make standard component
// function SelectField({
//     label,
//     value,
//     onChange,
//     children,
// }: {
//     label: string;
//     value: string;
//     onChange: (value: string) => void;
//     children: ReactNode;
// }) {
//     const id = useId();
//     return (
//         <div>
//         <label htmlFor= { id } className = "label-input" >
//         { label }
//             </label>
//             < select
//     id = { id }
//     value = { value }
//     onChange = {(event) => onChange(event.target.value)
// }
// className = "box-input pr-3 font-sans"
//     >
// { children }
//     </select>
//     </div>
//   );
// }

// // Plain numeric field (counts, angles) that keeps what the user typed while editing.

// function NumberField({
//     label,
//     value,
//     onChange,
//     step,
//     min,
// }: {
//     label: string;
//     value: number | null;
//     onChange: (value: number | null) => void;
//     step?: number;
//     min?: number;
// }) {
//     const id = useId();
//     const [text, setText] = useState<string | null>(null);
//     const shown = text ?? (value === null ? "" : formatSignificantFigures(value, 6));
//     return (
//         <div>
//         <label htmlFor= { id } className = "label-input" >
//         { label }
//             </label>
//             < input
//     id = { id }
//     type = "number"
//     inputMode = "decimal"
//     value = { shown }
//     step = { step }
//     min = { min }
//     onChange = {(event) => {
//         const raw = event.target.value;
//         setText(raw);
//         if (raw === "") {
//             onChange(null);
//             return;
//         }
//         const parsed = Number(raw);
//         onChange(Number.isFinite(parsed) ? parsed : null);
//     }
// }
// onBlur = {() => setText(null)}
// className = "box-input"
//     />
//     </div>
//   );
// }

// // UnitInput wrapper that stores values in SI base units and converts to the active display system.
// function BaseUnitInput({
//     label,
//     quantity,
//     base,
//     onBase,
//     steps,
//     min,
// }: {
//     label: string;
//     quantity: UnitQuantity;
//     base: number | null;
//     onBase: (value: number | null) => void;
//     steps?: [number, number];
//     min?: number;
// }) {
//     const { unitSystem } = useUnitSystem();
//     return (
//         <UnitInput
//       label= { label }
//     quantity = { quantity }
//     value = { base === null ? null : fromBase(base, quantity, unitSystem)
// }
// onChange = {(value) => onBase(value === null ? null : toBase(value, quantity, unitSystem))}
// step = { steps?(unitSystem === "imperial" ? steps[1] : steps[0]) : undefined}
// min = { min }
//     />
//   );
// }

// // Compact table-cell input with no label; converts between SI base units and the display system.
// function CellInput({
//     label,
//     quantity,
//     base,
//     onBase,
// }: {
//     label: string;
//     quantity: UnitQuantity;
//     base: number | null;
//     onBase: (value: number | null) => void;
// }) {
//     const { unitSystem } = useUnitSystem();
//     const [text, setText] = useState<string | null>(null);
//     const shown =
//         text ??
//         (base === null ? "" : formatSignificantFigures(fromBase(base, quantity, unitSystem), 6));
//     return (
//         <input
//       type= "number"
//     inputMode = "decimal"
//     aria-label={ label }
//     value = { shown }
//     onChange = {(event) => {
//         const raw = event.target.value;
//         setText(raw);
//         if (raw === "") {
//             onBase(null);
//             return;
//         }
//         const parsed = Number(raw);
//         if (Number.isFinite(parsed)) onBase(toBase(parsed, quantity, unitSystem));
//     }
// }
// onBlur = {() => setText(null)}
// className = "box-input w-24 px-2 py-1 text-right font-mono text-xs"
//     />
//   );
// }

// const SIZE_GROUPS: Array<{
//     label: string;
//     system: FastenerSize["system"];
//     series: FastenerSize["series"];
// }> = [
//         { label: "Metric, coarse", system: "metric", series: "coarse" },
//         { label: "Metric, fine", system: "metric", series: "fine" },
//         { label: "Imperial, UNC", system: "imperial", series: "coarse" },
//         { label: "Imperial, UNF", system: "imperial", series: "fine" },
//     ];

// // Grouped size options; common sizes are starred and can be filtered. The current size always stays listed.
// function SizeOptions({ commonOnly, current }: { commonOnly: boolean; current: string }) {
//     return (
//         <>
//         {
//             SIZE_GROUPS.map((group) => {
//                 const sizes = FASTENER_SIZES.filter(
//                     (size) =>
//                         size.system === group.system &&
//                         size.series === group.series &&
//                         (!commonOnly || size.common || size.id === current),
//                 );
//                 if (sizes.length === 0) return null;
//                 return (
//                     <optgroup key= { group.label } label = { group.label } >
//                     {
//                         sizes.map((size) => (
//                             <option key= { size.id } value = { size.id } >
//                             { size.common ? "★ " : "" }
//                 { size.label }
//                             </option>
//                         ))
//         }
//         </optgroup>
//     );
// })}
// </>
//   );
// }

// function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
//     return (
//         <div className= "rounded-lg border border-slate-200 bg-slate-50 p-3" >
//         <div className="text-[11px] text-slate-500" > { label } </div>
//             < div className = "mt-0.5 font-mono text-sm font-bold text-slate-900" > { value } </div>
//     { sub ? <div className="mt-0.5 text-[11px] text-slate-500" > { sub } </div> : null }
//     </div>
//   );
// }

// // ---------------------------------------------------------------------------------------------
// // Page
// // ---------------------------------------------------------------------------------------------

// export function BoltGroupPage() {
//     const { unitSystem } = useUnitSystem();
//     const [initial] = useState(() => initialForm(unitSystem));
//     const [form, setForm] = useState<FormState>(initial.form);
//     const nextId = useRef(initial.nextId);
//     const [pageTab, setPageTab] = useState<PageTab>("calc");
//     const [patternError, setPatternError] = useState<string | null>(null);
//     const [hover, setHover] = useState<number | null>(null);
//     const [copied, setCopied] = useState(false);

//     const model = useMemo(() => buildModel(form), [form]);
//     const { result } = model;

//     const set = <K extends keyof FormState>(field: K, value: FormState[K]) =>
//         setForm((previous) => ({ ...previous, [field]: value }));
//     const updateBolt = (id: number, patch: Partial<BoltRow>) =>
//         setForm((previous) => ({
//             ...previous,
//             bolts: previous.bolts.map((row) => (row.id === id ? { ...row, ...patch } : row)),
//         }));
//     const updateForce = (id: number, patch: Partial<ForceRow>) =>
//         setForm((previous) => ({
//             ...previous,
//             forces: previous.forces.map((row) => (row.id === id ? { ...row, ...patch } : row)),
//         }));

//     const currentSize = form.bolts[form.bolts.length - 1]?.sizeId ?? DEFAULT_SIZE[unitSystem];
//     const allSame =
//         form.bolts.length > 0 && form.bolts.every((row) => row.sizeId === form.bolts[0]?.sizeId);

//     const generate = () => {
//         try {
//             let points: Point[] = [];
//             if (form.pattern === "rectangle") {
//                 points =
//                     ({
//                     cols: form.cols,
//                     rows: form.rows,
//                     dx: form.dx,
//                     dy: form.dy,
//                     cx: form.cx,
//                     cy: form.cy,
//                     perimeterOnly: form.perimeterOnly,
//                 });
//             } else if (form.pattern === "line") {
//                 points = linePattern({
//                     count: form.count,
//                     spacing: form.spacing,
//                     angleDeg: form.angle,
//                     cx: form.cx,
//                     cy: form.cy,
//                 });
//             } else if (form.pattern === "circle") {
//                 points = circlePattern({
//                     count: form.count,
//                     diameter: form.diameter,
//                     startAngleDeg: form.startAngle,
//                     cx: form.cx,
//                     cy: form.cy,
//                 });
//             }
//             const sizeId = form.bolts[0]?.sizeId ?? DEFAULT_SIZE[unitSystem];
//             const rows = points.map((p) => ({ id: nextId.current++, sizeId, x: p.x, y: p.y }));
//             setPatternError(null);
//             set("bolts", rows);
//         } catch (error) {
//             setPatternError(error instanceof Error ? error.message : "Unable to generate the pattern.");
//         }
//     };

//     const addBolt = () => {
//         if (form.bolts.length >= MAX_BOLTS) return;
//         const last = form.bolts[form.bolts.length - 1];
//         set("bolts", [
//             ...form.bolts,
//             {
//                 id: nextId.current++,
//                 sizeId: currentSize,
//                 x: (last?.x ?? 0) + (form.dx ?? 0),
//                 y: last?.y ?? 0,
//             },
//         ]);
//     };

//     const addForce = () =>
//         set("forces", [
//             ...form.forces,
//             { id: nextId.current++, fx: 0, fy: 0, x: result?.cogX ?? 0, y: result?.cogY ?? 0 },
//         ]);

//     // ---- display helpers ----
//     const lenUnit = getUnitLabel("length", unitSystem);
//     const forceUnit = getUnitLabel("kforce", unitSystem);
//     const momentUnit = getUnitLabel("kmoment", unitSystem);
//     const tidy = (value: number, reference: number) =>
//         Math.abs(value) < 1e-9 * Math.max(1, reference) ? 0 : value;
//     const show = (value: number, quantity: UnitQuantity, reference: number, digits = 4) =>
//         formatSignificantFigures(fromBase(tidy(value, reference), quantity, unitSystem), digits);

//     const forceRef = result
//         ? Math.max(result.maxForce, Math.abs(result.sumFx), Math.abs(result.sumFy))
//         : 1;
//     const lengthRef = result
//         ? Math.max(...result.bolts.map((b) => Math.max(Math.abs(b.x), Math.abs(b.y))), 1)
//         : 1;

//     const copyCsv = async () => {
//         if (!result) return;
//         const header = [
//             "Bolt",
//             "Size",
//             `x (${lenUnit})`,
//             `y (${lenUnit})`,
//             `rx (${lenUnit})`,
//             `ry (${lenUnit})`,
//             `Fx direct (${forceUnit})`,
//             `Fy direct (${forceUnit})`,
//             `Fx moment (${forceUnit})`,
//             `Fy moment (${forceUnit})`,
//             `Fx total (${forceUnit})`,
//             `Fy total (${forceUnit})`,
//             `Resultant (${forceUnit})`,
//             "Angle (deg)",
//             "% of max",
//         ];
//         const lines = result.bolts.map((bolt, i) =>
//             [
//                 bolt.index,
//                 `"${model.sizes[i]?.label ?? ""}"`,
//                 show(bolt.x, "length", lengthRef, 6),
//                 show(bolt.y, "length", lengthRef, 6),
//                 show(bolt.rx, "length", lengthRef, 6),
//                 show(bolt.ry, "length", lengthRef, 6),
//                 show(bolt.fxDirect, "kforce", forceRef, 6),
//                 show(bolt.fyDirect, "kforce", forceRef, 6),
//                 show(bolt.fxMoment, "kforce", forceRef, 6),
//                 show(bolt.fyMoment, "kforce", forceRef, 6),
//                 show(bolt.fx, "kforce", forceRef, 6),
//                 show(bolt.fy, "kforce", forceRef, 6),
//                 show(bolt.resultant, "kforce", forceRef, 6),
//                 formatSignificantFigures(bolt.angleDeg, 5),
//                 formatSignificantFigures(bolt.ratio * 100, 4),
//             ].join(","),
//         );
//         try {
//             await navigator.clipboard.writeText([header.join(","), ...lines].join("\n"));
//             setCopied(true);
//             window.setTimeout(() => setCopied(false), 1800);
//         } catch {
//             setCopied(false);
//         }
//     };

//     const patternLabel: Record<PatternKind, string> = {
//         rectangle: "Rectangle (columns × rows)",
//         line: "Line",
//         circle: "Circle (bolt circle)",
//         custom: "Custom coordinates",
//     };

//     return (
//         <div className= "flex min-h-screen flex-col bg-slate-100 text-slate-800 antialiased" >
//         <SiteHeader
//         icon="fa-solid fa-bullseye"
//     title = {
//           <>
//             Bolt Group Shear Calculator{ " " }
//     <span className="rounded border border-sky-700/50 bg-sky-900/80 px-2 py-0.5 text-xs font-normal text-sky-200" >
//         Engineering Tool
//             </span>
//             </>
// }
// subtitle = "In-plane forces and moment on a bolt pattern, elastic method"
// right = {< UnitToggle />}
// pageTab = { pageTab }
// setPageTab = { setPageTab }
//     >
//     </SiteHeader>

//     < main className = "mx-auto w-full max-w-7xl flex-grow px-4 py-6 sm:px-6 lg:px-8" >
//     { pageTab === "theory" ? (
//         <BoltGroupTheory />
//     ) : (
//         <div className= "grid grid-cols-1 gap-6 lg:grid-cols-12" >
//         {/* Inputs */ }
//     < div className = "space-y-6 lg:col-span-6" >
//         <Card title="1. Bolt Pattern" icon = "fa-solid fa-shapes" >
//             <div className="space-y-4" >
//                 <SelectField
//                     label="Pattern"
// value = { form.pattern }
// onChange = {(value) => set("pattern", value as PatternKind)}
//                   >
//     {(Object.keys(patternLabel) as PatternKind[]).map((kind) => (
//         <option key= { kind } value = { kind } >
//         { patternLabel[kind]}
//         </option>
//     ))}
// </SelectField>

// {
//     form.pattern === "custom" ? (
//         <p className= "text-[11px] text-slate-400" >
//         Enter or edit the bolt coordinates directly in the table below.
//                     </p>
//                   ) : (
//         <div className= "space-y-3" >
//         <div className="grid grid-cols-2 gap-3" >
//         {
//             form.pattern === "rectangle" ? (
//                 <>
//                 <NumberField
//                               label= "Columns"
//                               value={ form.cols }
//                               onChange={(v) => set("cols", v)
//         }
//     min = { 1}
//     step = { 1}
//         />
//         <NumberField
//                               label="Rows"
//     value = { form.rows }
//     onChange = {(v) => set("rows", v)
// }
// min = { 1}
// step = { 1}
//     />
//     <BaseUnitInput
//                               label="X spacing"
// quantity = "length"
// base = { form.dx }
// onBase = {(v) => set("dx", v)}
// min = { 0}
// steps = { [10, 0.5]}
//     />
//     <BaseUnitInput
//                               label="Y spacing"
// quantity = "length"
// base = { form.dy }
// onBase = {(v) => set("dy", v)}
// min = { 0}
// steps = { [10, 0.5]}
//     />
//     </>
//                         ) : null}
// {
//     form.pattern === "line" ? (
//         <>
//         <NumberField
//                               label= "Bolt count"
//                               value = { form.count }
//     onChange = {(v) => set("count", v)
// }
// min = { 1}
// step = { 1}
//     />
//     <BaseUnitInput
//                               label="Spacing"
// quantity = "length"
// base = { form.spacing }
// onBase = {(v) => set("spacing", v)}
// min = { 0}
// steps = { [10, 0.5]}
//     />
//     <NumberField
//                               label="Angle from +x (deg)"
// value = { form.angle }
// onChange = {(v) => set("angle", v)}
// step = { 5}
//     />
//     </>
//                         ) : null}
// {
//     form.pattern === "circle" ? (
//         <>
//         <NumberField
//                               label= "Bolt count"
//                               value = { form.count }
//     onChange = {(v) => set("count", v)
// }
// min = { 1}
// step = { 1}
//     />
//     <BaseUnitInput
//                               label="Bolt circle diameter"
// quantity = "length"
// base = { form.diameter }
// onBase = {(v) => set("diameter", v)}
// min = { 0}
// steps = { [10, 0.5]}
//     />
//     <NumberField
//                               label="Start angle (deg)"
// value = { form.startAngle }
// onChange = {(v) => set("startAngle", v)}
// step = { 5}
//     />
//     </>
//                         ) : null}
// <BaseUnitInput
//                           label="Center X"
// quantity = "length"
// base = { form.cx }
// onBase = {(v) => set("cx", v)}
// steps = { [10, 0.5]}
//     />
//     <BaseUnitInput
//                           label="Center Y"
// quantity = "length"
// base = { form.cy }
// onBase = {(v) => set("cy", v)}
// steps = { [10, 0.5]}
//     />
//     </div>
// {
//     form.pattern === "rectangle" ? (
//         <label className= "flex cursor-pointer items-center gap-2 text-xs text-slate-600" >
//         <input
//                             type="checkbox"
//     checked = { form.perimeterOnly }
//     onChange = {(event) => set("perimeterOnly", event.target.checked)
// }
// className = "h-3.5 w-3.5 accent-sky-600"
//     />
//     Perimeter bolts only
//         </label>
//                       ) : null}
// <div className="flex flex-wrap items-center gap-2" >
//     <button
//                           type="button"
// onClick = { generate }
// className = "rounded-lg bg-sky-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-sky-800"
//     >
//     Generate pattern
//         </button>
//         < span className = "text-[11px] text-slate-400" >
//             Replaces the bolt table.Max { MAX_BOLTS } bolts.
//                         </span>
//                 </div>
// {
//     patternError ? (
//         <p className= "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700" >
//         { patternError }
//         </p>
//                       ) : null
// }
// </div>
//                   )}

// <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2" >
//     <div>
//     <label htmlFor="set-all" className = "label-input" >
//         Set all bolts to
//             </label>
//             < select
// id = "set-all"
// value = { allSame?(form.bolts[0]?.sizeId ?? "") : ""}
// onChange = {(event) =>
// set(
//     "bolts",
//     form.bolts.map((row) => ({ ...row, sizeId: event.target.value })),
// )
//                         }
// className = "box-input pr-3 font-sans"
//     >
//     {!allSame ? (
//         <option value= "" disabled >
//             Mixed sizes
//                 </option>
//                         ) : null}
// <SizeOptions
//                           commonOnly={ form.commonOnly }
// current = { form.bolts[0]?.sizeId ?? "" }
//     />
//     </select>
//     < label className = "mt-2 flex cursor-pointer items-center gap-2 text-[11px] text-slate-500" >
//         <input
//                           type="checkbox"
// checked = { form.commonOnly }
// onChange = {(event) => set("commonOnly", event.target.checked)}
// className = "h-3.5 w-3.5 accent-sky-600"
//     />
//     Show common sizes only
//         </label>
//         </div>
//         < SelectField
// label = "Weight bolts by"
// value = { form.weighting }
// onChange = {(value) => set("weighting", value as Weighting)}
//                     >
//     <option value="tensile" > Tensile stress area(threads in shear plane) </option>
//         < option value = "shank" > Major - diameter area(shank in shear plane) </option>
//             </SelectField>
//             </div>

//             < div className = "overflow-x-auto" >
//                 <table className="w-full min-w-[360px] overflow-hidden rounded-lg border border-slate-200 text-left text-xs" >
//                     <thead className="bg-slate-100 text-[10px] uppercase tracking-wider text-slate-600" >
//                         <tr>
//                         <th className="px-2 py-2" ># </th>
//                             < th className = "px-2 py-2" > Size </th>
//                                 < th className = "px-2 py-2 text-right" > x({ lenUnit }) </th>
//                                     < th className = "px-2 py-2 text-right" > y({ lenUnit }) </th>
//                                         < th className = "px-2 py-2" />
//                                             </tr>
//                                             </thead>
//                                             < tbody className = "divide-y divide-slate-100 bg-white" >
//                                             {
//                                                 form.bolts.map((row, i) => (
//                                                     <tr
//                             key= { row.id }
//                             onMouseEnter = {() => setHover(i + 1)}
// onMouseLeave = {() => setHover(null)}
// className = { hover === i + 1 ? "bg-violet-50" : ""}
//                           >
//     <td className="px-2 py-1.5 font-mono text-slate-500" > { i + 1}</td>
//         < td className = "px-2 py-1.5" >
//             <select
//                                 aria-label={ `Bolt ${i + 1} size` }
// value = { row.sizeId }
// onChange = {(event) =>
// updateBolt(row.id, { sizeId: event.target.value })
//                                 }
// className = "box-input min-w-[7.5rem] px-2 py-1 pr-2 font-sans text-xs"
//     >
//     <SizeOptions commonOnly={ form.commonOnly } current = { row.sizeId } />
//         </select>
//         </td>
//         < td className = "px-2 py-1.5 text-right" >
//             <CellInput
//                                 label={ `Bolt ${i + 1} x` }
// quantity = "length"
// base = { row.x }
// onBase = {(v) => updateBolt(row.id, { x: v })}
//                               />
//     </td>
//     < td className = "px-2 py-1.5 text-right" >
//         <CellInput
//                                 label={ `Bolt ${i + 1} y` }
// quantity = "length"
// base = { row.y }
// onBase = {(v) => updateBolt(row.id, { y: v })}
//                               />
//     </td>
//     < td className = "px-2 py-1.5 text-right" >
//         <button
//                                 type="button"
// aria-label={ `Delete bolt ${i + 1}` }
// onClick = {() =>
// set(
//     "bolts",
//     form.bolts.filter((b) => b.id !== row.id),
// )
//                                 }
// className = "rounded px-2 py-1 text-red-600 hover:bg-red-50"
//     >
//     <i className="fa-solid fa-xmark" aria-hidden="true" />
//         </button>
//         </td>
//         </tr>
//                         ))}
// </tbody>
//     </table>
//     </div>
//     < div className = "flex items-center gap-3" >
//         <button
//                       type="button"
// onClick = { addBolt }
// disabled = { form.bolts.length >= MAX_BOLTS }
// className = "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
//     >
//     + Add bolt
//         </button>
//         < span className = "text-[11px] text-slate-400" >
//         { form.bolts.length } of { MAX_BOLTS } bolts
//             </span>
//             </div>
//             </div>
//             </Card>

//             < Card title = "2. Applied Loads" icon = "fa-solid fa-arrows-down-to-line" >
//                 <div className="space-y-4" >
//                     <div className="overflow-x-auto" >
//                         <table className="w-full min-w-[420px] overflow-hidden rounded-lg border border-slate-200 text-left text-xs" >
//                             <thead className="bg-slate-100 text-[10px] uppercase tracking-wider text-slate-600" >
//                                 <tr>
//                                 <th className="px-2 py-2" ># </th>
//                                     < th className = "px-2 py-2 text-right" > Fx({ forceUnit }) </th>
//                                         < th className = "px-2 py-2 text-right" > Fy({ forceUnit }) </th>
//                                             < th className = "px-2 py-2 text-right" > x({ lenUnit }) </th>
//                                                 < th className = "px-2 py-2 text-right" > y({ lenUnit }) </th>
//                                                     < th className = "px-2 py-2" />
//                                                         </tr>
//                                                         </thead>
//                                                         < tbody className = "divide-y divide-slate-100 bg-white" >
//                                                         {
//                                                             form.forces.map((row, i) => (
//                                                                 <tr key= { row.id } >
//                                                                 <td className="px-2 py-1.5 font-mono text-slate-500" > { i + 1} </td>
//                                                             < td className = "px-2 py-1.5 text-right" >
//                                                                 <CellInput
//                                 label={ `Force ${i + 1} Fx` }
// quantity = "kforce"
// base = { row.fx }
// onBase = {(v) => updateForce(row.id, { fx: v })}
//                               />
//     </td>
//     < td className = "px-2 py-1.5 text-right" >
//         <CellInput
//                                 label={ `Force ${i + 1} Fy` }
// quantity = "kforce"
// base = { row.fy }
// onBase = {(v) => updateForce(row.id, { fy: v })}
//                               />
//     </td>
//     < td className = "px-2 py-1.5 text-right" >
//         <CellInput
//                                 label={ `Force ${i + 1} x` }
// quantity = "length"
// base = { row.x }
// onBase = {(v) => updateForce(row.id, { x: v })}
//                               />
//     </td>
//     < td className = "px-2 py-1.5 text-right" >
//         <CellInput
//                                 label={ `Force ${i + 1} y` }
// quantity = "length"
// base = { row.y }
// onBase = {(v) => updateForce(row.id, { y: v })}
//                               />
//     </td>
//     < td className = "px-2 py-1.5 text-right" >
//         <button
//                                 type="button"
// aria-label={ `Delete force ${i + 1}` }
// onClick = {() =>
// set(
//     "forces",
//     form.forces.filter((f) => f.id !== row.id),
// )
//                                 }
// className = "rounded px-2 py-1 text-red-600 hover:bg-red-50"
//     >
//     <i className="fa-solid fa-xmark" aria-hidden="true" />
//         </button>
//         </td>
//         </tr>
//                         ))}
// </tbody>
//     </table>
//     </div>
//     < button
// type = "button"
// onClick = { addForce }
// className = "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-sky-300 hover:text-sky-700"
//     >
//     + Add force
//         </button>
//         < div className = "grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2" >
//             <BaseUnitInput
//                       label="Applied moment Mz"
// quantity = "kmoment"
// base = { form.moment }
// onBase = {(v) => set("moment", v)}
// steps = { [1, 1]}
//     />
//     </div>
//     < p className = "text-[11px] leading-relaxed text-slate-400" >
//         Forces act in the plane of the bolt pattern at(x, y).The moment is a free
// couple, positive counter - clockwise.Bolts carry shear only.Coordinates share
//                     one origin and use x to the right, y up.
//                   </p>
//     </div>
//     </Card>
//     </div>

// {/* Results */ }
// <div className="space-y-6 lg:col-span-6" >
// {
//     result?(
//                 <>
//     <Card title="Pattern, Loads and Bolt Forces" icon = "fa-solid fa-bullseye" >
//         <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4" >
//             <Metric
//                         label="Pattern COG (area-weighted)"
// value = {`${show(result.cogX, "length", lengthRef)}, ${show(result.cogY, "length", lengthRef)} ${lenUnit}`}
//                       />
//     < Metric
// label = "Total force at COG"
// value = {`${show(result.sumFx, "kforce", forceRef)}, ${show(result.sumFy, "kforce", forceRef)} ${forceUnit}`}
// sub = "ΣFx, ΣFy"
//     />
//     <Metric
//                         label="Moment at COG"
// value = {`${show(result.momentAtCog, "kmoment", Math.abs(result.momentAtCog))} ${momentUnit}`}
// sub = {
//     result.momentAtCog > 0
//         ? "counter-clockwise"
//         : result.momentAtCog < 0
//             ? "clockwise"
//             : undefined
// }
//     />
//     <Metric
//                         label="Maximum bolt force"
// value = {`${show(result.maxForce, "kforce", forceRef)} ${forceUnit}`}
// sub = {
//     result.maxBolts.length > 0
//         ? `bolt ${result.maxBolts.join(", ")}`
//         : "no load"
// }
//     />
//     </div>
//     < BoltGroupDiagram
// bolts = { model.diagramBolts }
// forces = { model.diagramForces }
// cogX = { result.cogX }
// cogY = { result.cogY }
// momentAtCog = { result.momentAtCog }
// highlight = { hover }
// system = { unitSystem }
//     />
//     <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-600" >
//         <span className="flex items-center gap-2" >
//             Load on bolt
//                 < span className = "h-2 w-24 rounded bg-gradient-to-r from-sky-200 to-orange-500" />
//                     0 to max
//                         </span>
//                         < span className = "text-red-700" > Applied force </span>
//                             < span className = "text-sky-700" > Force carried by bolt </span>
//                                 < span className = "text-violet-700" > Moment at COG </span>
//                                     < span
// className = {`rounded px-2 py-0.5 text-[10px] font-bold ${result.equilibriumOk ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
//                       >
// { result.equilibriumOk ? "EQUILIBRIUM OK" : "EQUILIBRIUM CHECK FAILED" }
//     </span>
//     </div>
//     < div className = "mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3" >
//         <Metric
//                         label="Total shear area (ΣA)"
// value = { show(result.totalArea, "area", 1) }
// sub = { getUnitLabel("area", unitSystem) }
//     />
//     <Metric
//                         label="Polar moment (J = ΣA·r²)"
// value = { show(result.polarMoment, "inertia", 1) }
// sub = { getUnitLabel("inertia", unitSystem) }
//     />
//     <Metric label="Bolts" value = { String(result.bolts.length) } />
//         </div>
// {
//     result.warnings.length > 0 ? (
//         <ul className= "mt-4 space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800" >
//         {
//             result.warnings.map((warning) => (
//                 <li key= { warning } >
//                 <i
//                               className="fa-solid fa-triangle-exclamation mr-2"
//                               aria-hidden="true"
//             />
//             { warning }
//             </li>
//             ))
//         }
//         </ul>
//                     ) : null
// }
// </Card>
//     </>
//               ) : (
//     <Card title= "Results" icon = "fa-solid fa-bullseye" >
//         <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700" >
//         { model.error }
//             </div>
//             </Card>
//               )}
// </div>

// {/* Full-width bolt force table */ }
// {
//     result ? (
//         <div className= "lg:col-span-12" >
//         <Card title="Bolt Force Breakdown" icon = "fa-solid fa-list-check" >
//             <div className="mb-3 flex items-center justify-between gap-3" >
//                 <p className="text-[11px] text-slate-400" >
//                     Forces in { forceUnit }, positions in { lenUnit }; rx, ry are measured from the
//     COG.Forces act in the same sense as the applied loads.
//                     </p>
//         < button
//     type = "button"
//     onClick = { copyCsv }
//     className = "shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-sky-300 hover:text-sky-700"
//         >
//     { copied? "Copied": "Copy CSV" }
//         </button>
//         </div>
//         < div className = "overflow-x-auto" >
//             <table className="w-full min-w-[900px] overflow-hidden rounded-lg border border-slate-200 text-xs" >
//                 <thead className="bg-slate-100 text-[10px] uppercase tracking-wider text-slate-600" >
//                     <tr>
//                     {
//                         [
//                         "#",
//                         "Size",
//                         "x",
//                         "y",
//                         "rx",
//                         "ry",
//                         "Fx direct",
//                         "Fy direct",
//                         "Fx moment",
//                         "Fy moment",
//                         "Fx total",
//                         "Fy total",
//                         "Resultant",
//                         "Angle",
//                         "% of max",
//                           ].map((heading, i) => (
//                             <th
//                               key= { heading }
//                               className = {`px-2 py-2 ${i < 2 ? "text-left" : "text-right"}`}
//                     >
//                 { heading }
//                     </th>
//                           ))
// }
// </tr>
//     </thead>
//     < tbody className = "divide-y divide-slate-100 bg-white font-mono" >
//     {
//         result.bolts.map((bolt, i) => (
//             <tr
//                             key= { bolt.index }
//                             onMouseEnter = {() => setHover(bolt.index)}
// onMouseLeave = {() => setHover(null)}
// className = {
//     bolt.isMax
//         ? "bg-orange-50"
//         : hover === bolt.index
//             ? "bg-violet-50"
//             : ""
// }
//     >
//     <td className="px-2 py-1.5 text-slate-500" > { bolt.index } </td>
//         < td className = "whitespace-nowrap px-2 py-1.5 font-sans" >
//         { model.sizes[i]?.label }
//             </td>
//             < td className = "px-2 py-1.5 text-right" >
//             { show(bolt.x, "length", lengthRef) }
//                 </td>
//                 < td className = "px-2 py-1.5 text-right" >
//                 { show(bolt.y, "length", lengthRef) }
//                     </td>
//                     < td className = "px-2 py-1.5 text-right" >
//                     { show(bolt.rx, "length", lengthRef) }
//                         </td>
//                         < td className = "px-2 py-1.5 text-right" >
//                         { show(bolt.ry, "length", lengthRef) }
//                             </td>
//                             < td className = "px-2 py-1.5 text-right" >
//                             { show(bolt.fxDirect, "kforce", forceRef) }
//                                 </td>
//                                 < td className = "px-2 py-1.5 text-right" >
//                                 { show(bolt.fyDirect, "kforce", forceRef) }
//                                     </td>
//                                     < td className = "px-2 py-1.5 text-right" >
//                                     { show(bolt.fxMoment, "kforce", forceRef) }
//                                         </td>
//                                         < td className = "px-2 py-1.5 text-right" >
//                                         { show(bolt.fyMoment, "kforce", forceRef) }
//                                             </td>
//                                             < td className = "px-2 py-1.5 text-right" >
//                                             { show(bolt.fx, "kforce", forceRef) }
//                                                 </td>
//                                                 < td className = "px-2 py-1.5 text-right" >
//                                                 { show(bolt.fy, "kforce", forceRef) }
//                                                     </td>
//                                                     < td className = "px-2 py-1.5 text-right font-bold text-slate-900" >
//                                                     { show(bolt.resultant, "kforce", forceRef) }
//                                                         </td>
//                                                         < td className = "px-2 py-1.5 text-right" >
//                                                         {
//                                                             bolt.resultant > 0
//                                                                 ? `${formatSignificantFigures(bolt.angleDeg, 4)}°`
//                                                                 : "—"
//                                                         }
//                                                             </td>
//                                                             < td className = "px-2 py-1.5 text-right" >
//                                                                 { formatSignificantFigures(bolt.ratio * 100, 3) } %
//                                                                 </td>
//                                                                 </tr>
//                         ))}
// </tbody>
//     </table>
//     </div>
//     </Card>
//     </div>
//             ) : null}
// </div>
//         )}
// </main>
//     </div>
//   );
// }
