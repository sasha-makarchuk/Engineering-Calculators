import { fromBase, getUnitLabel, type UnitQuantity } from "../engineering/units";

// Props for the shared factor-of-safety banner and its optional right-side result.
interface BannerProps {
  FOS: number;
  minimumFos?: number;
  maxValue?: number;
  maxQuantity?: UnitQuantity;
  hotspotLabel?: string;
  rightTitle?: string;
  rightText?: string;
  system: "imperial" | "si"
  className?: string;
}

export function StatusBanner({ FOS, minimumFos = 1.5, maxValue, maxQuantity, hotspotLabel, rightTitle, rightText, system, className = "" }: BannerProps) {
  const Unit = maxQuantity ? getUnitLabel(maxQuantity, system) : "";
  const status = FOS < 1 ? "overstressed" : FOS < minimumFos ? "warning" : "safe";
  const safe = status === "safe";
  const statusColor = safe ? "emerald" : status === "warning" ? "amber" : "red";

  return (
    <div
      className={`flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${statusColor === "emerald"
        ? "border-emerald-500/30 bg-emerald-500/10"
        : statusColor === "amber"
          ? "border-amber-500/30 bg-amber-500/10"
          : "border-red-500/30 bg-red-500/10"
        } ${className}`}
    >
      <div className="flex items-center space-x-4">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-lg text-2xl font-bold text-white ${statusColor === "emerald" ? "bg-emerald-500" : statusColor === "amber" ? "bg-amber-500" : "bg-red-500"
            }`}
        >
          <i
            className={
              safe
                ? "fa-solid fa-check"
                : "fa-solid fa-triangle-exclamation"
            }
            aria-hidden="true"
          />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded px-2 py-0.5 text-xs font-extrabold uppercase tracking-wider text-white ${statusColor === "emerald" ? "bg-emerald-500" : statusColor === "amber" ? "bg-amber-500" : "bg-red-500"
                }`}
            >
              {status === "safe" ? "Safe Design" : status === "warning" ? "Warning" : "Overstressed"}
            </span>
          </div>
          <h4 className="mt-0.5 text-base font-bold text-slate-800">
            FOS = {FOS.toFixed(2)}
            {status === "overstressed" ? " (OVERSTRESSED)" : status === "warning" ? " (BELOW TARGET)" : ""}
          </h4>
        </div>
      </div>
      <div className="text-left font-mono sm:text-right">
        <div className="text-xs text-slate-500">
          {rightTitle ?? hotspotLabel}
        </div>
        <div className={rightText ? "text-sm font-bold text-slate-900" : "text-xl font-bold text-slate-900"}>
          {rightText ?? (maxValue !== undefined && maxQuantity
            ? <>{formatResultNumber(fromBase(maxValue, maxQuantity, system), 0)} {Unit}</>
            : null)}
        </div>
      </div>
    </div>
  );
}

function formatResultNumber(value: number, decimals = 2): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}
