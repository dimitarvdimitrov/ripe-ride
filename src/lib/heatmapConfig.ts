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

/**
 * Available heatmap size options for UI
 */
export const HEATMAP_SIZE_OPTIONS = [
  { value: 1, label: '1km' },
  { value: 2, label: '2km' },
  { value: 5, label: '5km' },
  { value: 10, label: '10km' },
  { value: 20, label: '20km' }
] as const;