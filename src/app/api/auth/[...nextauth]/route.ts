import NextAuth from 'next-auth'

import {authOptions} from '@/lib/authOptions'
import {testSupabaseConnection} from '@/lib/supabase'

// Test connection on startup
testSupabaseConnection().catch(err => {
  console.error('[NextAuth] Failed to test Supabase connection on startup:', err);
});

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
