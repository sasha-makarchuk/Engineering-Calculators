// Data model for one calculator card shown on the homepage.
export interface CalculatorCardData {
  title: string;
  description: string;
}

// Data model for one engineering category and its calculators.
export interface CategoryData {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  available: boolean;
  calculators: CalculatorCardData[];
}

// Data-driven homepage catalog so new categories/calculators can be added without rewriting layout code.
export const categories: CategoryData[] = [
  {
    id: "structural",
    title: "Structural",
    subtitle: "Beams, sections, and connection loading",
    icon: "fa-solid fa-building-columns",
    available: false,
    calculators: [
      { title: "Beam Deflection Calculator", description: "Estimate beam deflection under common loading and support conditions." },
      { title: "Section Properties Calculator", description: "Calculate area, centroid, and moments of inertia for common sections." },
      { title: "Bolt Load Calculator", description: "Review bolt loads and basic connection force distribution." },
    ],
  },
  {
    id: "welding",
    title: "Welding",
    subtitle: "Weld sizing and weld group analysis",
    icon: "fa-solid fa-helmet-safety",
    available: true,
    calculators: [
      { title: "Weld Group Strength Calculator", description: "Analyze weld group geometry, applied loads, hotspot stresses, and factor of safety." },
    ],
  },
  {
    id: "mechanical",
    title: "Mechanical",
    subtitle: "Machine components and mechanical design",
    icon: "fa-solid fa-gears",
    available: false,
    calculators: [
      { title: "Shaft Torque Calculator", description: "Calculate torque, power, and rotational speed relationships." },
      { title: "Fastener Strength Calculator", description: "Check basic fastener tensile and shear loading." },
    ],
  },
  {
    id: "units",
    title: "Unit Conversion",
    subtitle: "Common engineering units and measurements",
    icon: "fa-solid fa-right-left",
    available: false,
    calculators: [
      { title: "Unit Conversion Calculator", description: "Convert common engineering units for length, force, pressure, and more." },
    ],
  },
];
