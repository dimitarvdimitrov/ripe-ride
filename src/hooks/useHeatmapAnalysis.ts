import { useQuery } from '@tanstack/react-query';
import { type HeatmapCell } from '@/lib/heatmapTracker';

export interface HeatmapAnalysis {
  heatmapData: HeatmapCell[];
  stats: {
    totalCells: number;
    totalDistance: number;
    averageDistance: number;
    maxDistance: number;
  };
  routesProcessed?: number;
}

async function fetchHeatmapAnalysis(
  folder: 'recent' | 'saved',
  heatmapSizeKm: number,
  signal?: AbortSignal
): Promise<HeatmapAnalysis> {
  const params = new URLSearchParams({
    folder,
    heatmapSize: heatmapSizeKm.toString()
  });

  const response = await fetch(`/api/heatmap-analysis?${params}`, { signal });

  if (!response.ok) {
    throw new Error('Failed to fetch heatmap analysis');
  }

  return response.json();
}

export function useHeatmapAnalysis(
  folder: 'recent' | 'saved',
  heatmapSizeKm: number,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['heatmap-analysis', folder, heatmapSizeKm],
    queryFn: ({ signal }) => fetchHeatmapAnalysis(folder, heatmapSizeKm, signal),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}