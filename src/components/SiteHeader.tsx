import type { ReactNode } from "react";

// Props keep the shared header flexible between pages.
interface SiteHeaderProps {
  icon: string;
  title: ReactNode;
  subtitle: string;
  right?: ReactNode;
  children?: ReactNode;
}

// Shared sticky site header used by the homepage and calculator screens.
export function SiteHeader({ icon, title, subtitle, right, children }: SiteHeaderProps) {
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
        {children}
      </div>
    </header>
  );
}
