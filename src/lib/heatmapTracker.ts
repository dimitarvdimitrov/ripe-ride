export interface HeatmapTracker {
  /**
   * Add distance to the heatmap cell at the given coordinates
   * @param lat Latitude coordinate
   * @param lng Longitude coordinate
   * @param distance Distance in meters to add to this heatmap cell
   */
  addDistance(lat: number, lng: number, distance: number): void;

  /**
   * Get total distance for a heatmap cell
   * @param cellX Cell X coordinate
   * @param cellY Cell Y coordinate
   * @returns Total distance in meters for this cell
   */
  getDistance(cellX: number, cellY: number): number;

  /**
   * Get all heatmap cells with their distances
   * @returns Array of {cellX, cellY, distance}
   */
  getAllCells(): {cellX: number, cellY: number, distance: number}[];

  /**
   * Reset all heatmap data
   */
  reset(): void;

  /**
   * Get the raw heatmap data as a Map
   * @returns Map with cellKey -> distance
   */
  getHeatmap(): Map<string, number>;
}

export interface HeatmapConfig {
  heatmapSizeKm: number;
  referencePoint: [number, number];
}

/**
 * Convert lat/lng coordinates to heatmap coordinates
 */
export function latLngToHeatmap(
  lat: number, lng: number, heatmapConfig: HeatmapConfig
): {cellX: number, cellY: number} {
  const [refLat, refLng] = heatmapConfig.referencePoint;
  
  // Approximate conversion (assumes relatively small areas)
  const kmToLatDegrees = heatmapConfig.heatmapSizeKm / 111; // ~111km per degree latitude
  const kmToLngDegrees = heatmapConfig.heatmapSizeKm / (111 * Math.cos(refLat * Math.PI / 180));
  
  // Calculate heatmap coordinates
  const cellX = Math.floor((lng - refLng) / kmToLngDegrees);
  const cellY = Math.floor((lat - refLat) / kmToLatDegrees);
  
  return { cellX, cellY };
}

/**
 * Array-based implementation of HeatmapTracker
 * Uses a Map for efficient storage and lookup
 */
export class ArrayHeatmapTracker implements HeatmapTracker {
  private heatmap = new Map<string, number>();
  private heatmapConfig: HeatmapConfig;

  constructor(heatmapConfig: HeatmapConfig) {
    this.heatmapConfig = heatmapConfig;
  }

  private getCellKey(cellX: number, cellY: number): string {
    return `${cellX},${cellY}`;
  }

  addDistance(lat: number, lng: number, distance: number): void {
    const { cellX, cellY } = latLngToHeatmap(lat, lng, this.heatmapConfig);
    const key = this.getCellKey(cellX, cellY);
    this.heatmap.set(key, (this.heatmap.get(key) || 0) + distance);
  }

  getDistance(cellX: number, cellY: number): number {
    const key = this.getCellKey(cellX, cellY);
    return this.heatmap.get(key) || 0;
  }

  getAllCells(): {cellX: number, cellY: number, distance: number}[] {
    const result: {cellX: number, cellY: number, distance: number}[] = [];
    
    this.heatmap.forEach((distance, key) => {
      const [cellX, cellY] = key.split(',').map(Number);
      result.push({ cellX, cellY, distance });
    });
    
    return result;
  }

  reset(): void {
    this.heatmap.clear();
  }

  getHeatmap(): Map<string, number> {
    return new Map(this.heatmap);
  }

}