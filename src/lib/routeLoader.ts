import {readdir, readFile} from 'fs/promises';
import path from 'path';
import {calculateDistance} from './distance';

export interface RoutePoint {
  lat: number;
  lon: number;
  elevation?: number;
}

export interface LoadedRoute {
  id: string;
  name: string;
  points: RoutePoint[];
  totalDistance: number;
  folder: 'recent' | 'saved';
  error?: string;
}

export interface RouteLoader {
  /**
   * Load routes from a specific folder
   */
  loadFromFolder(folder: 'recent' | 'saved'): Promise<LoadedRoute[]>;
  
  /**
   * Load routes from both folders
   */
  loadAll(): Promise<LoadedRoute[]>;
}

/**
 * Parse GPX data using XML parser
 */
function parseGPXWithXML(gpxData: string): {
  points: RoutePoint[];
  name?: string;
} {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM();
  const parser = new dom.window.DOMParser();
  
  try {
    const xmlDoc = parser.parseFromString(gpxData, 'text/xml');
    
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      throw new Error('XML parsing failed: ' + parserError.textContent);
    }
    
    const nameElement = xmlDoc.querySelector('trk > name') || xmlDoc.querySelector('metadata > name');
    const name = nameElement?.textContent || undefined;
    
    const trkptElements = xmlDoc.querySelectorAll('trkpt');
    const points: RoutePoint[] = [];
    
    trkptElements.forEach((trkpt: any) => {
      const lat = parseFloat(trkpt.getAttribute('lat') || '');
      const lon = parseFloat(trkpt.getAttribute('lon') || '');
      
      if (!isNaN(lat) && !isNaN(lon)) {
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

/**
 * Calculate total distance for a route
 */
function calculateRouteDistance(points: RoutePoint[]): number {
  let totalDistance = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    totalDistance += calculateDistance(prev.lat, prev.lon, curr.lat, curr.lon);
  }
  return totalDistance;
}

/**
 * File system based route loader
 */
export class FileSystemRouteLoader implements RouteLoader {
  private basePath: string;
  
  constructor(basePath: string = process.cwd()) {
    this.basePath = basePath;
  }
  
  async loadFromFolder(folder: 'recent' | 'saved'): Promise<LoadedRoute[]> {
    try {
      const folderPath = path.join(this.basePath, folder);
      const files = await readdir(folderPath);
      const gpxFiles = files.filter(file => file.endsWith('.gpx'));
      
      console.log(`📍 Loading ${gpxFiles.length} GPX files from ${folder}/`);

      return await Promise.all(
          gpxFiles.map(async (file) => {
            try {
              const filePath = path.join(folderPath, file);
              const gpxData = await readFile(filePath, 'utf-8');

              console.log(`📍 Parsing ${file}`);

              const parseResult = parseGPXWithXML(gpxData);
              const points = parseResult.points;

              console.log(`📍 Found ${points.length} points in ${file}`);

              if (points.length === 0) {
                return {
                  id: file.replace('.gpx', ''),
                  name: file.replace('.gpx', ''),
                  points: [],
                  totalDistance: 0,
                  folder,
                  error: 'No track points found in GPX file'
                };
              }

              const routeName = parseResult.name || file.replace('.gpx', '');
              const totalDistance = calculateRouteDistance(points);

              return {
                id: file.replace('.gpx', ''),
                name: routeName,
                points,
                totalDistance,
                folder
              };
            } catch (error: any) {
              console.error(`❌ Error parsing ${file}:`, error);
              return {
                id: file.replace('.gpx', ''),
                name: file.replace('.gpx', ''),
                points: [],
                totalDistance: 0,
                folder,
                error: `Failed to parse GPX: ${error.message}`
              };
            }
          })
      );
    } catch (error) {
      console.error(`Error reading ${folder} folder:`, error);
      return [];
    }
  }
  
  async loadAll(): Promise<LoadedRoute[]> {
    const [recentRoutes, savedRoutes] = await Promise.all([
      this.loadFromFolder('recent'),
      this.loadFromFolder('saved')
    ]);
    
    return [...recentRoutes, ...savedRoutes];
  }
}
