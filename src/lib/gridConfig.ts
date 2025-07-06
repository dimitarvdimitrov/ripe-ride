/**
 * Centralized grid configuration
 */
export interface GridConfig {
  /** Grid size in kilometers */
  gridSizeKm: number;
  /** Reference point for grid alignment [lat, lon] */
  referencePoint: [number, number];
}

/**
 * Default grid configuration values
 */
export const DEFAULT_GRID_SIZE_KM = 5;
export const DEFAULT_REFERENCE_POINT: [number, number] = [52.3676, 4.9041]; // Amsterdam

/**
 * Create a grid configuration with defaults
 */
export function createGridConfig(
  gridSizeKm: number = DEFAULT_GRID_SIZE_KM,
  referencePoint: [number, number] = DEFAULT_REFERENCE_POINT
): GridConfig {
  return {
    gridSizeKm,
    referencePoint
  };
}

/**
 * Available grid size options for UI
 */
export const GRID_SIZE_OPTIONS = [
  { value: 1, label: '1km' },
  { value: 2, label: '2km' },
  { value: 5, label: '5km' },
  { value: 10, label: '10km' },
  { value: 20, label: '20km' }
] as const;