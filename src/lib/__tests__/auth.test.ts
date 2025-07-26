import { getCurrentUser, getUserById } from '../auth'
import { supabaseAdmin } from '../supabase'

// Mock NextAuth
const mockGetServerSession = jest.fn()
jest.mock('next-auth/next', () => ({
  getServerSession: mockGetServerSession
}))

// Mock authOptions
jest.mock('../authOptions', () => ({
  authOptions: {}
}))

describe('Auth Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getCurrentUser', () => {
    it('should return null when no session exists', async () => {
      mockGetServerSession.mockResolvedValue(null)
      
      const user = await getCurrentUser()
      
      expect(user).toBeNull()
    })

    it('should return user data when session exists', async () => {
      const mockSession = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User'
        },
        accessToken: 'strava-token'
      }
      
      mockGetServerSession.mockResolvedValue(mockSession)
      
      const user = await getCurrentUser()
      
      expect(user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        accessToken: 'strava-token'
      })
    })

    it('should return null when session has no user ID', async () => {
      const mockSession = {
        user: {
          email: 'test@example.com',
          name: 'Test User'
        }
      }
      
      mockGetServerSession.mockResolvedValue(mockSession)
      
      const user = await getCurrentUser()
      
      expect(user).toBeNull()
    })
  })

  describe('getUserById', () => {
    it('should return user data when user exists', async () => {
      const mockUser = {
        id: 'user-123',
        strava_id: '12345',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      // Mock Supabase query
      jest.spyOn(supabaseAdmin, 'from').mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockUser,
              error: null
            })
          })
        })
      } as unknown as ReturnType<typeof supabaseAdmin.from>)

      const user = await getUserById('user-123')
      
      expect(user).toEqual(mockUser)
    })

    it('should return null when user does not exist', async () => {
      // Mock Supabase query with error
      jest.spyOn(supabaseAdmin, 'from').mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'User not found' }
            })
          })
        })
      } as unknown as ReturnType<typeof supabaseAdmin.from>)

      const user = await getUserById('nonexistent-user')
      
      expect(user).toBeNull()
    })
  })
})