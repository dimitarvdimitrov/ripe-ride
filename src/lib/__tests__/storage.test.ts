import {
  generateGpxFilePath,
  uploadGpxFile,
  downloadGpxFile,
  deleteGpxFile,
  listUserGpxFiles
} from '../storage'
import { supabaseAdmin } from '../supabase'

// Mock Supabase Admin
jest.mock('../supabase', () => ({
  supabaseAdmin: {
    storage: {
      from: jest.fn()
    }
  }
}))

const mockStorage = supabaseAdmin.storage.from as jest.MockedFunction<typeof supabaseAdmin.storage.from>

describe('Storage Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('generateGpxFilePath', () => {
    it('should generate correct path with .gpx extension', () => {
      const path = generateGpxFilePath('user-123', 'routes', 'route1')
      expect(path).toBe('user-123/routes/route1.gpx')
    })

    it('should not add .gpx if already present', () => {
      const path = generateGpxFilePath('user-123', 'activities', 'activity1.gpx')
      expect(path).toBe('user-123/activities/activity1.gpx')
    })
  })

  describe('uploadGpxFile', () => {
    it('should upload file successfully', async () => {
      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: 'user-123/routes/route1.gpx' },
        error: null
      })
      
      const mockGetPublicUrl = jest.fn().mockReturnValue({
        data: { publicUrl: 'https://example.com/file.gpx' }
      })

      mockStorage.mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl
      } as unknown as ReturnType<typeof supabaseAdmin.storage.from>)

      const result = await uploadGpxFile('user-123', 'routes', 'route1', '<gpx>content</gpx>')

      expect(result).toEqual({
        filePath: 'user-123/routes/route1.gpx',
        publicUrl: 'https://example.com/file.gpx'
      })
      
      expect(mockUpload).toHaveBeenCalledWith(
        'user-123/routes/route1.gpx',
        '<gpx>content</gpx>',
        {
          contentType: 'application/gpx+xml',
          cacheControl: '3600',
          upsert: true
        }
      )
    })

    it('should return null on upload error', async () => {
      const mockUpload = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Upload failed' }
      })

      mockStorage.mockReturnValue({
        upload: mockUpload
      } as unknown as ReturnType<typeof supabaseAdmin.storage.from>)

      const result = await uploadGpxFile('user-123', 'routes', 'route1', '<gpx>content</gpx>')

      expect(result).toBeNull()
    })
  })

  describe('downloadGpxFile', () => {
    it('should download file successfully', async () => {
      const mockBlob = {
        text: jest.fn().mockResolvedValue('<gpx>downloaded content</gpx>')
      }
      
      const mockDownload = jest.fn().mockResolvedValue({
        data: mockBlob,
        error: null
      })

      mockStorage.mockReturnValue({
        download: mockDownload
      } as unknown as ReturnType<typeof supabaseAdmin.storage.from>)

      const result = await downloadGpxFile('user-123/routes/route1.gpx')

      expect(result).toBe('<gpx>downloaded content</gpx>')
      expect(mockDownload).toHaveBeenCalledWith('user-123/routes/route1.gpx')
    })

    it('should return null on download error', async () => {
      const mockDownload = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'File not found' }
      })

      mockStorage.mockReturnValue({
        download: mockDownload
      } as unknown as ReturnType<typeof supabaseAdmin.storage.from>)

      const result = await downloadGpxFile('user-123/routes/route1.gpx')

      expect(result).toBeNull()
    })
  })

  describe('deleteGpxFile', () => {
    it('should delete file successfully', async () => {
      const mockRemove = jest.fn().mockResolvedValue({
        error: null
      })

      mockStorage.mockReturnValue({
        remove: mockRemove
      } as unknown as ReturnType<typeof supabaseAdmin.storage.from>)

      const result = await deleteGpxFile('user-123/routes/route1.gpx')

      expect(result).toBe(true)
      expect(mockRemove).toHaveBeenCalledWith(['user-123/routes/route1.gpx'])
    })

    it('should return false on delete error', async () => {
      const mockRemove = jest.fn().mockResolvedValue({
        error: { message: 'Delete failed' }
      })

      mockStorage.mockReturnValue({
        remove: mockRemove
      } as unknown as ReturnType<typeof supabaseAdmin.storage.from>)

      const result = await deleteGpxFile('user-123/routes/route1.gpx')

      expect(result).toBe(false)
    })
  })

  describe('listUserGpxFiles', () => {
    it('should list files for user', async () => {
      const mockFiles = [
        {
          name: 'route1.gpx',
          created_at: '2024-01-01T00:00:00Z',
          metadata: { size: 1024 }
        },
        {
          name: 'route2.gpx',
          created_at: '2024-01-02T00:00:00Z',
          metadata: { size: 2048 }
        }
      ]

      const mockList = jest.fn().mockResolvedValue({
        data: mockFiles,
        error: null
      })

      mockStorage.mockReturnValue({
        list: mockList
      } as unknown as ReturnType<typeof supabaseAdmin.storage.from>)

      const result = await listUserGpxFiles('user-123', 'routes')

      expect(result).toEqual([
        {
          name: 'route1.gpx',
          path: 'user-123/routes/route1.gpx',
          size: 1024,
          lastModified: '2024-01-01T00:00:00Z'
        },
        {
          name: 'route2.gpx',
          path: 'user-123/routes/route2.gpx',
          size: 2048,
          lastModified: '2024-01-02T00:00:00Z'
        }
      ])

      expect(mockList).toHaveBeenCalledWith('user-123/routes/', {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'desc' }
      })
    })

    it('should return empty array on list error', async () => {
      const mockList = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'List failed' }
      })

      mockStorage.mockReturnValue({
        list: mockList
      } as unknown as ReturnType<typeof supabaseAdmin.storage.from>)

      const result = await listUserGpxFiles('user-123')

      expect(result).toEqual([])
    })
  })
})