import { useQuery } from '@tanstack/react-query';
import { type HeatmapAnalysis } from './useHeatmapAnalysis';


export interface Route {
  id: string;
  name: string;
  distance?: number; // Distance in meters, null if error
  elevation?: number; // Max elevation in meters, null if error; // TODO actually calculate elevation
  lastDone?: string;
  points: { lat: number; lon: number; elevation?: number }[];
  error?: string;
  overlapScore?: number;
  routeHeatmap?: HeatmapAnalysis;
}

async function fetchRoutes(
  folder: 'recent' | 'saved',
  heatmapSizeKm: number,
  distanceMin: number,
  distanceMax: number,
  elevationMin: number,
  elevationMax: number,
  centerLat: number,
  centerLng: number,
  signal?: AbortSignal
): Promise<Route[]> {
  const params = new URLSearchParams({
    folder,
    heatmapSize: heatmapSizeKm.toString(),
    distanceMin: distanceMin.toString(),
    distanceMax: distanceMax.toString(),
    elevationMin: elevationMin.toString(),
    elevationMax: elevationMax.toString(),
    centerLat: centerLat.toString(),
    centerLng: centerLng.toString(),
  });

  const response = await fetch(`/api/routes?${params}`, { signal });

  if (!response.ok) {
    throw new Error('Failed to fetch routes');
  }

  return response.json();
}

export function useRoutes(
  folder: 'recent' | 'saved',
  heatmapSizeKm: number,
  distanceMin: number,
  distanceMax: number,
  elevationMin: number,
  elevationMax: number,
  centerLat: number,
  centerLng: number,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['routes', folder, heatmapSizeKm, distanceMin, distanceMax, elevationMin, elevationMax, centerLat, centerLng],
    queryFn: ({ signal }) => fetchRoutes(folder, heatmapSizeKm, distanceMin, distanceMax, elevationMin, elevationMax, centerLat, centerLng, signal),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    select: (data) => {
      // Sort saved routes by overlap score (lower = more diverse)
      if (folder === 'saved') {
        return [...data].sort((a, b) => {
          const scoreA = a.overlapScore ?? 1;
          const scoreB = b.overlapScore ?? 1;
          return scoreA - scoreB;
        });
      }
      
      // Sort recent routes by date (newest first)
      if (folder === 'recent') {
        return [...data].sort((a, b) => {
          const dateA = a.lastDone ? new Date(a.lastDone).getTime() : 0;
          const dateB = b.lastDone ? new Date(b.lastDone).getTime() : 0;
          return dateB - dateA; // Newest first
        });
      }
      
      return data;
    }
  });
}
