import {NextAuthOptions} from "next-auth";
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
        async session({session, user}) {
            // Ensure user ID is properly set in session
            if (user?.id) {
                session.user.id = user.id
            }

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


        console.log('[NextAuth] Successfully refreshed Strava tokens:', {userId, expiresAt})
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
        async linkAccount(account: AdapterAccount): Promise<AdapterAccount | null | undefined> {
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

            await supabaseAdmin
                .from('users')
                .upsert({
                    id: filteredAccount.userId,
                    strava_id: filteredAccount.providerAccountId
                })
                .throwOnError();

            await supabaseAdmin
                .from('strava_tokens')
                .upsert({
                    user_id: filteredAccount.userId,
                    access_token: filteredAccount.access_token,
                    refresh_token: filteredAccount.refresh_token || '',
                    expires_at: filteredAccount.expires_at ? new Date(filteredAccount.expires_at * 1000).toISOString() : null,
                })
                .throwOnError();

            await parent.linkAccount!(filteredAccount);
            return filteredAccount;
        }
    }
}
