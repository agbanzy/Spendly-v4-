/**
 * Centralized chart color theme for Recharts and other visualizations.
 * Uses the new sky/cyan palette.
 */

export const chartColors = {
  primary: '#0284c7',   // sky-600
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  slate: '#64748b',
  cyan: '#06b6d4',
  teal: '#14b8a6',
  sky: '#0ea5e9',
} as const;

/** Ordered palette for pie charts, legends, and sequential data series */
export const chartPalette = [
  chartColors.primary,
  chartColors.emerald,
  chartColors.amber,
  chartColors.rose,
  chartColors.slate,
  chartColors.cyan,
  chartColors.teal,
  chartColors.sky,
];

/** Semantic mapping for common chart series */
export const chartSemantic = {
  income: chartColors.emerald,
  expense: chartColors.primary,
  net: chartColors.amber,
  inflow: chartColors.emerald,
  outflow: chartColors.rose,
  budget: chartColors.slate,
  spent: chartColors.primary,
  salary: chartColors.primary,
  bonus: chartColors.emerald,
  deductions: chartColors.rose,
} as const;

/** Gradient stop opacity presets */
export const gradientStops = {
  top: 0.3,
  bottom: 0,
} as const;
