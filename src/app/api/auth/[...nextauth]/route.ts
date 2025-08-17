import NextAuth from 'next-auth'

import {authOptions} from '@/lib/authOptions'
import {enableHttpDebugging} from '@/lib/httpDebugger'

// Enable comprehensive HTTP debugging for all requests
enableHttpDebugging();

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
