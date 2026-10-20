interface SegmentedControlProps<T extends string> {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  label?: string;
}

// Shared compact control for choosing one option from a short set.
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
}: SegmentedControlProps<T>) {
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
