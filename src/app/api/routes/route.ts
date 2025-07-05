import {NextRequest, NextResponse} from 'next/server';
import {readdir, readFile} from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folder = searchParams.get('folder');
    
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
              error: 'No track points found in GPX file'
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

          return {
            id: file.replace('.gpx', ''),
            name: routeName,
            distance: `${(totalDistance / 1000).toFixed(1)} km`,
            elevation: points.length > 0 ? `${Math.round(Math.max(...points.map(p => p.elevation || 0)))}m` : '0m',
            points: points,
            lastDone: folder === 'recent' ? getRandomRecentDate() : undefined
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
            error: `Failed to parse GPX: ${error.message}`
          };
        }
      })
    );

    return NextResponse.json(routes.filter(Boolean));
  } catch (error) {
    console.error('Error reading routes:', error);
    return NextResponse.json({ error: 'Failed to read routes' }, { status: 500 });
  }
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
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
