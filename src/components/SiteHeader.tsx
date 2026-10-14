import type { ReactNode } from "react";

// Tabs available on calculator pages.
export type PageTab = "calc" | "theory";

// Props keep the shared header flexible between pages.
interface SiteHeaderProps {
  icon: string;
  title: ReactNode;
  subtitle: string;
  right?: ReactNode;
    children?: ReactNode;
    // Optional tab state allows existing header usages to keep working.
    pageTab?: PageTab;
    setPageTab?: (tab: PageTab) => void;
}

// Shared sticky site header used by the homepage and calculator screens.
export function SiteHeader({ icon, title, subtitle, right, children, pageTab, setPageTab }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-slate-900 text-white shadow-lg">
      <div className="mx-auto max-w-7xl px-4 pt-3 sm:px-6 lg:px-8">
        <div className="flex min-h-16 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <a href="#/" className="flex w-fit items-center space-x-3" aria-label="Engineering Calculators home">
            <div className="rounded-lg bg-sky-500 p-2 text-white">
              <i className={`${icon} text-xl`} aria-hidden="true" />
            </div>
            <div>
              <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight text-white">
                {title}
              </h1>
              <p className="text-xs text-slate-400">{subtitle}</p>
            </div>
          </a>
          {right}
          </div>

          {/* Shared calculator and theory navigation. */ }
          {
          pageTab !== undefined && setPageTab !== undefined && (
            <div className="flex space-x-1 border-t border-slate-800 pt-2" >
                {(
                    [
                        ["calc", "fa-solid fa-calculator", "Interactive Calculator"],
                        ["theory", "fa-solid fa-book-open", "Theory & References"],
                    ] as Array<[PageTab, string, string]>
                ).map(([id, iconClass, label]) => (
                    <button
                        key= { id }
                        type = "button"
                        onClick = {() => setPageTab(id)}
                        aria-current={ pageTab === id ? "page" : undefined }
                        className = {
                            pageTab === id
                            ? "flex items-center gap-2 border-b-2 border-sky-400 px-4 py-2 text-sm font-semibold text-sky-400"
                            : "flex items-center gap-2 border-b-2 border-transparent px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200"
                        }
                    >
                        <i className={ iconClass } aria-hidden="true" />
                        { label }
                    </button>
                ))}
            </div>
        )}

        {children}
      </div>
    </header>
  );
}
