/**
 * Centralized chart color theme for Recharts and other visualizations.
 * Uses the Financiar burgundy palette.
 */

export const chartColors = {
  primary: '#6B2346',   // burgundy
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  slate: '#64748b',
  plum: '#8B3A5E',
  teal: '#14b8a6',
  mauve: '#A6496F',
} as const;

/** Ordered palette for pie charts, legends, and sequential data series */
export const chartPalette = [
  chartColors.primary,
  chartColors.emerald,
  chartColors.amber,
  chartColors.rose,
  chartColors.slate,
  chartColors.plum,
  chartColors.teal,
  chartColors.mauve,
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
