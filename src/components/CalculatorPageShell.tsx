import type { ReactNode } from "react";
import { SiteHeader, type PageTab } from "./SiteHeader";
import { UnitToggle } from "./UnitToggle";

interface CalculatorPageShellProps {
    icon: string;
    title: ReactNode;
    subtitle: string;
    pageTab: PageTab;
    setPageTab: (tab: PageTab) => void;
    children: ReactNode;
}

// Shared page frame for calculator pages with calculator/theory tabs.
export function CalculatorPageShell({
    icon,
    title,
    subtitle,
    pageTab,
    setPageTab,
    children,
}: CalculatorPageShellProps) {
    return (
        <div className="flex min-h-screen flex-col bg-slate-100 text-slate-800 antialiased">
            <SiteHeader
                icon={icon}
                title={title}
                subtitle={subtitle}
                right={<UnitToggle />}
                pageTab={pageTab}
                setPageTab={setPageTab}
            />
            <main className="mx-auto w-full max-w-7xl flex-grow px-4 py-6 sm:px-6 lg:px-8">
                {children}
            </main>
        </div>
    );
}
