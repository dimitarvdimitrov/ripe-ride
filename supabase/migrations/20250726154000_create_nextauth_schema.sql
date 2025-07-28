-- Create NextAuth schema
CREATE SCHEMA IF NOT EXISTS next_auth;

-- Grant usage to authenticated and service_role
GRANT USAGE ON SCHEMA next_auth TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA next_auth TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA next_auth GRANT ALL ON TABLES TO anon, authenticated, service_role;

-- Create NextAuth users table
CREATE TABLE IF NOT EXISTS next_auth.users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  "emailVerified" TIMESTAMPTZ,
  image TEXT
);

-- Create NextAuth accounts table
CREATE TABLE IF NOT EXISTS next_auth.accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES next_auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at BIGINT,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  oauth_token_secret TEXT,
  oauth_token TEXT,
  UNIQUE(provider, "providerAccountId")
);

-- Create NextAuth sessions table
CREATE TABLE IF NOT EXISTS next_auth.sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "sessionToken" TEXT NOT NULL UNIQUE,
  "userId" UUID NOT NULL REFERENCES next_auth.users(id) ON DELETE CASCADE,
  expires TIMESTAMPTZ NOT NULL
);

-- Create NextAuth verification tokens table
CREATE TABLE IF NOT EXISTS next_auth.verification_tokens (
  identifier TEXT,
  token TEXT UNIQUE,
  expires TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS accounts_userId_idx ON next_auth.accounts ("userId");
CREATE INDEX IF NOT EXISTS sessions_userId_idx ON next_auth.sessions ("userId");
CREATE INDEX IF NOT EXISTS users_email_idx ON next_auth.users (email);

-- Grant permissions on tables
GRANT ALL ON next_auth.users TO anon, authenticated, service_role;
GRANT ALL ON next_auth.accounts TO anon, authenticated, service_role;
GRANT ALL ON next_auth.sessions TO anon, authenticated, service_role;
GRANT ALL ON next_auth.verification_tokens TO anon, authenticated, service_role;

-- Update our custom users table to reference NextAuth users
ALTER TABLE public.users ADD CONSTRAINT fk_users_nextauth 
  FOREIGN KEY (id) REFERENCES next_auth.users(id) ON DELETE CASCADE;