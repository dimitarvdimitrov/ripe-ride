import { NextRequest, NextResponse } from 'next/server';
import { ArrayHeatmapTracker } from '@/lib/heatmapTracker';
import { processMultipleRoutes, getHeatmapStats } from '@/lib/routeProcessor';
import { readdir, readFile } from 'fs/promises';
import { createHeatmapConfig } from '@/lib/heatmapConfig';
import path from 'path';

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

    // Read GPX files from the specified folder
    const folderPath = path.join(process.cwd(), folder);
    
    try {
      const files = await readdir(folderPath);
      const gpxFiles = files.filter(file => file.endsWith('.gpx'));
      
      console.log(`📂 Found ${gpxFiles.length} GPX files in ${folder}/`);
      
      const routes = [];
      
      for (const file of gpxFiles) {
        try {
          const filePath = path.join(folderPath, file);
          const gpxData = await readFile(filePath, 'utf-8');
          
          // Basic GPX parsing to extract coordinates
          const coordinates = extractCoordinatesFromGPX(gpxData);
          if (coordinates.length > 0) {
            routes.push(coordinates);
          }
        } catch (error) {
          console.error(`❌ Error reading ${file}:`, error);
        }
      }

      // Process routes and accumulate heatmap data
      processMultipleRoutes(routes, heatmapTracker);

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

function extractCoordinatesFromGPX(gpxData: string): { lat: number; lng: number }[] {
  const coordinates: { lat: number; lng: number }[] = [];
  
  // Simple regex-based parsing for track points
  const trkptRegex = /<trkpt[^>]+lat="([^"]+)"[^>]+lon="([^"]+)"/g;
  let match;
  
  while ((match = trkptRegex.exec(gpxData)) !== null) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    
    if (!isNaN(lat) && !isNaN(lng)) {
      coordinates.push({ lat, lng });
    }
  }
  
  return coordinates;
}
