import { GridTracker } from './gridTracker';
import { calculateDistance } from './distance';
import { LoadedRoute } from './routeLoader';

export type ProcessedRoute = LoadedRoute;


/**
 * Process a route and accumulate distances into grid tracker
 */
export function processRoute(route: ProcessedRoute, gridTracker: GridTracker): void {
  if (route.points.length < 2) return;
  
  for (let i = 1; i < route.points.length; i++) {
    const prev = route.points[i - 1];
    const curr = route.points[i];
    
    const distance = calculateDistance(prev.lat, prev.lon, curr.lat, curr.lon);
    
    // Calculate the midpoint to determine which grid square this segment belongs to
    const midLat = (prev.lat + curr.lat) / 2;
    const midLng = (prev.lon + curr.lon) / 2;
    
    // Add this segment distance to the grid containing the midpoint
    gridTracker.addDistance([midLat, midLng], distance);
  }
}

/**
 * Process multiple routes and accumulate distances into grid tracker
 */
export function processRoutes(routes: ProcessedRoute[], gridTracker: GridTracker): void {
  // Reset grid before processing
  gridTracker.reset();
  
  for (const route of routes) {
    processRoute(route, gridTracker);
  }
}

/**
 * Get grid statistics
 */
export function getGridStats(gridTracker: GridTracker): {
  totalGrids: number;
  totalDistance: number;
  averageDistance: number;
  maxDistance: number;
} {
  const allGrids = gridTracker.getAllGrids();
  const totalDistance = allGrids.reduce((sum, grid) => sum + grid.distance, 0);
  const maxDistance = allGrids.length > 0 ? allGrids[0].distance : 0; // Already sorted by distance desc
  
  return {
    totalGrids: allGrids.length,
    totalDistance,
    averageDistance: allGrids.length > 0 ? totalDistance / allGrids.length : 0,
    maxDistance
  };
}
