-- Create database
CREATE DATABASE webrtc_app;

-- Connect to the database
\c webrtc_app;

-- Create rooms table
CREATE TABLE rooms (
  room_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on created_at for querying
CREATE INDEX idx_rooms_created_at ON rooms(created_at);

-- Extension for UUID generation (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
