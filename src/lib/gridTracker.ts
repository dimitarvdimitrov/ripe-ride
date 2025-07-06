export interface GridTracker {
  /**
   * Add distance to the grid square containing the given point
   * @param point Point [lat, lon]
   * @param distance Distance in meters to add to this grid square
   */
  addDistance(point: [number, number], distance: number): void;
  
  /**
   * Get total distance for a grid square
   * @param gridX Grid X coordinate
   * @param gridY Grid Y coordinate
   * @returns Total distance in meters
   */
  getDistance(gridX: number, gridY: number): number;
  
  /**
   * Get all grid squares with their distances
   * @returns Array of {gridX, gridY, distance} objects
   */
  getAllGrids(): Array<{gridX: number, gridY: number, distance: number}>;
  
  /**
   * Reset all grid data
   */
  reset(): void;
}

export type { GridConfig } from './gridConfig';

/**
 * Convert lat/lng coordinates to grid coordinates
 */
export function latLngToGrid(lat: number, lng: number, config: GridConfig): {gridX: number, gridY: number} {
  const [refLat, refLng] = config.referencePoint;
  
  // Convert km to degrees
  const kmToLatDegrees = config.gridSizeKm / 111;
  const kmToLngDegrees = config.gridSizeKm / (111 * Math.cos(refLat * Math.PI / 180));
  
  // Calculate grid coordinates (can be negative)
  const gridX = Math.floor((lng - refLng) / kmToLngDegrees);
  const gridY = Math.floor((lat - refLat) / kmToLatDegrees);

  return { gridX, gridY };
}

/**
 * Array-based implementation of GridTracker
 */
export class ArrayGridTracker implements GridTracker {
  private grid: Map<string, number> = new Map();
  private readonly config: GridConfig;
  
  constructor(config: GridConfig) {
    this.config = config;
  }
  
  private getGridKey(gridX: number, gridY: number): string {
    return `${gridX},${gridY}`;
  }
  
  addDistance(point: [number, number], distance: number): void {
    const { gridX, gridY } = latLngToGrid(point[0], point[1], this.config);
    const key = this.getGridKey(gridX, gridY);
    
    const currentDistance = this.grid.get(key) || 0;
    this.grid.set(key, currentDistance + distance);
  }
  
  getDistance(gridX: number, gridY: number): number {
    const key = this.getGridKey(gridX, gridY);
    return this.grid.get(key) || 0;
  }
  
  getAllGrids(): Array<{gridX: number, gridY: number, distance: number}> {
    const result: Array<{gridX: number, gridY: number, distance: number}> = [];
    
    for (const [key, distance] of this.grid.entries()) {
      const [gridX, gridY] = key.split(',').map(Number);
      result.push({ gridX, gridY, distance });
    }
    
    return result.sort((a, b) => b.distance - a.distance); // Sort by distance descending
  }
  
  reset(): void {
    this.grid.clear();
  }
}
