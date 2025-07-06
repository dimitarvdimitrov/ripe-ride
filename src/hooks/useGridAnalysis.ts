import { useQuery } from '@tanstack/react-query';

export interface GridData {
  gridX: number;
  gridY: number;
  distance: number;
}

export interface GridAnalysis {
  gridConfig: {
    gridSizeKm: number;
    referencePoint: [number, number];
  };
  gridData: GridData[];
  stats: {
    totalGrids: number;
    totalDistance: number;
    averageDistance: number;
    maxDistance: number;
  };
  routesProcessed: number;
}

async function fetchGridAnalysis(
  folder: 'recent' | 'saved', 
  gridSizeKm: number,
  signal?: AbortSignal
): Promise<GridAnalysis> {
  const includeRecent = folder === 'recent' ? 'true' : 'false';
  const includeSaved = folder === 'saved' ? 'true' : 'false';
  
  const response = await fetch(
    `/api/grid-analysis?recent=${includeRecent}&saved=${includeSaved}&gridSize=${gridSizeKm}`,
    { signal }
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch grid analysis');
  }
  
  return response.json();
}

export function useGridAnalysis(
  folder: 'recent' | 'saved',
  gridSizeKm: number,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['grid-analysis', folder, gridSizeKm],
    queryFn: ({ signal }) => fetchGridAnalysis(folder, gridSizeKm, signal),
    enabled,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}
