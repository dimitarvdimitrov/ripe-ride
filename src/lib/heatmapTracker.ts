import { type HeatmapConfig } from './heatmapConfig';

export interface HeatmapCell {
  cellX: number;
  cellY: number;
  distance: number;
}

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
   * Find a specific cell by its coordinates
   * @param cellX Cell X coordinate
   * @param cellY Cell Y coordinate
   * @returns HeatmapCell if found, undefined otherwise
   */
  findCell(cellX: number, cellY: number): HeatmapCell | undefined;

  /**
   * Execute a callback for each non-empty cell
   * @param callback Function to execute for each cell
   */
  forEachNonEmpty(callback: (cell: HeatmapCell) => void): void;

  /**
   * Get total distance across all cells
   * @returns Total distance in meters
   */
  getTotalDistance(): number;

  /**
   * Get maximum distance in any cell
   * @returns Maximum distance in meters
   */
  getMaxDistance(): number;

  /**
   * Get average distance per cell (for non-empty cells)
   * @returns Average distance in meters
   */
  getAverageDistance(): number;

  /**
   * Get count of non-empty cells
   * @returns Number of cells with distance > 0
   */
  getCellCount(): number;

  /**
   * Get all heatmap cells with their distances
   * @returns Array of HeatmapCell objects
   */
  getAllCells(): HeatmapCell[];

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
  private readonly heatmapConfig: HeatmapConfig;

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

  findCell(cellX: number, cellY: number): HeatmapCell | undefined {
    const distance = this.getDistance(cellX, cellY);
    if (distance > 0) {
      return { cellX, cellY, distance };
    }
    return undefined;
  }

  forEachNonEmpty(callback: (cell: HeatmapCell) => void): void {
    this.heatmap.forEach((distance, key) => {
      if (distance > 0) {
        const [cellX, cellY] = key.split(',').map(Number);
        callback({ cellX, cellY, distance });
      }
    });
  }

  getTotalDistance(): number {
    let total = 0;
    this.forEachNonEmpty((cell) => {
      total += cell.distance;
    });
    return total;
  }

  getMaxDistance(): number {
    let max = 0;
    this.forEachNonEmpty((cell) => {
      if (cell.distance > max) {
        max = cell.distance;
      }
    });
    return max;
  }

  getAverageDistance(): number {
    const totalDistance = this.getTotalDistance();
    const cellCount = this.getCellCount();
    return cellCount > 0 ? totalDistance / cellCount : 0;
  }

  getCellCount(): number {
    let count = 0;
    this.forEachNonEmpty(() => {
      count++;
    });
    return count;
  }

  getAllCells(): HeatmapCell[] {
    const result: HeatmapCell[] = [];
    
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
