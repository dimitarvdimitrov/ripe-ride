import { HeatmapTracker } from './heatmapTracker';
import { calculateDistance } from './distance';
import { Route } from './routeLoader';


/**
 * Process a route and accumulate distances into heatmap tracker
 */
export function processRoute(route: Route, heatmapTracker: HeatmapTracker): void {
  if (route.points.length < 2) return;
  
  for (let i = 1; i < route.points.length; i++) {
    const prev = route.points[i - 1];
    const curr = route.points[i];

    // Use pre-calculated values if available, otherwise calculate them
    const distance = curr.distanceFromPrev ?? calculateDistance(prev.lat, prev.lon, curr.lat, curr.lon);
    const midLat = curr.midLat ?? (prev.lat + curr.lat) / 2;
    const midLng = curr.midLon ?? (prev.lon + curr.lon) / 2;
    
    // Add this segment distance to the heatmap cell containing the midpoint
    heatmapTracker.addDistance(midLat, midLng, distance);
  }
}

/**
 * Process multiple routes and accumulate distances into heatmap tracker
 */
export function processRoutes(routes: Route[], heatmapTracker: HeatmapTracker): void {
  heatmapTracker.reset();
  
  for (const route of routes) {
    processRoute(route, heatmapTracker);
  }
}

/**
 * Get heatmap statistics using HeatmapTracker methods
 */
export function getHeatmapStats(heatmapTracker: HeatmapTracker): {
  totalCells: number;
  totalDistance: number;
} {
  return {
    totalCells: heatmapTracker.getCellCount(),
    totalDistance: heatmapTracker.getTotalDistance(),
  };
}
