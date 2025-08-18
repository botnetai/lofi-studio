-- YouTube authentication table
CREATE TABLE IF NOT EXISTS youtube_auth (
  id TEXT PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Publishing history table
CREATE TABLE IF NOT EXISTS publishing_history (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL, -- youtube, distrokid, tiktok, etc.
  album_id TEXT,
  status TEXT DEFAULT 'success', -- success, failed, pending
  metadata TEXT, -- JSON with platform-specific data
  published_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (album_id) REFERENCES albums(id)
);

-- Video renders table
CREATE TABLE IF NOT EXISTS video_renders (
  id TEXT PRIMARY KEY,
  album_id TEXT,
  status TEXT DEFAULT 'pending', -- pending, rendering, completed, failed
  video_url TEXT,
  metadata TEXT, -- JSON with render settings
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (album_id) REFERENCES albums(id)
);

-- Update albums table if needed
-- This adds the distrokid_metadata column if it doesn't exist
-- Run this only if the column doesn't exist:
-- ALTER TABLE albums ADD COLUMN distrokid_metadata TEXT;