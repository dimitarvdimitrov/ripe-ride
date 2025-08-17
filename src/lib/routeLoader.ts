import {readdir, readFile} from 'fs/promises';
import path from 'path';
import {calculateDistance} from './distance';

export interface RoutePoint {
    lat: number;
    lon: number;
    elevation?: number;
    distanceSinceStart?: number; // Cumulative distance from route start in meters
    distanceFromPrev?: number; // Distance from previous point in meters
    midLat?: number; // Midpoint latitude between this and previous point
    midLon?: number; // Midpoint longitude between this and previous point
}

export interface Route {
    id: string;
    name: string;
    points: RoutePoint[];
    totalDistance: number;
    folder: 'recent' | 'saved';
    date: Date;
    error?: string;
}

export interface RouteFilters {
    distanceMin?: number;
    distanceMax?: number;
    elevationMin?: number;
    elevationMax?: number;
    centerLat?: number;
    centerLng?: number;
    maxDistanceKm?: number; // TODO rename to maxDistanceFromCenter
}

export interface RouteLoader {
    /**
     * Load routes from a specific folder
     */
    loadFromFolder(folder: 'recent' | 'saved', filters?: RouteFilters): Promise<Route[]>;

    /**
     * Load routes from both folders
     */
    loadAll(filters?: RouteFilters): Promise<Route[]>;
}

/**
 * Parse GPX data using XML parser
 */
export async function parseGPXWithXML(gpxData: string): Promise<{
    points: RoutePoint[];
    name?: string;
    date?: Date;
}> {
    const {JSDOM} = await import('jsdom');
    const dom = new JSDOM();
    const parser = new dom.window.DOMParser();

    try {
        const xmlDoc = parser.parseFromString(gpxData, 'application/xml');

        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
            throw new Error('XML parsing failed: ' + parserError.textContent);
        }

        const nameElement = xmlDoc.querySelector('trk > name') || xmlDoc.querySelector('metadata > name');
        const name = nameElement?.textContent || undefined;

        const timeElement = xmlDoc.querySelector('metadata > time');
        const date = timeElement?.textContent ? new Date(timeElement.textContent) : undefined;

        const trkptElements = xmlDoc.querySelectorAll('trkpt');
        const points: RoutePoint[] = [];

        trkptElements.forEach((trkpt: Element) => {
            const lat = parseFloat(trkpt.getAttribute('lat') || '');
            const lon = parseFloat(trkpt.getAttribute('lon') || '');

            if (!isNaN(lat) && !isNaN(lon)) {
                const eleElement = trkpt.querySelector('ele');
                const elevation = eleElement ? parseFloat(eleElement.textContent || '0') : undefined;

                points.push({lat, lon, elevation});
            }
        });

        return {points, name, date};
    } catch (error) {
        console.error('XML parsing error:', error);
        return {points: [], date: undefined};
    }
}

/**
 * Calculate total distance for a route and populate distance/midpoint fields
 */
function calculateRouteDistance(points: RoutePoint[]): number {
    let totalDistance = 0;

    for (let i = 0; i < points.length; i++) {
        if (i === 0) {
            // First point
            points[i].distanceSinceStart = 0;
            points[i].distanceFromPrev = 0;
            points[i].midLat = undefined;
            points[i].midLon = undefined;
        } else {
            // Calculate distance from previous point
            const prev = points[i - 1];
            const curr = points[i];
            const segmentDistance = calculateDistance(prev.lat, prev.lon, curr.lat, curr.lon);

            totalDistance += segmentDistance;

            // Populate calculated fields
            curr.distanceSinceStart = totalDistance;
            curr.distanceFromPrev = segmentDistance;
            curr.midLat = (prev.lat + curr.lat) / 2;
            curr.midLon = (prev.lon + curr.lon) / 2;
        }
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

    // TODO instead of passing folder name have two methods - loadRecentRoutes and loadSavedRoutes
    async loadFromFolder(folder: 'recent' | 'saved', filters?: RouteFilters): Promise<Route[]> {
        try {
            const folderPath = path.join(this.basePath, folder);
            const files = await readdir(folderPath);
            const gpxFiles = files.filter(file => file.endsWith('.gpx'));

            console.log(`📍 Loading ${gpxFiles.length} GPX files from ${folder}/`);

            const routes = await Promise.all(
                gpxFiles.map(async (file) => {
                    try {
                        const filePath = path.join(folderPath, file);
                        const gpxData = await readFile(filePath, 'utf-8');

                        console.log(`📍 Parsing ${file}`);

                        const parseResult = await parseGPXWithXML(gpxData);
                        const points = parseResult.points;

                        console.log(`📍 Found ${points.length} points in ${file}`);

                        // Handle missing date at the folder level
                        const routeDate = parseResult.date || new Date();

                        if (points.length === 0) {
                            return {
                                id: file.replace('.gpx', ''),
                                name: file.replace('.gpx', ''),
                                points: [],
                                totalDistance: 0,
                                folder,
                                date: routeDate,
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
                            folder,
                            date: routeDate
                        };
                    } catch (error: unknown) {
                        console.error(`❌ Error parsing ${file}:`, error);
                        return {
                            id: file.replace('.gpx', ''),
                            name: file.replace('.gpx', ''),
                            points: [],
                            totalDistance: 0,
                            folder,
                            date: new Date(), // Fallback to current date on error
                            error: `Failed to parse GPX: ${error instanceof Error ? error.message : 'Unknown error'}`
                        };
                    }
                })
            );

            // Apply filters if provided
            if (filters) {
                return routes.filter(route => {
                    if (route.error) return true; // Keep error routes for debugging

                    const distanceKm = route.totalDistance / 1000;
                    const maxElevation = route.points.length > 0 ? Math.max(...route.points.map(p => p.elevation || 0)) : 0;

                    // Apply distance filter
                    if (filters.distanceMin !== undefined && distanceKm < filters.distanceMin) return false;
                    if (filters.distanceMax !== undefined && distanceKm > filters.distanceMax) return false;

                    // Apply elevation filter
                    if (filters.elevationMin !== undefined && maxElevation < filters.elevationMin) return false;
                    if (filters.elevationMax !== undefined && maxElevation > filters.elevationMax) return false;

                    // Apply geographic filter (distance from center point)
                    if (filters.centerLat !== undefined && filters.centerLng !== undefined && filters.maxDistanceKm !== undefined) {
                        if (route.points.length > 0) {
                            const startPoint = route.points[0];
                            const distanceToStart = calculateDistance(
                                filters.centerLat,
                                filters.centerLng,
                                startPoint.lat,
                                startPoint.lon
                            );
                            const distanceToStartKm = distanceToStart / 1000;

                            if (distanceToStartKm > filters.maxDistanceKm) return false;
                        }
                    }

                    return true;
                });
            }

            return routes;
        } catch (error) {
            console.error(`Error reading ${folder} folder:`, error);
            return [];
        }
    }

    async loadAll(filters?: RouteFilters): Promise<Route[]> {
        const [recentRoutes, savedRoutes] = await Promise.all([
            this.loadFromFolder('recent', filters),
            this.loadFromFolder('saved', filters)
        ]);

        return [...recentRoutes, ...savedRoutes];
    }
}
