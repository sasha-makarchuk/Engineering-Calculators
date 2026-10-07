import { useMemo } from "react";
import katex from "katex";

// Props for a LaTeX equation and optional display-mode formatting.
interface EquationProps {
  expression: string;
  display?: boolean;
}

// Render an engineering equation with KaTeX and memoize the generated markup.
export function Equation({ expression, display = true }: EquationProps) {
  const html = useMemo(
    () => katex.renderToString(expression, { displayMode: display, throwOnError: false }),
    [expression, display],
  );

  // KaTeX generates the HTML inserted into this container.
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
