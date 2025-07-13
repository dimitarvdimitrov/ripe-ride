/**
 * Centralized heatmap configuration
 */
export interface HeatmapConfig {
  /** Heatmap size in kilometers */
  heatmapSizeKm: number;
  /** Reference point for heatmap alignment [lat, lon] */
  referencePoint: [number, number];
}

/**
 * Default heatmap configuration values
 */
export const DEFAULT_HEATMAP_SIZE_KM = 5;
export const DEFAULT_REFERENCE_POINT: [number, number] = [52.3676, 4.9041]; // Amsterdam

/**
 * Create a heatmap configuration with defaults
 */
export function createHeatmapConfig(
  heatmapSizeKm: number = DEFAULT_HEATMAP_SIZE_KM,
  referencePoint: [number, number] = DEFAULT_REFERENCE_POINT
): HeatmapConfig {
  return {
    heatmapSizeKm,
    referencePoint
  };
}
