import {NextRequest, NextResponse} from 'next/server';
import {ArrayHeatmapTracker, type HeatmapCell} from '@/lib/heatmapTracker';
import {DEFAULT_REFERENCE_POINT, type HeatmapConfig} from '@/lib/heatmapConfig';
import {FileSystemRouteLoader, type LoadedRoute} from '@/lib/routeLoader';
import {processRoute} from '@/lib/routeProcessor';

export async function GET(request: NextRequest) {
    try {
        const {searchParams} = new URL(request.url);
        const folder = searchParams.get('folder');

        // Get filter parameters for scoring
        const heatmapSizeKm = parseFloat(searchParams.get('heatmapSize') || '5');
        const distanceMin = parseFloat(searchParams.get('distanceMin') || '0');
        const distanceMax = parseFloat(searchParams.get('distanceMax') || '200');
        const elevationMin = parseFloat(searchParams.get('elevationMin') || '0');
        const elevationMax = parseFloat(searchParams.get('elevationMax') || '2000');

        // Create shared heatmap configuration
        const heatmapConfig: HeatmapConfig = {
            heatmapSizeKm,
            referencePoint: DEFAULT_REFERENCE_POINT
        };

        if (!folder || (folder !== 'saved' && folder !== 'recent')) {
            return NextResponse.json({error: 'Invalid folder parameter'}, {status: 400});
        }

        // Use the route loader to load routes with filters
        const routeLoader = new FileSystemRouteLoader();
        const loadedRoutes = await routeLoader.loadFromFolder(folder, {
            distanceMin,
            distanceMax,
            elevationMin,
            elevationMax
        });

        // Convert LoadedRoute format to API response format
        const routes = loadedRoutes.map(route => {
            const distanceKm = route.totalDistance / 1000;
            const maxElevation = route.points.length > 0 ? Math.max(...route.points.map(p => p.elevation || 0)) : 0;

            return {
                id: route.id,
                name: route.name,
                distance: route.error ? 'Parse Error' : `${distanceKm.toFixed(1)} km`,
                elevation: route.error ? 'Parse Error' : `${Math.round(maxElevation)}m`,
                points: route.points,
                lastDone: folder === 'recent' ? getRandomRecentDate() : undefined,
                error: route.error
            };
        });

        // Calculate overlap scores for saved routes
        if (folder === 'saved') {
            console.log(`📊 Calculating overlap scores for ${routes.length} saved routes...`);

            // Generate the comprehensive heatmap once for all saved routes
            const allRoutesHeatmap = await generateRecentRoutesHeatmap(heatmapConfig);

            // Calculate overlap score for each saved route
            const routesWithOverlapScores = await Promise.all(
                routes.map(async (route) => {
                if (route.error || route.points.length === 0) {
                    return {...route, overlapScore: undefined, routeHeatmap: undefined};
                }

                try {
                    // Convert API route back to LoadedRoute format for processing
                    const loadedRoute: LoadedRoute = {
                        id: route.id,
                        name: route.name,
                        points: route.points,

                        // TODO just have a number on the API- change how the frontend uses that
                        totalDistance: parseFloat(route.distance.replace(' km', '')) * 1000, // Convert back to meters
                        folder: folder as 'recent' | 'saved',
                        // TODO don't calculate score for any routes with errors - do this in a fucntional way where we filter out routes with errors
                        error: route.error
                    };

                    const {
                        score,
                        routeHeatmap
                    } = await calculateOverlapScore(loadedRoute, heatmapConfig, allRoutesHeatmap);
                    const totalDistance = routeHeatmap.reduce((sum, cell) => sum + cell.distance, 0);
                    const maxDistance = Math.max(...routeHeatmap.map(cell => cell.distance));

                    const routeHeatmapAnalysis = {
                        heatmapData: routeHeatmap,
                        stats: {
                            totalCells: routeHeatmap.length,
                            totalDistance,
                            averageDistance: routeHeatmap.length > 0 ? totalDistance / routeHeatmap.length : 0,
                            maxDistance
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

            return NextResponse.json(routesWithOverlapScores);
        }

        // For recent routes, just return without overlap scores
        return NextResponse.json(routes);

    } catch (error) {
        console.error('Error reading routes:', error);
        return NextResponse.json({error: 'Failed to read routes'}, {status: 500});
    }
}


function getRandomRecentDate(): string {
    const dates = ['2 days ago', '1 week ago', '3 days ago', '5 days ago', '1 day ago', '4 days ago'];
    return dates[Math.floor(Math.random() * dates.length)];
}

// Generate heatmap for a single route
function generateSingleRouteHeatmap(
    route: LoadedRoute,
    heatmapConfig: HeatmapConfig
): HeatmapCell[] {
    const heatmapTracker = new ArrayHeatmapTracker(heatmapConfig);

    // Process the route using the route processor
    processRoute(route, heatmapTracker);

    return heatmapTracker.getAllCells();
}

// Load and generate heatmap for all recent routes
async function generateRecentRoutesHeatmap(heatmapConfig: HeatmapConfig): Promise<HeatmapCell[]> {
    try {

        const heatmapTracker = new ArrayHeatmapTracker(heatmapConfig);

        // Load all recent routes using the route loader (no filters for heatmap generation)
        const routeLoader = new FileSystemRouteLoader();
        const recentRoutes = await routeLoader.loadFromFolder('recent');

        // Process each recent route
        for (const route of recentRoutes) {
            if (!route.error && route.points.length > 0) {
                processRoute(route, heatmapTracker);
            }
        }

        return heatmapTracker.getAllCells();
    } catch (error) {
        console.error('Error loading recent routes for heatmap:', error);
        return [];
    }
}

// Calculate actual overlap score by comparing single route vs all recent routes heatmap
function calculateActualOverlapScore(
    singleRouteHeatmap: HeatmapCell[],
    allRoutesHeatmap: HeatmapCell[]
): number {
    if (singleRouteHeatmap.length === 0) {
        return 1.0; // Maximum overlap if route has no coverage
    }

    let totalRouteDistance = 0;
    let weightedOverlap = 0;

    // Calculate total distance in the single route
    for (const cell of singleRouteHeatmap.values()) {
        totalRouteDistance += cell.distance;
    }

    if (totalRouteDistance === 0) {
        return 1.0; // Maximum overlap if no distance covered
    }

    // For each cell in the single route heatmap
    // TODO after having made the change to use HeatmapTracker here lets have a method which returns an iterator over non-empty cells. Or perhaps has something like `eachNonEmpty(()=>{})` function
    for (const cell of singleRouteHeatmap) {
        // Calculate the percentage this cell represents of the total route
        const cellPercentage = cell.distance / totalRouteDistance;

        // Get the coverage of this same cell in the comprehensive heatmap
        // TODO add a method on HeatmapTracker which will find a cell given its x and y
        const allRoutesCell = allRoutesHeatmap.find((value) => {
            return value.cellX === cell.cellX && value.cellY === cell.cellY
        });

        // Weight the overlap by how much of the route passes through this cell
        // Higher allRoutesCell = more overlap in this area
        weightedOverlap += cellPercentage * (allRoutesCell?.distance || 0);
    }

    // Apply logarithmic scaling to spread out the values
    return weightedOverlap;
}

// Calculate overlap score using proper heatmap analysis
async function calculateOverlapScore(
    route: LoadedRoute,
    heatmapConfig: HeatmapConfig,
    allRoutesHeatmap: HeatmapCell[]
): Promise<{ score: number; routeHeatmap: HeatmapCell[] }> {

    // Generate heatmap for this single route
    const singleRouteHeatmap = generateSingleRouteHeatmap(route, heatmapConfig);

    // Calculate the actual overlap score
    const score = calculateActualOverlapScore(singleRouteHeatmap, allRoutesHeatmap);

    return {score, routeHeatmap: singleRouteHeatmap};
}
