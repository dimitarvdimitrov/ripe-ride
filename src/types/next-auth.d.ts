import { DefaultSession } from "next-auth"
import { DefaultJWT } from "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    accessToken?: string
    error?: string
    user: {
      id: string
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    accessToken?: string
    refreshToken?: string
    accessTokenExpires?: number
    error?: string
  }
}