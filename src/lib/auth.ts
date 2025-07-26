import { getServerSession } from 'next-auth/next'
import { authOptions } from './authOptions'
import { supabaseAdmin } from './supabase'

/**
 * Get the current user session and validate authentication
 */
export async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return null
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    accessToken: session.accessToken
  }
}

/**
 * Get the current user's Strava tokens from the database
 */
export async function getCurrentUserStravaTokens(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('strava_tokens')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    return null
  }

  // Check if token is expired
  const now = new Date()
  const expiresAt = new Date(data.expires_at)
  
  return {
    ...data,
    isExpired: now >= expiresAt
  }
}

/**
 * Require authentication for API routes
 * Returns user info or throws unauthorized error
 */
export async function requireAuth() {
  const user = await getCurrentUser()
  
  if (!user) {
    throw new Error('Unauthorized')
  }
  
  return user
}

/**
 * Get user from database by ID
 */
export async function getUserById(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    return null
  }

  return data
}