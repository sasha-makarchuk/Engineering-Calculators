import { useEffect, useMemo, type Dispatch, type SetStateAction } from "react";
import type { UnitSystem } from "../engineering/units";

export type FormUnitConverter<T> = (
    input: T,
    fromSystem: UnitSystem,
    toSystem: UnitSystem,
) => T;

// Derive values for the selected display units and synchronize them into form state.
export function useCurrentInput<T extends { unitSystem: UnitSystem }>(
    input: T,
    setInput: Dispatch<SetStateAction<T>>,
    unitSystem: UnitSystem,
    convertForm: FormUnitConverter<T>,
): T {
    const currentInput = useMemo(
        () => input.unitSystem === unitSystem
            ? input
            : convertForm(input, input.unitSystem, unitSystem),
        [input, unitSystem, convertForm],
    );

    useEffect(() => {
        if (input.unitSystem !== unitSystem) {
            setInput(currentInput);
        }
    }, [currentInput, input.unitSystem, setInput, unitSystem]);

    return currentInput;
}
