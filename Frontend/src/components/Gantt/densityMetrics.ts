import type { GanttDensity } from './types'

export type DensityMetrics = {
  rowHeight: number
  groupRowHeight: number
  headerHeight: number
  barHeight: number
}

// Approximate px values read off the Figma workspace-body variants; the
// design drives row height from a single CSS-variable-backed template
// rather than separate layouts per density, which this mirrors.
export const DENSITY_METRICS: Record<GanttDensity, DensityMetrics> = {
  default: { rowHeight: 48, groupRowHeight: 38, headerHeight: 44, barHeight: 22 },
  compact: { rowHeight: 40, groupRowHeight: 34, headerHeight: 40, barHeight: 18 },
  dense: { rowHeight: 32, groupRowHeight: 28, headerHeight: 36, barHeight: 14 },
}
