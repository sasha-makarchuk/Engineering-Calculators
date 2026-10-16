import type { PropsWithChildren } from "react";
import { fromBase, getUnitLabel, type UnitQuantity } from "../engineering/units";

// Props for the reusable card shell; children are the content inside the card.
interface BannerProps {
    FOS: number;
    safe: boolean;
    maxValue: number;
    maxQuantity: UnitQuantity;
    hotspotLabel: string;
    system: "imperial" | "si"
    className?: string;
}

export function StatusBanner({ FOS, safe, maxValue, maxQuantity, hotspotLabel, system, className = "" }: BannerProps) {
  const Unit = getUnitLabel(maxQuantity, system);

  return (
    <div
      className={`flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
        safe
          ? "border-emerald-500/30 bg-emerald-500/10"
          : "border-red-500/30 bg-red-500/10"
      } ${className}`}
    >
      <div className="flex items-center space-x-4">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-lg text-2xl font-bold text-white ${
            safe ? "bg-emerald-500" : "bg-red-500"
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
              className={`rounded px-2 py-0.5 text-xs font-extrabold uppercase tracking-wider text-white ${
                safe ? "bg-emerald-500" : "bg-red-500"
              }`}
            >
              {safe ? "Safe Design" : "Overstressed"}
            </span>
            <span className="text-xs text-slate-500">
              Reference method • verify applicable code
            </span>
          </div>
          <h4 className="mt-0.5 text-base font-bold text-slate-800">
            Factor of Safety n = {FOS.toFixed(2)}
            {safe ? "" : " (UNSAFE)"}
          </h4>
        </div>
      </div>
      <div className="text-left font-mono sm:text-right">
        <div className="text-xs text-slate-500" >
          { hotspotLabel }
        </div>
        <div className="text-xl font-bold text-slate-900">
            { formatResultNumber(fromBase(maxValue, maxQuantity, system), 0)}{" "}
          {Unit}
        </div>
      </div>
    </div>
  );
}

function formatResultNumber(value: number, decimals = 2): string {
    return value.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}
