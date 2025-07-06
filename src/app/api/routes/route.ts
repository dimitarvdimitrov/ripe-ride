import {NextRequest, NextResponse} from 'next/server';
import {readdir, readFile} from 'fs/promises';
import path from 'path';
import { calculateDistance } from '@/lib/distance';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folder = searchParams.get('folder');
    
    // Get filter parameters for scoring
    const heatmapSizeKm = parseFloat(searchParams.get('heatmapSize') || '5');
    const distanceMin = parseFloat(searchParams.get('distanceMin') || '0');
    const distanceMax = parseFloat(searchParams.get('distanceMax') || '200');
    const elevationMin = parseFloat(searchParams.get('elevationMin') || '0');
    const elevationMax = parseFloat(searchParams.get('elevationMax') || '2000');
    
    if (!folder || (folder !== 'saved' && folder !== 'recent')) {
      return NextResponse.json({ error: 'Invalid folder parameter' }, { status: 400 });
    }

    const folderPath = path.join(process.cwd(), folder);
    const files = await readdir(folderPath);
    const gpxFiles = files.filter(file => file.endsWith('.gpx'));

    const routes = await Promise.all(
      gpxFiles.map(async (file) => {
        try {
          const filePath = path.join(folderPath, file);
          const gpxData = await readFile(filePath, 'utf-8');
          
          console.log(`📍 Parsing ${file}`);
          
          // Parse GPX data using XML parser
          const parseResult = parseGPXWithXML(gpxData);
          const points = parseResult.points;
          console.log(`📍 Found ${points.length} points in ${file}`);
          
          if (points.length === 0) {
            return {
              id: file.replace('.gpx', ''),
              name: file.replace('.gpx', ''),
              distance: 'No Points',
              elevation: 'No Points',
              points: [],
              lastDone: folder === 'recent' ? getRandomRecentDate() : undefined,
              error: 'No track points found in GPX file',
              overlapScore: undefined
            };
          }
          
          // Use extracted name or fallback to filename
          const routeName = parseResult.name || file.replace('.gpx', '');
          
          // Calculate total distance
          let totalDistance = 0;
          for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            totalDistance += calculateDistance(prev.lat, prev.lon, curr.lat, curr.lon);
          }

          // Calculate overlap score for saved routes
          const distanceKm = totalDistance / 1000;
          const maxElevation = points.length > 0 ? Math.max(...points.map(p => p.elevation || 0)) : 0;

          return {
            id: file.replace('.gpx', ''),
            name: routeName,
            distance: `${distanceKm.toFixed(1)} km`,
            elevation: points.length > 0 ? `${Math.round(maxElevation)}m` : '0m',
            points: points,
            lastDone: folder === 'recent' ? getRandomRecentDate() : undefined,
          };
        } catch (error) {
          console.error(`❌ Error parsing ${file}:`, error);
          return {
            id: file.replace('.gpx', ''),
            name: file.replace('.gpx', ''),
            distance: 'Parse Error',
            elevation: 'Parse Error',
            points: [],
            lastDone: folder === 'recent' ? getRandomRecentDate() : undefined,
            error: `Failed to parse GPX: ${error.message}`,
            overlapScore: undefined
          };
        }
      })
    );

    // Filter routes based on distance and elevation criteria
    const filteredRoutes = routes.filter(route => {
      if (!route || route.error) return true; // Keep error routes for debugging
      
      // Parse distance and elevation values
      const distanceMatch = route.distance.match(/([\d.]+)\s*km/);
      const elevationMatch = route.elevation.match(/([\d.]+)m/);
      
      if (!distanceMatch || !elevationMatch) return true; // Keep unparseable routes
      
      const routeDistance = parseFloat(distanceMatch[1]);
      const routeElevation = parseFloat(elevationMatch[1]);
      
      // Apply filters
      const distanceInRange = routeDistance >= distanceMin && routeDistance <= distanceMax;
      const elevationInRange = routeElevation >= elevationMin && routeElevation <= elevationMax;
      
      return distanceInRange && elevationInRange;
    });

    return NextResponse.json(filteredRoutes);
  } catch (error) {
    console.error('Error reading routes:', error);
    return NextResponse.json({ error: 'Failed to read routes' }, { status: 500 });
  }
}


function parseGPXWithXML(gpxData: string): {
  points: { lat: number; lon: number; elevation?: number }[];
  name?: string;
} {
  // For Node.js, we need to use a different XML parser
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM();
  const parser = new dom.window.DOMParser();
  
  try {
    const xmlDoc = parser.parseFromString(gpxData, 'text/xml');
    
    // Check for parsing errors
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      throw new Error('XML parsing failed: ' + parserError.textContent);
    }
    
    // Extract route name
    const nameElement = xmlDoc.querySelector('trk > name') || xmlDoc.querySelector('metadata > name');
    const name = nameElement?.textContent || undefined;
    
    // Extract track points
    const trkptElements = xmlDoc.querySelectorAll('trkpt');
    const points: { lat: number; lon: number; elevation?: number }[] = [];
    
    trkptElements.forEach(trkpt => {
      const lat = parseFloat(trkpt.getAttribute('lat') || '');
      const lon = parseFloat(trkpt.getAttribute('lon') || '');
      
      if (!isNaN(lat) && !isNaN(lon)) {
        // Try to get elevation
        const eleElement = trkpt.querySelector('ele');
        const elevation = eleElement ? parseFloat(eleElement.textContent || '0') : undefined;
        
        points.push({ lat, lon, elevation });
      }
    });
    
    return { points, name };
  } catch (error) {
    console.error('XML parsing error:', error);
    return { points: [] };
  }
}

function getRandomRecentDate(): string {
  const dates = ['2 days ago', '1 week ago', '3 days ago', '5 days ago', '1 day ago', '4 days ago'];
  return dates[Math.floor(Math.random() * dates.length)];
}
