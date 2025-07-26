import {NextAuthOptions} from "next-auth";
import StravaProvider from "next-auth/providers/strava";
import {SupabaseAdapter} from "@auth/supabase-adapter";
import {supabaseAdmin} from "./supabase";

export const authOptions: NextAuthOptions = {
    debug: process.env.NODE_ENV === 'development',
    adapter: SupabaseAdapter({
        url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        secret: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    }),
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
        async signIn({ user, account }) {
            if (account?.provider === 'strava' && account.access_token) {
                try {
                    // Store Strava tokens in our custom table
                    await supabaseAdmin
                        .from('strava_tokens')
                        .upsert({
                            user_id: user.id,
                            access_token: account.access_token,
                            refresh_token: account.refresh_token || '',
                            expires_at: new Date(account.expires_at! * 1000).toISOString(),
                            scope: account.scope || 'read,activity:read_all,profile:read_all'
                        });

                    // Also store/update user in our custom users table with Strava ID
                    await supabaseAdmin
                        .from('users')
                        .upsert({
                            id: user.id,
                            strava_id: account.providerAccountId
                        });
                } catch (error) {
                    console.error('Error storing Strava tokens:', error);
                    // Don't block sign in if token storage fails
                }
            }
            return true;
        },
        async session({ session, user }) {
            // Get the latest Strava tokens from database
            try {
                const { data: tokens } = await supabaseAdmin
                    .from('strava_tokens')
                    .select('access_token, expires_at, refresh_token')
                    .eq('user_id', user.id)
                    .single();

                if (tokens) {
                    // Check if token needs refresh
                    const now = new Date();
                    const expiresAt = new Date(tokens.expires_at);
                    
                    if (now >= expiresAt) {
                        // Token expired, try to refresh
                        const refreshedTokens = await refreshAccessToken({
                            userId: user.id,
                            refreshToken: tokens.refresh_token
                        });
                        
                        if (refreshedTokens) {
                            session.accessToken = refreshedTokens.access_token;
                        } else {
                            session.error = 'RefreshAccessTokenError';
                        }
                    } else {
                        session.accessToken = tokens.access_token;
                    }
                }
            } catch (error) {
                console.error('Error loading Strava tokens:', error);
            }

            return session;
        },
    },
    pages: {
        signIn: '/login',
    },
}

async function refreshAccessToken({ userId, refreshToken }: { userId: string, refreshToken: string }) {
    try {
        const response = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: process.env.STRAVA_CLIENT_ID,
                client_secret: process.env.STRAVA_CLIENT_SECRET,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
            }),
        })

        const refreshedTokens = await response.json()

        if (!response.ok) {
            throw refreshedTokens
        }

        // Update tokens in database
        const expiresAt = new Date(Date.now() + refreshedTokens.expires_in * 1000).toISOString();
        
        await supabaseAdmin
            .from('strava_tokens')
            .update({
                access_token: refreshedTokens.access_token,
                refresh_token: refreshedTokens.refresh_token ?? refreshToken,
                expires_at: expiresAt
            })
            .eq('user_id', userId);

        return {
            access_token: refreshedTokens.access_token,
            refresh_token: refreshedTokens.refresh_token ?? refreshToken,
            expires_at: expiresAt
        };
    } catch (error) {
        console.error('Error refreshing access token:', error)
        return null;
    }
}
