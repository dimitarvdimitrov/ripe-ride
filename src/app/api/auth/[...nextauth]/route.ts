import NextAuth from 'next-auth'

import {authOptions} from '@/lib/authOptions'
import {enableHttpDebugging} from '@/lib/httpDebugger'

// Enable comprehensive HTTP debugging for all requests
enableHttpDebugging();

console.log('[NextAuth] Route handler initialized with debugging enabled');

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
