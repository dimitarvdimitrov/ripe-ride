import { NextResponse } from 'next/server';
import { StravaAPIClient, decodePolyline } from '@/lib/strava';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { uploadGpxFile } from '@/lib/storage';

export async function POST() {
  try {
    // Get current user and validate authentication
    const user = await getCurrentUser();
    if (!user || !user.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    // Process activities (save to database and storage)
    for (const activity of activities.filter((activity) => activity?.map?.summary_polyline)) {
      try {
        const points = decodePolyline(activity.map.summary_polyline);

        if (points.length > 0) {
          const gpxContent = convertToGPX(
              activity.name,
              points,
              activity.start_date_local
          );

          const filename = `strava-activity-${activity.id}.gpx`;
          
          // Upload GPX to Supabase Storage
          const uploadResult = await uploadGpxFile(user.id, 'activities', filename, gpxContent);
          
          if (uploadResult) {
            // Calculate distance (simple estimation)
            const distance = estimateDistance(points);
            
            // Store activity metadata in database
            await supabaseAdmin
              .from('activities')
              .upsert({
                id: `activity-${activity.id}`,
                strava_activity_id: activity.id.toString(),
                user_id: user.id,
                name: activity.name,
                distance_meters: distance,
                elevation_meters: activity.total_elevation_gain || null,
                activity_date: activity.start_date_local,
                gpx_file_url: uploadResult.publicUrl
              });

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

    // Process routes (save to database and storage)
    for (const route of routes.filter((route) => route?.map?.summary_polyline)) {
      try {
        const points = decodePolyline(route.map.summary_polyline);

        if (points.length > 0) {
          const gpxContent = convertToGPX(
              route.name,
              points,
              route.created_at
          );

          const filename = `strava-route-${route.id}.gpx`;
          
          // Upload GPX to Supabase Storage
          const uploadResult = await uploadGpxFile(user.id, 'routes', filename, gpxContent);
          
          if (uploadResult) {
            // Calculate distance (simple estimation)
            const distance = estimateDistance(points);
            
            // Store route metadata in database
            await supabaseAdmin
              .from('routes')
              .upsert({
                id: `route-${route.id}`,
                user_id: user.id,
                name: route.name,
                distance_meters: distance,
                elevation_meters: null, // Routes don't have elevation data from Strava API
                gpx_file_url: uploadResult.publicUrl
              });

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
      { error: 'Failed to sync routes' },
      { status: 500 }
    );
  }
}

function convertToGPX(
  name: string,
  points: Array<{ lat: number; lon: number }>,
  timestamp: string
): string {
  const trackPoints = points
    .map(
      (point) =>
        `    <trkpt lat="${point.lat}" lon="${point.lon}"></trkpt>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RipeRide - Strava Sync" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${name}</name>
    <time>${timestamp}</time>
  </metadata>
  <trk>
    <name>${name}</name>
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
