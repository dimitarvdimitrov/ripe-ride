-- Create routes table
CREATE TABLE routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id TEXT,
  platform TEXT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  distance_meters INTEGER,
  elevation_meters INTEGER,
  gpx_file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create activities table
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strava_activity_id TEXT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT,
  distance_meters INTEGER,
  elevation_meters INTEGER,
  activity_date TIMESTAMP WITH TIME ZONE,
  gpx_file_url TEXT
);

-- Create indexes for performance
CREATE INDEX idx_routes_user_id ON routes(user_id);
CREATE INDEX idx_activities_user_id ON activities(user_id);
CREATE INDEX idx_activities_activity_date ON activities(activity_date);
CREATE UNIQUE INDEX idx_routes_platform_id_platform ON routes(platform_id, platform);
