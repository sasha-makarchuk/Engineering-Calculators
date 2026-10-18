import type { ReactNode } from "react";
import { Equation } from "./Equation";

interface TheorySectionProps {
    title: string;
    description?: ReactNode;
    children?: ReactNode;
}

interface TheoryPanelProps {
    label?: string;
    children: ReactNode;
}

export type TheoryNomenclatureEntry = readonly [symbol: string, description: string];
export type TheoryReferenceEntry = readonly [title: string, description: string];

// Shared heading and description layout for a theory section on calculator pages.
export function TheorySection({ title, description, children }: TheorySectionProps) {
    return (
        <section className="space-y-2">
            <h3 className="text-sm font-bold text-slate-800">{title}</h3>
            {description ? <p className="text-xs leading-relaxed text-slate-600">{description}</p> : null}
            {children}
        </section>
    );
}

// Shared surface for equations and other theory content.
export function TheoryPanel({ label, children }: TheoryPanelProps) {
    return (
        <div className="space-y-1 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-center font-mono text-sm">
            {label ? (
                <div className="mb-1 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    {label}
                </div>
            ) : null}
            {children}
        </div>
    );
}

// Shared nomenclature list; symbols are rendered as inline KaTeX expressions.
export function TheoryNomenclature({ entries }: { entries: readonly TheoryNomenclatureEntry[] }) {
    return (
        <div className="grid grid-cols-1 gap-x-6 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-2">
            {entries.map(([symbol, description]) => (
                <div key={symbol} className="flex items-start gap-3">
                    <div className="w-28 shrink-0 font-semibold text-slate-700">
                        <Equation expression={symbol} display={false} />
                    </div>
                    <span className="text-slate-600">{description}</span>
                </div>
            ))}
        </div>
    );
}

// Shared reference cards used in both calculator theory sections.
export function TheoryReferences({ entries }: { entries: readonly TheoryReferenceEntry[] }) {
    return (
        <ul className="space-y-2 text-xs text-slate-600">
            {entries.map(([title, description]) => (
                <li key={title} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <div className="font-semibold text-slate-800">{title}</div>
                    <div className="mt-0.5 text-slate-500">{description}</div>
                </li>
            ))}
        </ul>
    );
}
