import { DatabaseRouteLoader } from '../databaseRouteLoader'
import { supabaseAdmin } from '../supabase'
import { downloadGpxFile } from '../storage'

// Mock dependencies
jest.mock('../supabase', () => ({
  supabaseAdmin: {
    from: jest.fn()
  }
}))

jest.mock('../storage', () => ({
  downloadGpxFile: jest.fn()
}))

const mockSupabaseFrom = supabaseAdmin.from as jest.MockedFunction<typeof supabaseAdmin.from>
const mockDownloadGpxFile = downloadGpxFile as jest.MockedFunction<typeof downloadGpxFile>

describe('DatabaseRouteLoader', () => {
  let loader: DatabaseRouteLoader
  const userId = 'test-user-123'

  beforeEach(() => {
    jest.clearAllMocks()
    loader = new DatabaseRouteLoader(userId)
  })

  describe('loadFromFolder - saved routes', () => {
    it('should load saved routes from database', async () => {
      const mockRoutes = [
        {
          id: 'route-1',
          name: 'Test Route 1',
          distance_meters: 5000,
          elevation_meters: 100,
          gpx_file_url: 'https://example.com/storage/v1/object/public/gpx_files/user-123/routes/route1.gpx',
          created_at: '2024-01-01T00:00:00Z'
        }
      ]

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockRoutes,
          error: null
        })
      }

      mockSupabaseFrom.mockReturnValue(mockQuery as unknown as ReturnType<typeof supabaseAdmin.from>)
      
      const mockGpxContent = `<?xml version="1.0"?>
        <gpx>
          <trk>
            <name>Test Route 1</name>
            <trkseg>
              <trkpt lat="40.7128" lon="-74.0060"><ele>10</ele></trkpt>
              <trkpt lat="40.7129" lon="-74.0061"><ele>11</ele></trkpt>
            </trkseg>
          </trk>
        </gpx>`
      
      mockDownloadGpxFile.mockResolvedValue(mockGpxContent)

      const routes = await loader.loadFromFolder('saved')

      expect(mockSupabaseFrom).toHaveBeenCalledWith('routes')
      expect(mockQuery.select).toHaveBeenCalledWith('*')
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', userId)
      expect(mockQuery.order).toHaveBeenCalledWith('created_at', { ascending: false })
      
      expect(routes).toHaveLength(1)
      expect(routes[0]).toMatchObject({
        id: 'route-1',
        name: 'Test Route 1',
        folder: 'saved',
        totalDistance: 5000
      })
      expect(routes[0].points).toHaveLength(2)
      expect(routes[0].points[0]).toMatchObject({
        lat: 40.7128,
        lon: -74.0060,
        elevation: 10
      })
    })

    it('should handle routes with missing GPX files', async () => {
      const mockRoutes = [
        {
          id: 'route-1',
          name: 'Test Route 1',
          distance_meters: 5000,
          elevation_meters: 100,
          gpx_file_url: null,
          created_at: '2024-01-01T00:00:00Z'
        }
      ]

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockRoutes,
          error: null
        })
      }

      mockSupabaseFrom.mockReturnValue(mockQuery as unknown as ReturnType<typeof supabaseAdmin.from>)

      const routes = await loader.loadFromFolder('saved')

      expect(routes).toHaveLength(1)
      expect(routes[0]).toMatchObject({
        id: 'route-1',
        name: 'Test Route 1',
        error: 'No GPX file URL available',
        points: []
      })
    })

    it('should handle GPX download failures', async () => {
      const mockRoutes = [
        {
          id: 'route-1',
          name: 'Test Route 1',
          distance_meters: 5000,
          elevation_meters: 100,
          gpx_file_url: 'https://example.com/storage/v1/object/public/gpx_files/user-123/routes/route1.gpx',
          created_at: '2024-01-01T00:00:00Z'
        }
      ]

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockRoutes,
          error: null
        })
      }

      mockSupabaseFrom.mockReturnValue(mockQuery as unknown as ReturnType<typeof supabaseAdmin.from>)
      mockDownloadGpxFile.mockResolvedValue(null)

      const routes = await loader.loadFromFolder('saved')

      expect(routes).toHaveLength(1)
      expect(routes[0]).toMatchObject({
        id: 'route-1',
        name: 'Test Route 1',
        error: 'Failed to download GPX file',
        points: []
      })
    })
  })

  describe('loadFromFolder - recent activities', () => {
    it('should load recent activities from database', async () => {
      const mockActivities = [
        {
          id: 'activity-1',
          name: 'Morning Run',
          distance_meters: 3000,
          elevation_meters: 50,
          activity_date: '2024-01-01T08:00:00Z',
          gpx_file_url: 'https://example.com/storage/v1/object/public/gpx_files/user-123/activities/activity1.gpx'
        }
      ]

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockActivities,
          error: null
        })
      }

      mockSupabaseFrom.mockReturnValue(mockQuery as unknown as ReturnType<typeof supabaseAdmin.from>)
      
      const mockGpxContent = `<?xml version="1.0"?>
        <gpx>
          <trk>
            <name>Morning Run</name>
            <trkseg>
              <trkpt lat="40.7128" lon="-74.0060"><ele>5</ele></trkpt>
            </trkseg>
          </trk>
        </gpx>`
      
      mockDownloadGpxFile.mockResolvedValue(mockGpxContent)

      const routes = await loader.loadFromFolder('recent')

      expect(mockSupabaseFrom).toHaveBeenCalledWith('activities')
      expect(mockQuery.select).toHaveBeenCalledWith('*')
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', userId)
      expect(mockQuery.order).toHaveBeenCalledWith('activity_date', { ascending: false })
      
      expect(routes).toHaveLength(1)
      expect(routes[0]).toMatchObject({
        id: 'activity-1',
        name: 'Morning Run',
        folder: 'recent',
        totalDistance: 3000
      })
      expect(routes[0].date).toEqual(new Date('2024-01-01T08:00:00Z'))
    })

    it('should handle activities with no name', async () => {
      const mockActivities = [
        {
          id: 'activity-1',
          name: null,
          distance_meters: 3000,
          elevation_meters: 50,
          activity_date: '2024-01-01T08:00:00Z',
          gpx_file_url: null
        }
      ]

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockActivities,
          error: null
        })
      }

      mockSupabaseFrom.mockReturnValue(mockQuery as unknown as ReturnType<typeof supabaseAdmin.from>)

      const routes = await loader.loadFromFolder('recent')

      expect(routes).toHaveLength(1)
      expect(routes[0]).toMatchObject({
        id: 'activity-1',
        name: 'Activity activity-1',
        folder: 'recent'
      })
    })
  })

  describe('loadAll', () => {
    it('should load both saved routes and recent activities', async () => {
      const mockRoutes = [
        {
          id: 'route-1',
          name: 'Test Route',
          distance_meters: 5000,
          elevation_meters: 100,
          gpx_file_url: null,
          created_at: '2024-01-01T00:00:00Z'
        }
      ]

      const mockActivities = [
        {
          id: 'activity-1',
          name: 'Morning Run',
          distance_meters: 3000,
          elevation_meters: 50,
          activity_date: '2024-01-01T08:00:00Z',
          gpx_file_url: null
        }
      ]

      // Mock both queries
      mockSupabaseFrom.mockImplementation((table) => {
        const mockQuery = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: table === 'routes' ? mockRoutes : mockActivities,
            error: null
          })
        }
        return mockQuery as unknown as ReturnType<typeof supabaseAdmin.from>
      })

      const routes = await loader.loadAll()

      expect(routes).toHaveLength(2)
      expect(routes.find(r => r.id === 'route-1')).toBeDefined()
      expect(routes.find(r => r.id === 'activity-1')).toBeDefined()
    })
  })

  describe('error handling', () => {
    it('should return empty array on database error', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' }
        })
      }

      mockSupabaseFrom.mockReturnValue(mockQuery as unknown as ReturnType<typeof supabaseAdmin.from>)

      const routes = await loader.loadFromFolder('saved')

      expect(routes).toEqual([])
    })
  })
})