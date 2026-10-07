// Homepage content comes from the shared category/calculator data model.
import { categories } from "../data/calculators";
import { Card } from "../components/Card";
import { SiteHeader } from "../components/SiteHeader";

// Main landing page for the calculator collection.
export function HomePage() {
  // Count available calculators for the directory summary.
  const availableCount = categories.reduce(
    (count, category) => count + (category.available ? category.calculators.length : 0),
    0,
  );

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-800 antialiased">
    { /* Shared header configured for the homepage. */ }
      <SiteHeader
        icon="fa-solid fa-calculator"
        title="Engineering Calculators"
        subtitle="Practical tools for engineering design"
        right={
          <nav aria-label="Main navigation" className="flex items-center text-xs font-medium text-slate-300">
            <a href="#/" className="text-sky-300 transition-colors hover:text-sky-200">Home</a>
          </nav>
        }
      />

      <main className="flex-grow">
        { /* Hero section introducing the purpose of the site. */ }
        <section className="relative overflow-hidden border-b border-slate-200 bg-white">
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                "linear-gradient(to right, #e2e8f0 1px, transparent 1px), linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
          <div className="relative mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 sm:py-20">
            <div className="mx-auto mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-sky-100 bg-sky-50 text-sky-700">
              <i className="fa-solid fa-compass-drafting text-2xl" aria-hidden="true" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Engineering Calculators</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-500 sm:text-base">
              A collection of practical engineering tools for design, analysis, and everyday calculations.
              Clear inputs, useful results, and transparent engineering methods.
            </p>
            <a
              href="#calculators"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700"
            >
              Explore Calculators <i className="fa-solid fa-arrow-right" aria-hidden="true" />
            </a>
          </div>
        </section>

        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          // Compact category navigation with available and coming-soon states.
          <section aria-labelledby="categories-heading" className="mb-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="categories-heading" className="text-lg font-bold text-slate-800">Categories</h2>
              <span className="text-xs text-slate-400">Browse by topic</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {categories.map((category) => (
                category.available ? (
                  <a
                    key={category.id}
                    href={`#${category.id}`}
                    className="group rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm transition-all hover:border-sky-300 hover:shadow-md"
                  >
                    <i className={`${category.icon} mb-2 text-xl text-sky-600`} aria-hidden="true" />
                    <div className="text-xs font-semibold text-slate-700 group-hover:text-sky-700">{category.title}</div>
                  </a>
                ) : (
                  <div key={category.id} className="cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 p-4 text-center opacity-60" aria-disabled="true">
                    <i className={`${category.icon} mb-2 text-xl text-slate-400`} aria-hidden="true" />
                    <div className="text-xs font-semibold text-slate-500">{category.title}</div>
                    <div className="mt-1 text-[10px] text-slate-400">Coming soon</div>
                  </div>
                )
              ))}
            </div>
          </section>

          {/* Main calculator directory generated from the category data. */}
          <section id="calculators" aria-labelledby="calculators-heading" className="scroll-mt-28">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 id="calculators-heading" className="text-lg font-bold text-slate-800">All Calculators</h2>
                <p className="mt-1 text-xs text-slate-500">Browse the tools by engineering discipline.</p>
              </div>
              <span className="text-xs text-slate-400">{availableCount} calculator available</span>
            </div>

            {categories.map((category) => (
              <section key={category.id} id={category.id} aria-labelledby={`${category.id}-heading`} className="mb-8 scroll-mt-28">
                <div className="mb-4 flex items-center gap-3">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-lg border ${category.available ? "border-sky-100 bg-sky-50 text-sky-700" : "border-slate-200 bg-slate-100 text-slate-400"}`}>
                    <i className={category.icon} aria-hidden="true" />
                  </span>
                  <div>
                    <h3 id={`${category.id}-heading`} className={`text-base font-bold ${category.available ? "text-slate-800" : "text-slate-500"}`}>{category.title}</h3>
                    <p className={`text-xs ${category.available ? "text-slate-500" : "text-slate-400"}`}>{category.subtitle}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {category.calculators.map((calculator) => (
                    <article
                      key={calculator.title}
                      className={category.available
                        ? "group flex min-h-36 flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-sky-300 hover:shadow-md"
                        : "flex min-h-36 flex-col rounded-xl border border-dashed border-slate-300 bg-white/70 p-4 opacity-60"}
                    >
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <h4 className={`text-sm font-semibold ${category.available ? "text-slate-800 group-hover:text-sky-700" : "text-slate-600"}`}>{calculator.title}</h4>
                        <span className={`shrink-0 rounded px-2 py-1 text-[10px] font-semibold ${category.available ? "border border-emerald-100 bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                          {category.available ? "Available" : "Coming soon"}
                        </span>
                      </div>
                      <p className={`flex-grow text-xs leading-relaxed ${category.available ? "text-slate-500" : "text-slate-400"}`}>{calculator.description}</p>
                      {category.available ? (
                        <a href="#/weld-strength" className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-sky-700 hover:text-sky-900">
                          Open Calculator
                          <i className="fa-solid fa-arrow-right text-[10px] transition-transform group-hover:translate-x-1" aria-hidden="true" />
                        </a>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </section>

          {/* About and engineering-use disclaimer. */}
          <section className="mx-auto mt-12 mb-2 max-w-4xl">
            <Card>
              <h2 className="mb-2 text-base font-bold text-slate-800">About Engineering Calculators</h2>
              <p className="text-xs leading-relaxed text-slate-500">
                A growing collection of engineering calculators intended to make routine design and analysis work more accessible.
                Each tool is designed to present its inputs and results clearly, with engineering methods that can be reviewed independently.
              </p>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                <strong className="text-slate-600">Disclaimer:</strong> Results are intended for preliminary estimation and should be verified with appropriate detailed calculations, applicable standards, and engineering judgment.
              </p>
            </Card>
          </section>
        </div>
      </main>

      {/* Footer with category links and general site information. */}
      <footer className="mt-auto border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            <div>
              <div className="mb-3 flex items-center space-x-2">
                <span className="rounded-md border border-sky-100 bg-sky-50 px-2 py-1 text-sky-700"><i className="fa-solid fa-calculator" aria-hidden="true" /></span>
                <span className="text-sm font-bold text-slate-800">Engineering Calculators</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-500">Practical online tools for engineering design, analysis, and calculations.</p>
            </div>
            <div>
              <h2 className="mb-3 text-xs font-bold text-slate-700">Categories</h2>
              <ul className="space-y-2 text-xs text-slate-500">
                {categories.map((category) => <li key={category.id}>{category.available ? <a href={`#${category.id}`} className="hover:text-sky-700">{category.title}</a> : <span className="text-slate-400">{category.title}</span>}</li>)}
              </ul>
            </div>
            <div>
              <h2 className="mb-3 text-xs font-bold text-slate-700">About</h2>
              <p className="text-xs leading-relaxed text-slate-500">Engineering tools with clear results and transparent methods. Always verify calculations before using them in final designs.</p>
            </div>
          </div>
          <div className="mt-7 border-t border-slate-200 pt-4 text-center text-[10px] text-slate-400">© 2026 Engineering Calculators. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
