// Bolted joint strength engine.
// All inputs and outputs use SI base units: mm, N, MPa, N/mm. The UI converts for display.
// Method: Shigley's Mechanical Engineering Design, Chapter 8 (frustum member stiffness, joint constant,
// preload, separation, proof/yield checks), plus Machinery's Handbook thread-stripping areas.

export type FastenerSystem = "metric" | "imperial";
export type JointConfig = "bolt_nut" | "tapped_hole";
export type PreloadMode = "percent" | "force" | "torque";
export type ShearPlane = "threads" | "shank";

// Young's modulus for steel bolts and washers (Shigley Table A-5), MPa.
export const STEEL_E = 207000;
// tan(30°): half-angle of the pressure cone in Shigley's frustum method.
export const TAN_30 = Math.tan(Math.PI / 6);
// Shear yield / tensile yield ratio from the distortion-energy theory.
export const SHEAR_YIELD_RATIO = 0.577;
// Ultimate shear / ultimate tensile ratio used for thread stripping and pull-through.
export const SHEAR_ULTIMATE_RATIO = 0.6;

export interface PlateInput {
  t: number; // thickness, mm
  sy: number; // yield strength, MPa
  su: number; // ultimate strength, MPa
  e: number; // Young's modulus, MPa
}

export interface BoltedJointInput {
  fastenerSystem: FastenerSystem;
  config: JointConfig;
  // Fastener geometry
  d: number; // nominal (major) diameter, mm
  pitch: number; // thread pitch, mm
  at: number; // tensile stress area, mm²
  headAF: number; // head / nut width across flats, mm
  headHeight: number; // mm
  nutHeight: number; // mm
  boltLength: number; // nominal length under the head, mm
  // Bolt material
  sp: number; // proof strength, MPa
  sy: number; // yield strength, MPa
  su: number; // ultimate strength, MPa
  eBolt: number; // modulus, MPa
  // Washers and holes
  washerEnabled: boolean;
  washerOd: number;
  washerT: number;
  hole: number; // clearance hole diameter, mm
  // Plates (plate 2 is the nut-side plate, or the tapped plate for a tapped hole)
  plate1: PlateInput;
  plate2: PlateInput;
  // Thread engagement length, mm (nut height for bolt + nut)
  engagement: number;
  // Ultimate strength of the internal thread material for bolt + nut (a tapped plate uses plate 2)
  nutSu: number;
  // Loads (per bolt)
  tensileLoad: number; // N, external tension in the joint axis
  shearLoad: number; // N, transverse shear
  requiredClamp: number; // N, 0 = no requirement
  mu: number; // friction coefficient for slip resistance
  shearPlane: ShearPlane;
  // Preload
  preloadMode: PreloadMode;
  preloadPercent: number; // % of proof load
  preloadForce: number; // N
  preloadTorque: number; // N-mm
  nutFactor: number; // K in T = K Fi d
  scatter: number; // preload variation as a fraction, e.g. 0.25 for ±25%
}

export interface PreloadCase {
  label: "min" | "nominal" | "max";
  preload: number; // Fi, N
  boltForce: number; // Fb = Fi + C P, N
  clampForce: number; // Fm = Fi - (1 - C) P, N
  yieldFos: number;
  separationFos: number;
}

export interface BoltedJointResult {
  // Geometry
  ad: number; // major-diameter area, mm²
  at: number;
  grip: number; // clamped thickness incl. washers, mm
  gripEffective: number; // grip used for stiffness, mm
  threadLength: number; // LT, mm
  unthreadedInGrip: number; // ld, mm
  threadedInGrip: number; // lt, mm
  // Stiffness
  kb: number; // N/mm
  km: number; // N/mm
  c: number; // joint constant
  // Preload
  proofLoad: number; // Fp = Sp At, N
  nominalPreload: number;
  torque: number; // T = K Fi d at nominal preload, N-mm
  cases: { min: PreloadCase; nominal: PreloadCase; max: PreloadCase };
  // Thread stripping
  engagement: number;
  externalStripArea: number; // mm²
  internalStripArea: number; // mm²
  externalStripCapacity: number; // N
  internalStripCapacity: number; // N
  externalStripFos: number;
  internalStripFos: number;
  // Pull-through and bearing
  pullThroughCapacity: number; // N
  pullThroughFos: number;
  bearingCapacity: number; // N
  bearingFos: number;
  // Shear
  shearArea: number; // mm²
  boltShearFos: number;
  slipFos: number;
  combinedStress: number; // von Mises at max preload, MPa
  combinedFos: number;
  // Clamp
  minClampForce: number; // N, remaining clamp at minimum preload
  clampFos: number; // remaining / required, Infinity if no requirement
  warnings: string[];
}

interface Layer {
  t: number;
  e: number;
}

// Shigley frustum stiffness for one truncated cone with narrow-end diameter dn and thickness t.
function frustumStiffness(e: number, t: number, dn: number, d: number): number {
  const big = Math.max(dn, d * 1.001);
  const a = (2 * TAN_30 * t + big - d) * (big + d);
  const b = (2 * TAN_30 * t + big + d) * (big - d);
  return (TAN_30 * Math.PI * e * d) / Math.log(a / b);
}

// Series stiffness of the clamped members: two opposing pressure cones meeting at mid-grip,
// cut into one frustum per material layer so dissimilar plates and washers are handled.
export function memberStiffness(layers: Layer[], d: number, dTop: number, dBottom: number): number {
  const total = layers.reduce((sum, layer) => sum + layer.t, 0);
  const mid = total / 2;
  let compliance = 0;
  let z = 0;
  for (const layer of layers) {
    const z0 = z;
    const z1 = z + layer.t;
    z = z1;
    if (layer.t <= 0) continue;
    if (z0 < mid) {
      const t = Math.min(z1, mid) - z0;
      if (t > 0) compliance += 1 / frustumStiffness(layer.e, t, dTop + 2 * TAN_30 * z0, d);
    }
    if (z1 > mid) {
      const t = z1 - Math.max(z0, mid);
      if (t > 0) compliance += 1 / frustumStiffness(layer.e, t, dBottom + 2 * TAN_30 * (total - z1), d);
    }
  }
  return 1 / compliance;
}

// Standard thread length LT for hex bolts (Shigley Eq. 8-13 / 8-14 style rules).
export function threadedLength(d: number, boltLength: number, system: FastenerSystem): number {
  if (system === "metric") {
    if (boltLength <= 125) return 2 * d + 6;
    if (boltLength <= 200) return 2 * d + 12;
    return 2 * d + 25;
  }
  return boltLength / 25.4 <= 6 ? 2 * d + 6.35 : 2 * d + 12.7;
}

// Basic-profile thread diameters.
export const pitchDiameter = (d: number, p: number) => d - 0.649519 * p;
export const internalMinorDiameter = (d: number, p: number) => d - 1.082532 * p;

// Thread shear areas for a given engagement length (Machinery's Handbook, basic profile).
export function externalStripAreaFor(d: number, p: number, le: number): number {
  const n = 1 / p;
  const d1 = internalMinorDiameter(d, p);
  return Math.PI * n * le * d1 * (1 / (2 * n) + 0.57735 * (pitchDiameter(d, p) - d1));
}

export function internalStripAreaFor(d: number, p: number, le: number): number {
  const n = 1 / p;
  return Math.PI * n * le * d * (1 / (2 * n) + 0.57735 * (d - pitchDiameter(d, p)));
}

export function roundUpTo(value: number, step: number): number {
  return Math.ceil(value / step - 1e-9) * step;
}

// Default engagement for a tapped hole: enough length to develop the bolt strength, between 1d and 3d,
// never more than the tapped plate thickness.
export function autoTappedEngagement(
  d: number,
  p: number,
  at: number,
  boltSu: number,
  internalSu: number,
  plate2T: number,
  system: FastenerSystem,
): number {
  const perMm = SHEAR_ULTIMATE_RATIO * internalSu * internalStripAreaFor(d, p, 1);
  const required = perMm > 0 ? (boltSu * at) / perMm : 3 * d;
  const bounded = Math.min(Math.max(required, d), 3 * d);
  const rounded = roundUpTo(bounded, system === "metric" ? 0.5 : 25.4 / 16);
  return Math.min(rounded, plate2T);
}

// Default bolt length: stack + nut (or engagement) + two thread pitches, rounded up to a stock length.
export function autoBoltLength(
  system: FastenerSystem,
  clampedStack: number,
  nutOrEngagement: number,
  pitch: number,
): number {
  const required = clampedStack + nutOrEngagement + 2 * pitch;
  if (system === "metric") {
    const step = required <= 20 ? 2 : required <= 100 ? 5 : 10;
    return roundUpTo(required, step);
  }
  const inches = required / 25.4;
  const step = inches <= 4 ? 0.25 : 0.5;
  return roundUpTo(inches, step) * 25.4;
}

function requirePositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be greater than zero.`);
}

export function calculateBoltedJoint(input: BoltedJointInput): BoltedJointResult {
  requirePositive(input.d, "Bolt diameter");
  requirePositive(input.pitch, "Thread pitch");
  requirePositive(input.at, "Tensile stress area");
  requirePositive(input.boltLength, "Bolt length");
  requirePositive(input.plate1.t, "Plate 1 thickness");
  requirePositive(input.plate2.t, "Plate 2 thickness");
  requirePositive(input.plate1.e, "Plate 1 modulus");
  requirePositive(input.plate2.e, "Plate 2 modulus");
  requirePositive(input.plate1.sy, "Plate 1 yield strength");
  requirePositive(input.plate2.sy, "Plate 2 yield strength");
  requirePositive(input.plate1.su, "Plate 1 ultimate strength");
  requirePositive(input.plate2.su, "Plate 2 ultimate strength");
  requirePositive(input.hole, "Hole diameter");
  requirePositive(input.engagement, "Thread engagement");
  requirePositive(input.nutSu, "Nut ultimate strength");
  requirePositive(input.nutFactor, "Nut factor");
  if (input.washerEnabled) {
    requirePositive(input.washerOd, "Washer outer diameter");
    requirePositive(input.washerT, "Washer thickness");
  }
  if (!Number.isFinite(input.scatter) || input.scatter < 0 || input.scatter >= 1) {
    throw new Error("Preload variation must be between 0 and 100 %.");
  }

  const { d, pitch, at } = input;
  const isNut = input.config === "bolt_nut";
  const tw = input.washerEnabled ? input.washerT : 0;
  // Bearing diameters at the head and nut faces: washer OD, otherwise the across-flats width.
  const dwHead = input.washerEnabled ? input.washerOd : input.headAF;
  const dwNut = dwHead;
  const ad = (Math.PI * d * d) / 4;
  const p = Math.max(input.tensileLoad, 0);
  const v = Math.max(input.shearLoad, 0);

  // ---- Grip and member stiffness -------------------------------------------------------------
  const layers: Layer[] = [];
  const addWasher = () => {
    if (tw > 0) layers.push({ t: tw, e: STEEL_E });
  };
  let grip: number;
  let gripEffective: number;
  if (isNut) {
    addWasher();
    layers.push({ t: input.plate1.t, e: input.plate1.e });
    layers.push({ t: input.plate2.t, e: input.plate2.e });
    addWasher();
    grip = layers.reduce((sum, layer) => sum + layer.t, 0);
    gripEffective = grip;
  } else {
    // Shigley, tapped joints: effective grip l = h + t2/2 if t2 < d, otherwise h + d/2.
    const h = tw + input.plate1.t;
    const extra = input.plate2.t < d ? input.plate2.t / 2 : d / 2;
    addWasher();
    layers.push({ t: input.plate1.t, e: input.plate1.e });
    layers.push({ t: extra, e: input.plate2.e });
    grip = h;
    gripEffective = h + extra;
  }
  const km = memberStiffness(layers, d, dwHead, isNut ? dwNut : dwHead);

  const threadLength = threadedLength(d, input.boltLength, input.fastenerSystem);
  const unthreadedInGrip = Math.min(Math.max(input.boltLength - threadLength, 0), gripEffective);
  const threadedInGrip = gripEffective - unthreadedInGrip;
  const kb = (ad * at * input.eBolt) / (ad * threadedInGrip + at * unthreadedInGrip);
  const c = kb / (kb + km);

  // ---- Preload and load cases ----------------------------------------------------------------
  const proofLoad = input.sp * at;
  let nominalPreload: number;
  if (input.preloadMode === "percent") nominalPreload = (input.preloadPercent / 100) * proofLoad;
  else if (input.preloadMode === "force") nominalPreload = input.preloadForce;
  else nominalPreload = input.preloadTorque / (input.nutFactor * d);
  if (!Number.isFinite(nominalPreload) || nominalPreload <= 0) throw new Error("Preload must be greater than zero.");

  const makeCase = (label: PreloadCase["label"], fi: number): PreloadCase => {
    const boltForce = fi + c * p;
    return {
      label,
      preload: fi,
      boltForce,
      clampForce: fi - (1 - c) * p,
      yieldFos: (input.sy * at) / boltForce,
      separationFos: p > 0 ? fi / ((1 - c) * p) : Infinity,
    };
  };
  const cases = {
    min: makeCase("min", nominalPreload * (1 - input.scatter)),
    nominal: makeCase("nominal", nominalPreload),
    max: makeCase("max", nominalPreload * (1 + input.scatter)),
  };
  const torque = input.nutFactor * nominalPreload * d;

  // ---- Thread stripping (checked against the maximum bolt force) ------------------------------
  const engagement = isNut ? input.engagement : Math.min(input.engagement, input.plate2.t);
  const internalSu = isNut ? input.nutSu : input.plate2.su;
  const externalStripArea = externalStripAreaFor(d, pitch, engagement);
  const internalStripArea = internalStripAreaFor(d, pitch, engagement);
  const externalStripCapacity = SHEAR_ULTIMATE_RATIO * input.su * externalStripArea;
  const internalStripCapacity = SHEAR_ULTIMATE_RATIO * internalSu * internalStripArea;
  const fbMax = cases.max.boltForce;

  // ---- Pull-through: shear of a plug the size of the washer / head bearing diameter ------------
  const pullHead = SHEAR_ULTIMATE_RATIO * input.plate1.su * Math.PI * dwHead * input.plate1.t;
  const pullNut = isNut ? SHEAR_ULTIMATE_RATIO * input.plate2.su * Math.PI * dwNut * input.plate2.t : Infinity;
  const pullThroughCapacity = Math.min(pullHead, pullNut);

  // ---- Plate bearing from the shear load: yield strength x d x t, weaker plate governs --------
  const plate2Bearing = isNut ? input.plate2.t : engagement;
  const bearingCapacity = Math.min(input.plate1.sy * d * input.plate1.t, input.plate2.sy * d * plate2Bearing);

  // ---- Bolt shear, slip and combined loading ---------------------------------------------------
  const shearArea = input.shearPlane === "threads" ? at : ad;
  const boltShearFos = v > 0 ? (SHEAR_YIELD_RATIO * input.sy * shearArea) / v : Infinity;
  const minClampForce = cases.min.clampForce;
  const slipFos = v > 0 ? (minClampForce > 0 ? (input.mu * minClampForce) / v : 0) : Infinity;
  const sigma = fbMax / at;
  const tau = v / shearArea;
  const combinedStress = Math.sqrt(sigma * sigma + 3 * tau * tau);
  const combinedFos = input.sy / combinedStress;
  const clampFos = input.requiredClamp > 0 ? minClampForce / input.requiredClamp : Infinity;

  // ---- Warnings -------------------------------------------------------------------------------
  const warnings: string[] = [];
  if (cases.max.preload > proofLoad) warnings.push("Maximum preload exceeds the bolt proof load.");
  if (input.hole <= d) warnings.push("Hole diameter is not larger than the bolt diameter.");
  if (input.washerEnabled && input.washerOd <= input.hole) warnings.push("Washer outer diameter is not larger than the hole.");
  if (isNut && input.boltLength < grip + input.nutHeight + pitch) {
    warnings.push("Bolt is too short: it should reach at least one thread past the nut.");
  }
  if (!isNut) {
    if (input.engagement > input.plate2.t) warnings.push("Thread engagement is limited to the tapped plate thickness.");
    if (input.boltLength < grip + engagement) warnings.push("Bolt is too short for the specified thread engagement.");
  }
  if (cases.min.clampForce <= 0 && p > 0) warnings.push("Joint separates at minimum preload and the applied tension.");

  return {
    ad,
    at,
    grip,
    gripEffective,
    threadLength,
    unthreadedInGrip,
    threadedInGrip,
    kb,
    km,
    c,
    proofLoad,
    nominalPreload,
    torque,
    cases,
    engagement,
    externalStripArea,
    internalStripArea,
    externalStripCapacity,
    internalStripCapacity,
    externalStripFos: externalStripCapacity / fbMax,
    internalStripFos: internalStripCapacity / fbMax,
    pullThroughCapacity,
    pullThroughFos: pullThroughCapacity / fbMax,
    bearingCapacity,
    bearingFos: v > 0 ? bearingCapacity / v : Infinity,
    shearArea,
    boltShearFos,
    slipFos,
    combinedStress,
    combinedFos,
    minClampForce,
    clampFos,
    warnings,
  };
}

export type FosStatus = "pass" | "warn" | "fail";

// Pass at or above the target FOS, warning between 1.0 and the target, fail below 1.0.
export function fosStatus(n: number, target: number): FosStatus {
  if (!(n >= 1)) return "fail";
  return n >= target ? "pass" : "warn";
}

export function formatFos(n: number): string {
  if (Number.isNaN(n)) return "—";
  if (!Number.isFinite(n)) return n > 0 ? "∞" : "—";
  if (n >= 100) return ">100";
  return n.toFixed(2);
}
