import type { ReactNode } from "react";

export interface DiagramLegendItem {
    label: string;
    colorClassName: string;
    swatch?: "dot" | "line" | "gradient";
}

interface DiagramPanelProps {
    title: string;
    legend?: DiagramLegendItem[];
    children: ReactNode;
}

// Shared dark frame for engineering diagrams, with optional color-key legend.
export function DiagramPanel({ title, legend = [], children }: DiagramPanelProps) {
    return (
        <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
                <div className="flex items-center">
                    <h3 className="text-xs font-mono uppercase tracking-wider text-slate-300">
                        {title}
                    </h3>
                </div>
                {legend.length > 0 ? (
                    <div className="hidden items-center space-x-3 text-[11px] font-mono text-slate-400 sm:flex">
                        {legend.map(({ label, colorClassName, swatch = "dot" }) => (
                            <span key={label}>
                                <span
                                    className={`mr-1 inline-block shrink-0 ${swatch === "line"
                                        ? "h-0.5 w-4"
                                        : swatch === "gradient"
                                            ? "h-2.5 w-5 rounded-sm"
                                            : "h-2.5 w-2.5 rounded-full"
                                        } ${colorClassName}`}
                                />
                                {label}
                            </span>
                        ))}
                    </div>
                ) : null}
            </div>
            <div className="diagram-grid-background flex justify-center p-4">{children}</div>
        </section>
    );
}
