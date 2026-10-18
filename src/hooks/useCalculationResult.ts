import { useMemo } from "react";

export interface CalculationResult<TResult> {
    result: TResult | null;
    error: string | null;
}

// Run a calculation when its input changes and normalize thrown errors for UI display.
export function useCalculationResult<TInput, TResult>(
    input: TInput,
    calculate: (input: TInput) => TResult,
): CalculationResult<TResult> {
    return useMemo(() => {
        try {
            return { result: calculate(input), error: null };
        } catch (error) {
            return {
                result: null,
                error: error instanceof Error ? error.message : "Unable to calculate.",
            };
        }
    }, [input, calculate]);
}
