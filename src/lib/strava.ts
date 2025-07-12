export interface StravaActivity {
  id: number;
  name: string;
  distance: number;
  total_elevation_gain: number;
  map: {
    polyline: string;
    summary_polyline: string;
  };
  start_date: string;
  start_date_local: string;
  type: string;
}

export interface StravaRoute {
  id: number;
  name: string;
  distance: number;
  elevation_gain: number;
  map: {
    polyline: string;
    summary_polyline: string;
  };
  created_at: string;
  type: string;
}

export interface StravaTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export class StravaAPIClient {
  private baseURL = 'https://www.strava.com/api/v3';

  constructor(private accessToken: string) {}

  async getActivities(page = 1, perPage = 30, afterDate?: Date): Promise<StravaActivity[]> {
    const url = new URL(`${this.baseURL}/athlete/activities`);
    url.searchParams.set('page', page.toString());
    url.searchParams.set('per_page', perPage.toString());
    
    // Add date filter if provided (convert to epoch timestamp)
    if (afterDate) {
      const epochTimestamp = Math.floor(afterDate.getTime() / 1000);
      url.searchParams.set('after', epochTimestamp.toString());
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch activities: ${response.statusText}`);
    }
    
    const activities: StravaActivity[] = await response.json();
    return activities.filter(activity => activity.type === 'Ride');
  }

  async getRecentActivities(page = 1, perPage = 30): Promise<StravaActivity[]> {
    // Get activities from the last 2 weeks
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    
    return this.getActivities(page, perPage, twoWeeksAgo);
  }

  async getRoutes(page = 1, perPage = 30): Promise<StravaRoute[]> {
    const response = await fetch(
      `${this.baseURL}/athlete/routes?page=${page}&per_page=${perPage}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch routes: ${response.statusText}`);
    }

    // TODO return routes only ride routes; remap the 'type'. from the docs: type integer	This route's type (1 for ride, 2 for runs) sub_type integer	This route's sub-type (1 for road, 2 for mountain bike, 3 for cross, 4 for trail, 5 for mixed) translate to "Run" and "Ride" and then filter for "Ride"
    return response.json();
  }

  async getActivityById(id: number): Promise<StravaActivity> {
    const response = await fetch(`${this.baseURL}/activities/${id}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch activity ${id}: ${response.statusText}`);
    }

    return response.json();
  }

  async getRouteById(id: number): Promise<StravaRoute> {
    const response = await fetch(`${this.baseURL}/routes/${id}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch route ${id}: ${response.statusText}`);
    }

    return response.json();
  }

  static async refreshAccessToken(refreshToken: string): Promise<StravaTokens> {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh token: ${response.statusText}`);
    }

    return response.json();
  }

  static async exchangeCodeForTokens(code: string): Promise<StravaTokens> {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to exchange code for tokens: ${response.statusText}`);
    }

    return response.json();
  }
}

// Utility function to decode Strava polyline to GPS coordinates
export function decodePolyline(polyline: string): Array<{ lat: number; lon: number }> {
  const points: Array<{ lat: number; lon: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < polyline.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = polyline.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;

    do {
      byte = polyline.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    points.push({
      lat: lat / 1e5,
      lon: lng / 1e5,
    });
  }

  return points;
}
