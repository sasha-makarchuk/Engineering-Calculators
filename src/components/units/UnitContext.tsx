import { createContext, useContext, useMemo, useState, type PropsWithChildren } from "react";
import type { UnitSystem } from "../../engineering/units";

// Values exposed through React Context to components that need the current unit system.
interface UnitContextValue {
  unitSystem: UnitSystem;
  setUnitSystem: (system: UnitSystem) => void;
}

// Context avoids passing unit-system props through every level of the component tree.
const UnitContext = createContext<UnitContextValue | null>(null);

// Provider owns the unit state and exposes it to all child components.
export function UnitProvider({ children }: PropsWithChildren) {
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("imperial");
  const value = useMemo(() => ({ unitSystem, setUnitSystem }), [unitSystem]);

  return <UnitContext.Provider value={value}>{children}</UnitContext.Provider>;
}

// Custom hook for reading and changing the global unit system.
export function useUnitSystem() {
  const context = useContext(UnitContext);
  if (!context) throw new Error("useUnitSystem must be used inside UnitProvider");
  return context;
}
