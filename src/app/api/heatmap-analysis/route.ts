import {NextRequest, NextResponse} from 'next/server';
import {ArrayHeatmapTracker} from '@/lib/heatmapTracker';
import {getHeatmapStats, processRoutes} from '@/lib/routeProcessor';
import {createHeatmapConfig} from '@/lib/heatmapConfig';
import {FileSystemRouteLoader} from "@/lib/routeLoader";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folder = searchParams.get('folder') || 'recent';

    // Heatmap size is required
    const heatmapSizeParam = searchParams.get('heatmapSize');
    if (!heatmapSizeParam) {
      return NextResponse.json({ error: 'heatmapSize parameter is required' }, { status: 400 });
    }
    const heatmapSizeKm = parseFloat(heatmapSizeParam);
    if (heatmapSizeKm < 0.5) {
      return NextResponse.json({ error: 'heatmapSize must be at least 0.5 kilometers' }, { status: 400 });
    }
    if (heatmapSizeKm > 50) {
      return NextResponse.json({ error: 'heatmapSize cannot exceed 50 kilometers' }, { status: 400 });
    }

    console.log(`📊 Starting heatmap analysis for ${folder} routes with ${heatmapSizeKm}km heatmap`);

    // Create heatmap configuration
    const heatmapConfig = createHeatmapConfig(heatmapSizeKm);
    const heatmapTracker = new ArrayHeatmapTracker(heatmapConfig);

    try {
      const routes = await new FileSystemRouteLoader().loadFromFolder('recent')

      // Process routes and accumulate heatmap data
      processRoutes(routes, heatmapTracker);

      // Get processed data
      const heatmapData = heatmapTracker.getAllCells();
      const stats = getHeatmapStats(heatmapTracker);

      return NextResponse.json({
        heatmapData,
        stats,
        routesProcessed: routes.length
      });
    } catch (error) {
      console.error('Error in heatmap analysis:', error);
      return NextResponse.json({ error: 'Failed to analyze heatmap data' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in heatmap analysis API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
