import {NextAuthOptions} from "next-auth";
import StravaProvider from "next-auth/providers/strava";
import {JWT} from "next-auth/jwt";

export const authOptions: NextAuthOptions = {
    debug: process.env.NODE_ENV === 'development',
    providers: [
        StravaProvider({
            clientId: process.env.STRAVA_CLIENT_ID!,
            clientSecret: process.env.STRAVA_CLIENT_SECRET!,
            authorization: {
                params: {
                    scope: 'read,activity:read_all,profile:read_all',
                    approval_prompt: 'force',
                },
            },
        }),
    ],
    callbacks: {
        async jwt({ token, account }) {
            // Persist the OAuth access_token and refresh_token to the token right after signin
            if (account) {
                token.accessToken = account.access_token
                token.refreshToken = account.refresh_token
                token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : 0
            }

            // Return previous token if the access token has not expired yet
            if (Date.now() < (token.accessTokenExpires as number)) {
                return token
            }

            // Access token has expired, try to update it
            return refreshAccessToken(token)
        },
        async session({ session, token }) {
            session.user.id = token.sub!
            session.accessToken = token.accessToken
            session.error = token.error
            return session
        },
    },
    pages: {
        signIn: '/login',
    },
}

async function refreshAccessToken(token: JWT) {
    try {
        const response = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: process.env.STRAVA_CLIENT_ID,
                client_secret: process.env.STRAVA_CLIENT_SECRET,
                refresh_token: token.refreshToken,
                grant_type: 'refresh_token',
            }),
        })

        const refreshedTokens = await response.json()

        if (!response.ok) {
            throw refreshedTokens
        }

        return {
            ...token,
            accessToken: refreshedTokens.access_token,
            accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
            refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
        }
    } catch (error) {
        console.error('Error refreshing access token:', error)

        return {
            ...token,
            error: 'RefreshAccessTokenError',
        }
    }
}
