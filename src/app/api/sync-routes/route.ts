import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { StravaAPIClient, decodePolyline } from '@/lib/strava';

// Import the auth options from the NextAuth route
import { authOptions } from '@/lib/authOptions';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    // TODO we need to store the session information and strava access token somewhere
    if (!session || !session.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stravaClient = new StravaAPIClient(session.accessToken as string);
    
    console.log('📡 Fetching routes from Strava...');
    
    // Fetch both activities and routes
    // Activities: Only get activities from the last 2 weeks to avoid syncing too much data
    // Routes: Get all saved routes (no date filter for routes)
    const [activities, routes] = await Promise.all([
      stravaClient.getRecentActivities(1, 50), // Get activities from last 2 weeks
      stravaClient.getRoutes(1, 50), // Get last 50 routes
    ]);

    console.log(`📊 Found ${activities.length} recent activities and ${routes.length} routes`);

    // Ensure directories exist
    const recentDir = path.join(process.cwd(), 'recent');
    const savedDir = path.join(process.cwd(), 'saved');
    
    if (!existsSync(recentDir)) {
      mkdirSync(recentDir, { recursive: true });
    }
    if (!existsSync(savedDir)) {
      mkdirSync(savedDir, { recursive: true });
    }

    let syncedCount = 0;

    // Process activities (save to recent folder)
    for (const activity of activities.filter((activity) => activity?.map?.summary_polyline)) {
      const points = decodePolyline(activity.map.summary_polyline);

      if (points.length > 0) {
        const gpxContent = convertToGPX(
            activity.name,
            points,
            activity.start_date_local
        );

        const filename = `strava-activity-${activity.id}.gpx`;
        const filepath = path.join(recentDir, filename);
        console.log(`wrote file at ${filepath}`);

        writeFileSync(filepath, gpxContent);
        syncedCount++;
      }
    }

    // Process routes (save to saved folder)
    for (const route of routes.filter((route) => route?.map?.summary_polyline)) {
        const points = decodePolyline(route.map.summary_polyline);

        if (points.length > 0) {
          const gpxContent = convertToGPX(
              route.name,
              points,
              route.created_at
          );

          const filename = `strava-route-${route.id}.gpx`;
          const filepath = path.join(savedDir, filename);
          console.log(`wrote file at ${filepath}`);

          writeFileSync(filepath, gpxContent);
          syncedCount++;
      }
    }

    console.log(`✅ Synced ${syncedCount} routes successfully`);

    return NextResponse.json({
      success: true,
      syncedCount,
      activities: activities.length,
      routes: routes.length,
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
