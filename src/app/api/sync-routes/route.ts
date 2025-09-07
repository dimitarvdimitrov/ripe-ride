import {NextResponse} from 'next/server';
import {StravaAPIClient, decodePolyline} from '@/lib/strava';
import {getCurrentUser} from '@/lib/auth';
import {supabaseAdmin} from '@/lib/supabase';
import {uploadGpxFile} from '@/lib/storage';
import {JSDOM} from 'jsdom';

export async function POST() {
    try {
        // Get current user and validate authentication
        const user = await getCurrentUser();
        if (!user || !user.accessToken) {
            return NextResponse.json({error: 'Unauthorized'}, {status: 401});
        }

        const stravaClient = new StravaAPIClient(user.accessToken);

        console.log('📡 Fetching routes from Strava...');

        // Fetch both activities and routes
        // Activities: Only get activities from the last 2 weeks to avoid syncing too much data
        // Routes: Get all saved routes (no date filter for routes)
        const [activities, routes] = await Promise.all([
            stravaClient.getRecentActivities(1, 50), // Get activities from last 2 weeks
            stravaClient.getRoutes(1, 50), // Get last 50 routes
        ]);

        console.log(`📊 Found ${activities.length} recent activities and ${routes.length} routes`);

        let syncedCount = 0;
        const errors: string[] = [];

        const activityResults = await processActivities(activities, user.id, errors);
        const routeResults = await processRoutes(routes, user.id, errors);
        
        syncedCount = activityResults.syncedCount + routeResults.syncedCount;

        console.log(`✅ Synced ${syncedCount} routes successfully`);

        return NextResponse.json({
            success: true,
            syncedCount,
            activities: activities.length,
            routes: routes.length,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error('❌ Error syncing routes:', error);
        return NextResponse.json(
            {error: 'Failed to sync routes'},
            {status: 500}
        );
    }
}

async function processActivities(
    activities: Array<{
        id: number;
        name: string;
        map?: { summary_polyline?: string };
        start_date_local: string;
        total_elevation_gain?: number;
    }>,
    userId: string,
    errors: string[]
): Promise<{ syncedCount: number }> {
    let syncedCount = 0;
    
    for (const activity of activities.filter((activity) => activity?.map?.summary_polyline)) {
        try {
            const points = decodePolyline(activity.map!.summary_polyline!);

            if (points.length > 0) {
                const gpxContent = convertToGPX(
                    activity.name,
                    points,
                    activity.start_date_local
                );

                const filename = `strava-activity-${activity.id}.gpx`;

                const uploadResult = await uploadGpxFile(userId, 'activities', filename, gpxContent);

                if (uploadResult) {
                    const distance = estimateDistance(points);

                    await supabaseAdmin
                        .from('activities')
                        .upsert({
                            strava_activity_id: activity.id.toString(),
                            user_id: userId,
                            name: activity.name,
                            distance_meters: distance,
                            elevation_meters: activity.total_elevation_gain || null,
                            activity_date: activity.start_date_local,
                            gpx_file_url: uploadResult.publicUrl
                        })
                        .throwOnError();

                    console.log(`✅ Synced activity: ${activity.name}`);
                    syncedCount++;
                } else {
                    errors.push(`Failed to upload GPX for activity ${activity.id}`);
                }
            }
        } catch (error) {
            console.error(`Error processing activity ${activity.id}:`, error);
            errors.push(`Error processing activity ${activity.id}: ${error}`);
        }
    }
    
    return { syncedCount };
}

async function processRoutes(
    routes: Array<{
        id: number;
        name: string;
        map?: { summary_polyline?: string };
        created_at: string;
    }>,
    userId: string,
    errors: string[]
): Promise<{ syncedCount: number }> {
    let syncedCount = 0;
    
    for (const route of routes.filter((route) => route?.map?.summary_polyline)) {
        try {
            const points = decodePolyline(route.map!.summary_polyline!);

            if (points.length > 0) {
                const gpxContent = convertToGPX(
                    route.name,
                    points,
                    route.created_at
                );

                const filename = `strava-route-${route.id}.gpx`;

                const uploadResult = await uploadGpxFile(userId, 'routes', filename, gpxContent);

                if (uploadResult) {
                    const distance = estimateDistance(points);

                    await supabaseAdmin
                        .from('routes')
                        .upsert({
                            user_id: userId,
                            name: route.name,
                            distance_meters: distance,
                            elevation_meters: null,
                            platform: 'strava',
                            platform_id: route.id.toString(),
                            gpx_file_url: uploadResult.publicUrl
                        }, {onConflict: 'platform, platform_id'})
                        .throwOnError();

                    console.log(`✅ Synced route: ${route.name}`);
                    syncedCount++;
                } else {
                    errors.push(`Failed to upload GPX for route ${route.id}`);
                }
            }
        } catch (error) {
            console.error(`Error processing route ${route.id}:`, error);
            errors.push(`Error processing route ${route.id}: ${error}`);
        }
    }
    
    return { syncedCount };
}

function convertToGPX(
    name: string,
    points: Array<{ lat: number; lon: number }>,
    timestamp: string
): string {
    // Use DOM to properly escape XML special characters
    const dom = new JSDOM();
    const div = dom.window.document.createElement('div');
    div.textContent = name;
    const escapedName = div.innerHTML;

    const trackPoints = points
        .map(
            (point) =>
                `    <trkpt lat="${point.lat}" lon="${point.lon}"></trkpt>`
        )
        .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RipeRide - Strava Sync" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapedName}</name>
    <time>${timestamp}</time>
  </metadata>
  <trk>
    <name>${escapedName}</name>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>
</gpx>`;
}

function estimateDistance(points: Array<{ lat: number; lon: number }>): number {
    if (points.length < 2) return 0;

    let totalDistance = 0;

    for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];

        // Haversine formula for distance calculation
        const R = 6371000; // Earth's radius in meters
        const dLat = (curr.lat - prev.lat) * Math.PI / 180;
        const dLon = (curr.lon - prev.lon) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(prev.lat * Math.PI / 180) * Math.cos(curr.lat * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        totalDistance += distance;
    }

    return Math.round(totalDistance);
}
