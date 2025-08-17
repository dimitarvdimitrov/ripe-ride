import {Awaitable, NextAuthOptions} from "next-auth";
import StravaProvider from "next-auth/providers/strava";
import {SupabaseAdapter} from "@auth/supabase-adapter";
import {Adapter, AdapterAccount} from "@auth/core/adapters"
import {supabaseAdmin} from "./supabase";

export const authOptions: NextAuthOptions = {
    debug: process.env.NODE_ENV === 'development',
    adapter: AuthAdapter(SupabaseAdapter({
        url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        secret: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    })),
    logger: {
        error(code, metadata) {
            console.error('[NextAuth Error]', code, metadata);

            // Special handling for adapter errors
            if (code === 'ADAPTER_ERROR') {
                console.error('[NextAuth] Adapter Error Details:', {
                    metadata,
                    timestamp: new Date().toISOString()
                });
            }

            if (code === 'ADAPTER_ERROR_GETSESSIONANDUSER') {
                console.error('[NextAuth] GetSessionAndUser Error - this happens during session retrieval');
                console.error('[NextAuth] This suggests the adapter cannot read existing session data');
            }
        },
        warn(code) {
            console.warn('[NextAuth Warning]', code);
        },
        debug(code, metadata) {
            console.log('[NextAuth Debug]', code, metadata);

            if (code === 'ADAPTER') {
                console.log('[NextAuth] Adapter operation:', metadata);
            }
        }
    },
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
        async jwt({token, user, account}) {
            console.log('[NextAuth] JWT Token user ID:', token.sub);

            // On initial sign in (when account is present), store our custom data
            if (account?.provider === 'strava' && account.access_token && user) {
                console.log('[NextAuth] First time sign in - storing custom Strava data');
                console.log('[NextAuth] User ID from JWT:', user.id);

                try {
                    // Store Strava tokens in our custom table
                    const {error: tokensError} = await supabaseAdmin
                        .from('strava_tokens')
                        .upsert({
                            user_id: user.id,
                            access_token: account.access_token,
                            refresh_token: account.refresh_token || '',
                            expires_at: new Date(account.expires_at! * 1000).toISOString(),
                            scope: account.scope || 'read,activity:read_all,profile:read_all'
                        });

                    if (tokensError) {
                        console.error('[NextAuth] Error storing Strava tokens:', tokensError);
                    } else {
                        console.log('[NextAuth] Successfully stored Strava tokens');
                    }

                    // Also store/update user in our custom users table with Strava ID
                    const {error: userError} = await supabaseAdmin
                        .from('users')
                        .upsert({
                            id: user.id,
                            strava_id: account.providerAccountId
                        });

                    if (userError) {
                        console.error('[NextAuth] Error storing custom user data:', userError);
                    } else {
                        console.log('[NextAuth] Successfully stored custom user data with Strava ID');
                    }
                } catch (error) {
                    console.error('[NextAuth] Exception in JWT callback:', error);
                }
            }

            return token;
        },
        async session({session, user}) {
            // Get the latest Strava tokens from database
            try {
                const {data: tokens, error: tokensError} = await supabaseAdmin
                    .from('strava_tokens')
                    .select('access_token, expires_at, refresh_token')
                    .eq('user_id', user.id)
                    .single();

                if (tokensError) {
                    console.error('[NextAuth] Error loading Strava tokens:', tokensError);
                } else if (tokens) {
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
                            console.error('[NextAuth] Failed to refresh tokens');
                            session.error = 'RefreshAccessTokenError';
                        }
                    } else {
                        session.accessToken = tokens.access_token;
                    }
                }
            } catch (error) {
                console.error('[NextAuth] Exception in session callback:', error);
            }

            return session;
        },
    },
    pages: {
        signIn: '/login',
    },
}

async function refreshAccessToken({userId, refreshToken}: { userId: string, refreshToken: string }) {
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

function AuthAdapter(parent: Adapter): Adapter {
    return {
        ...parent,
        linkAccount(account: AdapterAccount): Promise<void> | Awaitable<AdapterAccount | null | undefined> {
            console.log('[AuthAdapter] linkAccount called with account:', account);
            
            // Filter account object to only include fields that exist in the database table
            const filteredAccount: AdapterAccount = {
                userId: account.userId,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                refresh_token: account.refresh_token,
                access_token: account.access_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
                session_state: account.session_state,
                oauth_token_secret: account.oauth_token_secret,
                oauth_token: account.oauth_token,
            };
            
            console.log('[AuthAdapter] Filtered account:', filteredAccount);
            
            // Call the original method with filtered account
            return parent.linkAccount?.(filteredAccount) ?? Promise.resolve(null);
        }
    }
}
