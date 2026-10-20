import { SelectInput } from "./Dropdown";
import { SegmentedControl } from "./SegmentedControl";
import {
  DEFAULT_GRADE,
  getGrades,
  getSizes,
  type FastenerSystem,
  type ThreadSeries,
} from "../data/fasteners";
import type { JointConfig } from "../engineering/boltedJoint";

interface FastenerSelectionProps {
  fastenerSystem: FastenerSystem;
  series: ThreadSeries;
  sizeId: string;
  onFastenerSystemChange: (system: FastenerSystem) => void;
  onSeriesChange: (series: ThreadSeries) => void;
  onSizeChange: (sizeId: string) => void;
  gradeId?: string;
  onGradeChange?: (gradeId: string) => void;
  config?: JointConfig;
  onConfigChange?: (config: JointConfig) => void;
  showGrade?: boolean;
  showJointConfiguration?: boolean;
}

// Shared fastener controls used by calculators that need bolt size and thread selection.
export function FastenerSelection({
  fastenerSystem,
  series,
  sizeId,
  onFastenerSystemChange,
  onSeriesChange,
  onSizeChange,
  gradeId,
  onGradeChange,
  config,
  onConfigChange,
  showGrade = false,
  showJointConfiguration = false,
}: FastenerSelectionProps) {
  const sizes = getSizes(fastenerSystem, series);
  const commonSizes = sizes.filter((size) => size.common);
  const otherSizes = sizes.filter((size) => !size.common);
  const grades = getGrades(fastenerSystem);

  return (
    <div className="space-y-4">
      <SegmentedControl
        label="Fastener system"
        value={fastenerSystem}
        onChange={onFastenerSystemChange}
        options={[
          { value: "metric", label: "Metric bolts" },
          { value: "imperial", label: "Imperial bolts" },
        ]}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectInput
          label="Thread type"
          value={series}
          onChange={onSeriesChange}
          options={[
            { value: "coarse", label: fastenerSystem === "metric" ? "Coarse" : "Coarse (UNC)" },
            { value: "fine", label: fastenerSystem === "metric" ? "Fine" : "Fine (UNF)" },
          ]}
        />

        {showGrade ? (
          <SelectInput
            label="Material / grade"
            value={gradeId ?? DEFAULT_GRADE[fastenerSystem]}
            onChange={(value) => onGradeChange?.(value)}
            options={grades.map((grade) => ({
              value: grade.id,
              label: `${grade.label} (${grade.standard})`,
            }))}
          />
        ) : null}

        <div>
          <SelectInput
            label="Bolt size"
            value={sizeId}
            onChange={onSizeChange}
          >
            {commonSizes.length > 0 ? (
              <optgroup label="★ Common sizes">
                {commonSizes.map((size) => (
                  <option key={size.id} value={size.id}>★ {size.label}</option>
                ))}
              </optgroup>
            ) : null}
            {otherSizes.length > 0 ? (
              <optgroup label="Other sizes">
                {otherSizes.map((size) => (
                  <option key={size.id} value={size.id}>{size.label}</option>
                ))}
              </optgroup>
            ) : null}
          </SelectInput>
        </div>

        {showJointConfiguration ? (
          <div>
            <span className="label-input">Joint configuration</span>
            <div className="flex gap-4 pt-1.5 text-xs text-slate-700">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="config"
                  checked={config === "bolt_nut"}
                  onChange={() => onConfigChange?.("bolt_nut")}
                  className="accent-sky-600"
                />
                Bolt + nut
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="config"
                  checked={config === "tapped_hole"}
                  onChange={() => onConfigChange?.("tapped_hole")}
                  className="accent-sky-600"
                />
                Tapped hole
              </label>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
