import { NextRequest, NextResponse } from 'next/server';
import { ArrayGridTracker, GridConfig } from '@/lib/gridTracker';
import { processRoutes, ProcessedRoute, getGridStats } from '@/lib/routeProcessor';
import { FileSystemRouteLoader } from '@/lib/routeLoader';
import { createGridConfig, DEFAULT_GRID_SIZE_KM, DEFAULT_REFERENCE_POINT } from '@/lib/gridConfig';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeRecent = searchParams.get('recent') !== 'false';
    const includeSaved = searchParams.get('saved') !== 'false';
    
    // Grid size is required
    const gridSizeParam = searchParams.get('gridSize');
    if (!gridSizeParam) {
      return NextResponse.json({ error: 'gridSize parameter is required' }, { status: 400 });
    }
    const gridSizeKm = parseFloat(gridSizeParam);
    if (isNaN(gridSizeKm) || gridSizeKm <= 0) {
      return NextResponse.json({ error: 'gridSize must be a positive number' }, { status: 400 });
    }
    
    const refLat = parseFloat(searchParams.get('refLat') || DEFAULT_REFERENCE_POINT[0].toString());
    const refLng = parseFloat(searchParams.get('refLng') || DEFAULT_REFERENCE_POINT[1].toString());
    
    // Create grid configuration from parameters
    const gridConfig = createGridConfig(gridSizeKm, [refLat, refLng]);
    const gridTracker = new ArrayGridTracker(gridConfig);
    
    // Load routes using the consolidated loader
    const routeLoader = new FileSystemRouteLoader();
    let allRoutes: ProcessedRoute[] = [];
    
    if (includeRecent && includeSaved) {
      allRoutes = await routeLoader.loadAll();
    } else {
      if (includeRecent) {
        const recentRoutes = await routeLoader.loadFromFolder('recent');
        allRoutes.push(...recentRoutes);
      }
      if (includeSaved) {
        const savedRoutes = await routeLoader.loadFromFolder('saved');
        allRoutes.push(...savedRoutes);
      }
    }
    
    // Process routes and accumulate grid data
    processRoutes(allRoutes, gridTracker);
    
    // Get results
    const gridData = gridTracker.getAllGrids();
    const stats = getGridStats(gridTracker);
    
    return NextResponse.json({
      gridConfig,
      gridData,
      stats,
      routesProcessed: allRoutes.length
    });
    
  } catch (error) {
    console.error('Error in grid analysis:', error);
    return NextResponse.json({ error: 'Failed to analyze grid data' }, { status: 500 });
  }
}

