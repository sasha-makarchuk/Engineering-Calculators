interface MetricTileProps {
  label: string;
  value: string;
  sub?: string;
  align?: "left" | "center";
}

// Shared compact result tile used by the calculator pages.
export function MetricTile({ label, value, sub, align = "left" }: MetricTileProps) {
  const alignmentClass = align === "center" ? "text-center" : "text-left";

  return (
    <div className={`rounded-lg border border-slate-100 bg-slate-50 p-2.5 ${alignmentClass}`}>
      <div className="font-sans text-[11px] text-slate-500">{label}</div>
      <div className="mt-0.5 font-mono text-sm font-bold text-slate-800">{value}</div>
      {sub ? <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div> : null}
    </div>
  );
}
