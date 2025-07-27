import { supabaseAdmin } from './supabase'
import { downloadGpxFile } from './storage'
import { type RouteLoader, type Route, type RouteFilters, type RoutePoint } from './routeLoader'
import { calculateDistance } from './distance'

interface DatabaseRoute {
  id: string
  name: string
  distance_meters: number | null
  elevation_meters: number | null
  gpx_file_url: string | null
  created_at: string
}

interface DatabaseActivity {
  id: string
  name: string | null
  distance_meters: number | null
  elevation_meters: number | null
  activity_date: string | null
  gpx_file_url: string | null
}

/**
 * Parse GPX data using XML parser (copied from FileSystemRouteLoader)
 */
async function parseGPXWithXML(gpxData: string): Promise<{
  points: RoutePoint[];
  name?: string;
  date?: Date;
}> {
  const { JSDOM } = await import('jsdom')
  const dom = new JSDOM()
  const parser = new dom.window.DOMParser()
  
  try {
    const xmlDoc = parser.parseFromString(gpxData, 'text/xml')
    
    const parserError = xmlDoc.querySelector('parsererror')
    if (parserError) {
      throw new Error('XML parsing failed: ' + parserError.textContent)
    }
    
    const nameElement = xmlDoc.querySelector('trk > name') || xmlDoc.querySelector('metadata > name')
    const name = nameElement?.textContent || undefined
    
    const timeElement = xmlDoc.querySelector('metadata > time')
    const date = timeElement?.textContent ? new Date(timeElement.textContent) : undefined
    
    const trkptElements = xmlDoc.querySelectorAll('trkpt')
    const points: RoutePoint[] = []
    
    trkptElements.forEach((trkpt: Element) => {
      const lat = parseFloat(trkpt.getAttribute('lat') || '')
      const lon = parseFloat(trkpt.getAttribute('lon') || '')
      
      if (!isNaN(lat) && !isNaN(lon)) {
        const eleElement = trkpt.querySelector('ele')
        const elevation = eleElement ? parseFloat(eleElement.textContent || '0') : undefined
        
        points.push({ lat, lon, elevation })
      }
    })
    
    return { points, name, date }
  } catch (error) {
    console.error('XML parsing error:', error)
    return { points: [], date: undefined }
  }
}

/**
 * Calculate total distance for a route and populate distance/midpoint fields
 */
function calculateRouteDistance(points: RoutePoint[]): number {
  let totalDistance = 0
  
  for (let i = 0; i < points.length; i++) {
    if (i === 0) {
      // First point
      points[i].distanceSinceStart = 0
      points[i].distanceFromPrev = 0
      points[i].midLat = undefined
      points[i].midLon = undefined
    } else {
      // Calculate distance from previous point
      const prev = points[i - 1]
      const curr = points[i]
      const segmentDistance = calculateDistance(prev.lat, prev.lon, curr.lat, curr.lon)
      
      totalDistance += segmentDistance
      
      // Populate calculated fields
      curr.distanceSinceStart = totalDistance
      curr.distanceFromPrev = segmentDistance
      curr.midLat = (prev.lat + curr.lat) / 2
      curr.midLon = (prev.lon + curr.lon) / 2
    }
  }
  
  return totalDistance
}

/**
 * Apply filters to a route
 */
function applyRouteFilters(route: Route, filters: RouteFilters): boolean {
  if (route.error) return true // Keep error routes for debugging
  
  const distanceKm = route.totalDistance / 1000
  const maxElevation = route.points.length > 0 ? Math.max(...route.points.map(p => p.elevation || 0)) : 0
  
  // Apply distance filter
  if (filters.distanceMin !== undefined && distanceKm < filters.distanceMin) return false
  if (filters.distanceMax !== undefined && distanceKm > filters.distanceMax) return false
  
  // Apply elevation filter
  if (filters.elevationMin !== undefined && maxElevation < filters.elevationMin) return false
  if (filters.elevationMax !== undefined && maxElevation > filters.elevationMax) return false
  
  // Apply geographic filter (distance from center point)
  if (filters.centerLat !== undefined && filters.centerLng !== undefined && filters.maxDistanceKm !== undefined) {
    if (route.points.length > 0) {
      const startPoint = route.points[0]
      const distanceToStart = calculateDistance(
        filters.centerLat,
        filters.centerLng,
        startPoint.lat,
        startPoint.lon
      )
      const distanceToStartKm = distanceToStart / 1000
      
      if (distanceToStartKm > filters.maxDistanceKm) return false
    }
  }
  
  return true
}

/**
 * Database-driven route loader that replaces FileSystemRouteLoader
 */
export class DatabaseRouteLoader implements RouteLoader {
  private userId: string

  constructor(userId: string) {
    this.userId = userId
  }

  async loadFromFolder(folder: 'recent' | 'saved', filters?: RouteFilters): Promise<Route[]> {
    try {
      if (folder === 'saved') {
        return await this.loadSavedRoutes(filters)
      } else {
        return await this.loadRecentActivities(filters)
      }
    } catch (error) {
      console.error(`Error loading ${folder} routes:`, error)
      return []
    }
  }

  async loadAll(filters?: RouteFilters): Promise<Route[]> {
    const [recentRoutes, savedRoutes] = await Promise.all([
      this.loadFromFolder('recent', filters),
      this.loadFromFolder('saved', filters)
    ])
    
    return [...recentRoutes, ...savedRoutes]
  }

  private async loadSavedRoutes(filters?: RouteFilters): Promise<Route[]> {
    // Query saved routes from database
    const { data, error } = await supabaseAdmin
      .from('routes')
      .select('*')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error querying saved routes:', error)
      return []
    }

    const routes = await Promise.all(
      (data as DatabaseRoute[]).map(async (dbRoute) => {
        const route = await this.convertDatabaseRouteToRoute(dbRoute, 'saved')
        return route
      })
    )

    // Apply filters
    if (filters) {
      return routes.filter(route => applyRouteFilters(route, filters))
    }

    return routes
  }

  private async loadRecentActivities(filters?: RouteFilters): Promise<Route[]> {
    // Query recent activities from database  
    const { data, error } = await supabaseAdmin
      .from('activities')
      .select('*')
      .eq('user_id', this.userId)
      .order('activity_date', { ascending: false })

    if (error) {
      console.error('Error querying recent activities:', error)
      return []
    }

    const routes = await Promise.all(
      (data as DatabaseActivity[]).map(async (dbActivity) => {
        const route = await this.convertDatabaseActivityToRoute(dbActivity, 'recent')
        return route
      })
    )

    // Apply filters
    if (filters) {
      return routes.filter(route => applyRouteFilters(route, filters))
    }

    return routes
  }

  private async convertDatabaseRouteToRoute(dbRoute: DatabaseRoute, folder: 'saved'): Promise<Route> {
    const route: Route = {
      id: dbRoute.id,
      name: dbRoute.name,
      points: [],
      totalDistance: dbRoute.distance_meters || 0,
      folder,
      date: new Date(dbRoute.created_at),
      error: undefined
    }

    // Download and parse GPX file if URL exists
    if (dbRoute.gpx_file_url) {
      try {
        // Extract file path from URL (remove public URL prefix)
        const urlParts = dbRoute.gpx_file_url.split('/storage/v1/object/public/gpx_files/')
        const filePath = urlParts[1] || dbRoute.gpx_file_url
        
        const gpxContent = await downloadGpxFile(filePath)
        if (gpxContent) {
          const parseResult = await parseGPXWithXML(gpxContent)
          route.points = parseResult.points
          
          // Recalculate distance if points exist but no stored distance
          if (route.points.length > 0 && !dbRoute.distance_meters) {
            route.totalDistance = calculateRouteDistance(route.points)
          } else if (route.points.length > 0) {
            // Still populate calculated fields for existing points
            calculateRouteDistance(route.points)
          }
          
          // Use parsed name if available and no database name
          if (!route.name && parseResult.name) {
            route.name = parseResult.name
          }
        } else {
          route.error = 'Failed to download GPX file'
        }
      } catch (error) {
        console.error(`Error processing GPX for route ${dbRoute.id}:`, error)
        route.error = `Failed to parse GPX: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    } else {
      route.error = 'No GPX file URL available'
    }

    return route
  }

  private async convertDatabaseActivityToRoute(dbActivity: DatabaseActivity, folder: 'recent'): Promise<Route> {
    const route: Route = {
      id: dbActivity.id,
      name: dbActivity.name || `Activity ${dbActivity.id}`,
      points: [],
      totalDistance: dbActivity.distance_meters || 0,
      folder,
      date: dbActivity.activity_date ? new Date(dbActivity.activity_date) : new Date(),
      error: undefined
    }

    // Download and parse GPX file if URL exists
    if (dbActivity.gpx_file_url) {
      try {
        // Extract file path from URL (remove public URL prefix)
        const urlParts = dbActivity.gpx_file_url.split('/storage/v1/object/public/gpx_files/')
        const filePath = urlParts[1] || dbActivity.gpx_file_url
        
        const gpxContent = await downloadGpxFile(filePath)
        if (gpxContent) {
          const parseResult = await parseGPXWithXML(gpxContent)
          route.points = parseResult.points
          
          // Recalculate distance if points exist but no stored distance
          if (route.points.length > 0 && !dbActivity.distance_meters) {
            route.totalDistance = calculateRouteDistance(route.points)
          } else if (route.points.length > 0) {
            // Still populate calculated fields for existing points
            calculateRouteDistance(route.points)
          }
          
          // Use parsed name if available and no database name
          if (!route.name && parseResult.name) {
            route.name = parseResult.name
          }
        } else {
          route.error = 'Failed to download GPX file'
        }
      } catch (error) {
        console.error(`Error processing GPX for activity ${dbActivity.id}:`, error)
        route.error = `Failed to parse GPX: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    } else {
      route.error = 'No GPX file URL available'
    }

    return route
  }
}