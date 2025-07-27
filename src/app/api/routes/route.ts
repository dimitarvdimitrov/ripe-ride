import {NextRequest, NextResponse} from 'next/server';
import {ArrayHeatmapTracker, type HeatmapCell, type HeatmapTracker} from '@/lib/heatmapTracker';
import {DEFAULT_REFERENCE_POINT, type HeatmapConfig} from '@/lib/heatmapConfig';
import {DatabaseRouteLoader} from '@/lib/databaseRouteLoader';
import {type Route as LoadedRoute} from '@/lib/routeLoader';
import {type Route as ApiRoute} from '@/hooks/useRoutes';
import {processRoute, processRoutes} from '@/lib/routeProcessor';
import {getCurrentUser} from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        // Get current user for database queries
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const {searchParams} = new URL(request.url);
        const folder = searchParams.get('folder');

        // Get filter parameters for scoring
        const heatmapSizeKm = parseFloat(searchParams.get('heatmapSize') || '5');
        const distanceMin = parseFloat(searchParams.get('distanceMin') || '0');
        const distanceMax = parseFloat(searchParams.get('distanceMax') || '200');
        const elevationMin = parseFloat(searchParams.get('elevationMin') || '0');
        const elevationMax = parseFloat(searchParams.get('elevationMax') || '2000');
        
        // Geographic filtering parameters
        const centerLat = searchParams.get('centerLat') ? parseFloat(searchParams.get('centerLat')!) : undefined;
        const centerLng = searchParams.get('centerLng') ? parseFloat(searchParams.get('centerLng')!) : undefined;
        const maxDistanceKm = parseFloat(searchParams.get('maxDistanceKm') || '200'); // Default 200km radius

        // Create shared heatmap configuration
        const heatmapConfig: HeatmapConfig = {
            heatmapSizeKm,
            referencePoint: DEFAULT_REFERENCE_POINT
        };

        if (!folder || (folder !== 'saved' && folder !== 'recent')) {
            return NextResponse.json({error: 'Invalid folder parameter'}, {status: 400});
        }

        // Use the database route loader to load routes with filters
        const routeLoader = new DatabaseRouteLoader(user.id);
        const loadedRoutes = await routeLoader.loadFromFolder(folder, {
            distanceMin,
            distanceMax,
            elevationMin,
            elevationMax,
            centerLat,
            centerLng,
            maxDistanceKm
        });

        // Convert LoadedRoute format to API response format
        const routes = loadedRoutes.map(route => {
            const maxElevation = route.points.length > 0 ? Math.max(...route.points.map(p => p.elevation || 0)) : 0;

            const result: ApiRoute = {
                id: route.id,
                name: route.name,
                distance: route.error ? undefined : route.totalDistance, // Distance in meters, undefined if error
                elevation: route.error ? undefined : maxElevation, // Elevation in meters, undefined if error
                points: route.points,
                error: route.error
            };

            // Add appropriate date field based on folder
            if (folder === 'recent') {
                result.lastDone = route.date.toISOString();
            } else if (folder === 'saved') {
                result.savedOn = route.date.toISOString();
            }

            return result;
        });

        // Calculate overlap scores for saved routes
        if (folder === 'saved') {
            console.log(`📊 Calculating overlap scores for ${routes.length} saved routes...`);

            // Generate the comprehensive heatmap once for all saved routes
            const allRoutesHeatmap = await generateRecentRoutesHeatmap(heatmapConfig, user.id);

            // Separate routes with and without errors using functional approach
            const validRoutes = routes.filter(route => !route.error && route.points.length > 0);
            const errorRoutes = routes.filter(route => route.error || route.points.length === 0);

            // Calculate overlap scores only for valid routes
            const validRoutesWithScores = await Promise.all(
                validRoutes.map(async (route) => {
                try {
                    const {
                        score,
                        routeHeatmap,
                        routeHeatmapTracker
                    } = await calculateOverlapScore(route, heatmapConfig, allRoutesHeatmap);

                    const routeHeatmapAnalysis = {
                        heatmapData: routeHeatmap,
                        stats: {
                            totalCells: routeHeatmapTracker.getCellCount(),
                            totalDistance: routeHeatmapTracker.getTotalDistance(),
                            averageDistance: routeHeatmapTracker.getAverageDistance(),
                            maxDistance: routeHeatmapTracker.getMaxDistance()
                        },
                        routesProcessed: 1
                    };

                    return {
                        ...route,
                        overlapScore: score,
                        routeHeatmap: routeHeatmapAnalysis
                    };
                } catch (error) {
                    console.error(`Error calculating overlap score for ${route.id}:`, error);
                    return {...route, overlapScore: undefined, routeHeatmap: undefined};
                }
            })
            );

            // Combine valid routes with scores and error routes without scores
            const routesWithOverlapScores = [
                ...validRoutesWithScores,
                ...errorRoutes.map(route => ({ ...route, overlapScore: undefined, routeHeatmap: undefined }))
            ];

            return NextResponse.json(routesWithOverlapScores);
        }

        // For recent routes, just return without overlap scores
        return NextResponse.json(routes);

    } catch (error) {
        console.error('Error reading routes:', error);
        return NextResponse.json({error: 'Failed to read routes'}, {status: 500});
    }
}



// Generate heatmap for a single route
function generateSingleRouteHeatmap(
    route: ApiRoute,
    heatmapConfig: HeatmapConfig
): HeatmapTracker {
    const heatmapTracker = new ArrayHeatmapTracker(heatmapConfig);

    // Convert ApiRoute to LoadedRoute for processing
    const loadedRoute: LoadedRoute = {
        id: route.id,
        name: route.name,
        points: route.points,
        totalDistance: route.distance || 0,
        folder: 'saved', // Default, not used in processing
        date: new Date(), // Default, not used in processing
        error: route.error
    };

    // Process the route using the route processor
    processRoute(loadedRoute, heatmapTracker);

    return heatmapTracker;
}

// Load and generate heatmap for all recent routes
// TODO generate this once and cache it with some TTL; regenerate when syncing with strava
async function generateRecentRoutesHeatmap(heatmapConfig: HeatmapConfig, userId: string): Promise<HeatmapTracker> {
    try {
        const heatmapTracker = new ArrayHeatmapTracker(heatmapConfig);

        // Load all recent routes using the database route loader (no filters for heatmap generation)
        const recentRoutes = await new DatabaseRouteLoader(userId).loadFromFolder('recent');

        processRoutes(recentRoutes, heatmapTracker);

        return heatmapTracker;
    } catch (error) {
        console.error('Error loading recent routes for heatmap:', error);
        // Return empty heatmap tracker on error
        return new ArrayHeatmapTracker(heatmapConfig);
    }
}

// Calculate actual overlap score by comparing single route vs all recent routes heatmap
function calculateActualOverlapScore(
    singleRouteHeatmap: HeatmapTracker,
    allRoutesHeatmap: HeatmapTracker
): number {
    let totalRouteDistance = 0;
    let weightedOverlap = 0;

    // Calculate total distance in the single route using the new iterator method
    singleRouteHeatmap.forEachNonEmpty((cell) => {
        totalRouteDistance += cell.distance;
    });

    if (totalRouteDistance === 0) {
        return 1.0; // Maximum overlap if no distance covered
    }

    // For each cell in the single route heatmap, use the new iterator method
    singleRouteHeatmap.forEachNonEmpty((cell) => {
        // Calculate the percentage this cell represents of the total route
        const cellPercentage = cell.distance / totalRouteDistance;

        // Get the coverage of this same cell in the comprehensive heatmap using findCell method
        const allRoutesCellDistance = allRoutesHeatmap.getDistance(cell.cellX, cell.cellY);

        // Weight the overlap by how much of the route passes through this cell
        // Higher allRoutesCell = more overlap in this area
        weightedOverlap += cellPercentage * allRoutesCellDistance;
    });

    // Apply logarithmic scaling to spread out the values
    return weightedOverlap;
}

// Calculate overlap score using proper heatmap analysis
async function calculateOverlapScore(
    route: ApiRoute,
    heatmapConfig: HeatmapConfig,
    allRoutesHeatmap: HeatmapTracker
): Promise<{ score: number; routeHeatmap: HeatmapCell[]; routeHeatmapTracker: HeatmapTracker }> {

    // Generate heatmap for this single route
    const singleRouteHeatmap = generateSingleRouteHeatmap(route, heatmapConfig);

    // Calculate the actual overlap score
    const score = calculateActualOverlapScore(singleRouteHeatmap, allRoutesHeatmap);

    return {
        score, 
        routeHeatmap: singleRouteHeatmap.getAllCells(),
        routeHeatmapTracker: singleRouteHeatmap
    };
}
