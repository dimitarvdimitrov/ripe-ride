import { HeatmapTracker } from './heatmapTracker';
import { calculateDistance } from './distance';
import { LoadedRoute } from './routeLoader';

export type ProcessedRoute = LoadedRoute;


/**
 * Process a route and accumulate distances into heatmap tracker
 */
export function processRoute(route: ProcessedRoute, heatmapTracker: HeatmapTracker): void {
  if (route.points.length < 2) return;
  
  for (let i = 1; i < route.points.length; i++) {
    const prev = route.points[i - 1];
    const curr = route.points[i];

    // TODO there are a few places that call calculateDistance. Let's add a field to RoutePoint which is distanceSinceStart. That way we can calculate the distance between points just a single time. Do the same for midLat and midLon. Then deduplicate the places that
    const distance = calculateDistance(prev.lat, prev.lon, curr.lat, curr.lon);
    
    // Calculate the midpoint to determine which heatmap cell this segment belongs to
    const midLat = (prev.lat + curr.lat) / 2;
    const midLng = (prev.lon + curr.lon) / 2;
    
    // Add this segment distance to the heatmap cell containing the midpoint
    heatmapTracker.addDistance(midLat, midLng, distance);
  }
}

/**
 * Process multiple routes and accumulate distances into heatmap tracker
 */
export function processRoutes(routes: ProcessedRoute[], heatmapTracker: HeatmapTracker): void {
  // Reset heatmap before processing
  heatmapTracker.reset();
  
  for (const route of routes) {
    processRoute(route, heatmapTracker);
  }
}

/**
 * Process multiple routes from simple coordinate arrays
 */
export function processMultipleRoutes(
  routes: { lat: number; lng: number }[][],
  heatmapTracker: HeatmapTracker
): void {
  // Reset heatmap before processing
  heatmapTracker.reset();
  
  for (const route of routes) {
    if (route.length < 2) continue;
    
    for (let i = 1; i < route.length; i++) {
      const prev = route[i - 1];
      const curr = route[i];
      
      const distance = calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);
      
      // Calculate the midpoint to determine which heatmap cell this segment belongs to
      const midLat = (prev.lat + curr.lat) / 2;
      const midLng = (prev.lng + curr.lng) / 2;
      
      // Add this segment distance to the heatmap cell containing the midpoint
      heatmapTracker.addDistance(midLat, midLng, distance);
    }
  }
}

/**
 * Get heatmap statistics
 */
export function getHeatmapStats(heatmapTracker: HeatmapTracker): {
  totalCells: number;
  totalDistance: number;
  averageDistance: number;
  maxDistance: number;
} {
  const allCells = heatmapTracker.getAllCells();
  const totalDistance = allCells.reduce((sum, cell) => sum + cell.distance, 0);
  const maxDistance = allCells.length > 0 ? Math.max(...allCells.map(c => c.distance)) : 0;
  
  return {
    totalCells: allCells.length,
    totalDistance,
    averageDistance: allCells.length > 0 ? totalDistance / allCells.length : 0,
    maxDistance
  };
}
