import { useUnitSystem } from "./units/UnitContext";

// Global SI/Imperial toggle shared by calculator pages.
export function UnitToggle() {
  const { unitSystem, setUnitSystem } = useUnitSystem();

  // Tailwind class sets for active and inactive buttons.
  const selected = "rounded-md bg-sky-600 px-3 py-1 font-medium text-white transition-all";
  const unselected = "rounded-md px-3 py-1 font-medium text-slate-400 transition-all hover:text-white";

  // Button clicks update the shared unit system through React Context.
  return (
    <div className="flex items-center rounded-lg border border-slate-700 bg-slate-800 p-1 text-xs">
      <button
        type="button"
        onClick={() => setUnitSystem("imperial")}
        className={unitSystem === "imperial" ? selected : unselected}
      >
        US Customary
      </button>
      <button
        type="button"
        onClick={() => setUnitSystem("si")}
        className={unitSystem === "si" ? selected : unselected}
      >
        SI Metric
      </button>
    </div>
  );
}
