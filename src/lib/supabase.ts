import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Client for browser/client-side operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Admin client for server-side operations (bypasses RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Database types
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          strava_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          strava_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          strava_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      strava_tokens: {
        Row: {
          user_id: string
          access_token: string
          refresh_token: string
          expires_at: string
          scope: string | null
          created_at: string
        }
        Insert: {
          user_id: string
          access_token: string
          refresh_token: string
          expires_at: string
          scope?: string | null
          created_at?: string
        }
        Update: {
          user_id?: string
          access_token?: string
          refresh_token?: string
          expires_at?: string
          scope?: string | null
          created_at?: string
        }
      }
      routes: {
        Row: {
          id: string
          user_id: string
          name: string
          distance_meters: number | null
          elevation_meters: number | null
          gpx_file_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          distance_meters?: number | null
          elevation_meters?: number | null
          gpx_file_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          distance_meters?: number | null
          elevation_meters?: number | null
          gpx_file_url?: string | null
          created_at?: string
        }
      }
      activities: {
        Row: {
          id: string
          strava_activity_id: string | null
          user_id: string
          name: string | null
          distance_meters: number | null
          elevation_meters: number | null
          activity_date: string | null
          gpx_file_url: string | null
        }
        Insert: {
          id?: string
          strava_activity_id?: string | null
          user_id: string
          name?: string | null
          distance_meters?: number | null
          elevation_meters?: number | null
          activity_date?: string | null
          gpx_file_url?: string | null
        }
        Update: {
          id?: string
          strava_activity_id?: string | null
          user_id?: string
          name?: string | null
          distance_meters?: number | null
          elevation_meters?: number | null
          activity_date?: string | null
          gpx_file_url?: string | null
        }
      }
    }
  }
}