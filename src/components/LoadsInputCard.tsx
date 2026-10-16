import { Card } from "./Card";
import { UnitInput } from "./UnitInput";
import { useUnitSystem } from "./units/UnitContext";
import { type UnitSchema } from "../engineering/units";

// Reusable nullable public load input model
export interface LoadInput {
    Fx: number | null;
    Fy: number | null;
    Fz: number | null;
    xL: number | null;
    yL: number | null;
    zL: number | null;
    Mx: number | null;
    My: number | null;
    Mz: number | null;
}

// Reusable validated load model in canonical base units
export interface BaseLoadInput {
    Fx: number;
    Fy: number;
    Fz: number;
    xL: number;
    yL: number;
    zL: number;
    Mx: number;
    My: number;
    Mz: number;
}

// Reusable unit schema for load conversions
export const loadUnitSchema: UnitSchema<LoadInput> = {
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

interface LoadInputCardProps {
  values: LoadInput;
  onChange: <K extends keyof LoadInput>(
    field: K,
    value: LoadInput[K]
  ) => void;
  /** Show Fz force and zL coordinate inputs (Default: true) */
  enableZ?: boolean;
  /** Show Mx, My, and Mz direct moment inputs (Default: true) */
  enableMoments?: boolean;
  /** Show application coordinates xL, yL, zL (Default: true) */
  enableCoordinates?: boolean;
  title?: string;
  className?: string;
}

export function LoadsInputCard({
  values,
  onChange,
  enableZ = true,
  enableMoments = true,
  enableCoordinates = true,
  title = "Applied Forces & Load Application Points",
  className = "",
}: LoadInputCardProps) {
  const { unitSystem } = useUnitSystem();
  const isImperial = unitSystem === "imperial";

  const forceStep = isImperial ? 100 : 500;
  const lengthStep = isImperial ? 0.5 : 1;
  const momentStep = isImperial ? 500 : 50;

  return (
    <Card
      title={title}
      icon="fa-solid fa-arrows-down-to-line"
      className={className}
    >
      {/* Forces and Coordinates Table */}
      <div className="mb-4 overflow-x-auto">
        <table className="w-full min-w-[300px] overflow-hidden rounded-lg border border-slate-200 text-left text-xs font-mono">
          <thead className="border-b border-slate-200 bg-slate-100 text-[10px] uppercase tracking-wider text-slate-600">
            <tr>
              <th className="p-2">Force Magnitude</th>
              {enableCoordinates ? (
                <th className="p-2">Application Coord</th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-slate-50/50">
            {/* Fx Row */}
            <tr>
              <td className="p-2">
                <UnitInput
                  label="Fx Shear"
                  quantity="force"
                  value={values.Fx ?? 0}
                  onChange={(val) => onChange("Fx", val)}
                  step={forceStep}
                />
              </td>
              {enableCoordinates ? (
                <td className="p-2">
                  <UnitInput
                    label="XL Location"
                    quantity="length"
                    value={values.xL ?? 0}
                    onChange={(val) => onChange("xL", val)}
                    step={lengthStep}
                  />
                </td>
              ) : null}
            </tr>

            {/* Fy Row */}
            <tr>
              <td className="p-2">
                <UnitInput
                  label="Fy Direct"
                  quantity="force"
                  value={values.Fy ?? 0}
                  onChange={(val) => onChange("Fy", val)}
                  step={forceStep}
                />
              </td>
              {enableCoordinates ? (
                <td className="p-2">
                  <UnitInput
                    label="YL Location"
                    quantity="length"
                    value={values.yL ?? 0}
                    onChange={(val) => onChange("yL", val)}
                    step={lengthStep}
                  />
                </td>
              ) : null}
            </tr>

            {/* Optional Fz / zL Row */}
            {enableZ ? (
              <tr>
                <td className="p-2">
                  <UnitInput
                    label="Fz Out-of-Plane"
                    quantity="force"
                    value={values.Fz ?? 0}
                    onChange={(val) => onChange("Fz", val)}
                    step={forceStep}
                  />
                </td>
                {enableCoordinates ? (
                  <td className="p-2">
                    <UnitInput
                      label="ZL Offset"
                      quantity="length"
                      value={values.zL ?? 0}
                      onChange={(val) => onChange("zL", val)}
                      step={lengthStep}
                    />
                  </td>
                ) : null}
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Optional Direct Moments Section */}
      {enableMoments ? (
        <div className="space-y-3 border-t border-slate-100 pt-2">
          <h2 className="card-title">
            <i
              className="fa-solid fa-rotate-left mr-2 text-sky-600"
              aria-hidden="true"
            />
            Applied Direct Moments
          </h2>
          <div
            className={`grid grid-cols-1 gap-2 ${
              enableZ ? "sm:grid-cols-3" : "sm:grid-cols-2"
            }`}
          >
            {enableZ ? (
              <>
                <UnitInput
                  label="Mx Bending"
                  quantity="moment"
                  value={values.Mx ?? 0}
                  onChange={(val) => onChange("Mx", val)}
                  step={momentStep}
                />
                <UnitInput
                  label="My Bending"
                  quantity="moment"
                  value={values.My ?? 0}
                  onChange={(val) => onChange("My", val)}
                  step={momentStep}
                />
              </>
            ) : null}
            <UnitInput
              label="Mz Torsion"
              quantity="moment"
              value={values.Mz ?? 0}
              onChange={(val) => onChange("Mz", val)}
              step={momentStep}
            />
          </div>
        </div>
      ) : null}
    </Card>
  );
}