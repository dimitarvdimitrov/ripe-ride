import { useQuery } from '@tanstack/react-query';
import { type HeatmapCell } from '@/lib/heatmapTracker';

interface HeatmapAnalysis {
  heatmapConfig: {
    heatmapSizeKm: number;
    referencePoint: [number, number];
  };
  heatmapData: HeatmapCell[];
  stats: {
    totalCells: number;
    totalDistance: number;
    averageDistance: number;
    maxDistance: number;
  };
  routesProcessed: number;
}

export interface Route {
  id: string;
  name: string;
  distance: string;
  elevation: string;
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
  signal?: AbortSignal
): Promise<Route[]> {
  const params = new URLSearchParams({
    folder,
    heatmapSize: heatmapSizeKm.toString(),
    distanceMin: distanceMin.toString(),
    distanceMax: distanceMax.toString(),
    elevationMin: elevationMin.toString(),
    elevationMax: elevationMax.toString()
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
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['routes', folder, heatmapSizeKm, distanceMin, distanceMax, elevationMin, elevationMax],
    queryFn: ({ signal }) => fetchRoutes(folder, heatmapSizeKm, distanceMin, distanceMax, elevationMin, elevationMax, signal),
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
      return data;
    }
  });
}