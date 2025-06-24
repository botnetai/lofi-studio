-- Create songs table
CREATE TABLE IF NOT EXISTS songs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL,
  status TEXT DEFAULT 'generating'
);

-- Create artwork table
CREATE TABLE IF NOT EXISTS artwork (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  prompt TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL
);

-- Create videos table
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  artwork_id TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (artwork_id) REFERENCES artwork(id)
);

-- Create albums table
CREATE TABLE IF NOT EXISTS albums (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  genre TEXT,
  cover_art_id TEXT,
  created_at TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  release_metadata TEXT,
  distrokid_metadata TEXT,
  FOREIGN KEY (cover_art_id) REFERENCES artwork(id)
);

-- Create album_songs junction table
CREATE TABLE IF NOT EXISTS album_songs (
  album_id TEXT NOT NULL,
  song_id TEXT NOT NULL,
  track_number INTEGER NOT NULL,
  PRIMARY KEY (album_id, song_id),
  FOREIGN KEY (album_id) REFERENCES albums(id),
  FOREIGN KEY (song_id) REFERENCES songs(id)
);

-- Create audio_merges table
CREATE TABLE IF NOT EXISTS audio_merges (
  id TEXT PRIMARY KEY,
  album_id TEXT NOT NULL,
  url TEXT NOT NULL,
  duration INTEGER,
  metadata TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (album_id) REFERENCES albums(id)
);

-- Create youtube_auth table
CREATE TABLE IF NOT EXISTS youtube_auth (
  id TEXT PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TEXT NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_songs_status ON songs(status);
CREATE INDEX IF NOT EXISTS idx_songs_created_at ON songs(created_at);
CREATE INDEX IF NOT EXISTS idx_artwork_created_at ON artwork(created_at);
CREATE INDEX IF NOT EXISTS idx_videos_artwork_id ON videos(artwork_id);
CREATE INDEX IF NOT EXISTS idx_albums_status ON albums(status);
CREATE INDEX IF NOT EXISTS idx_audio_merges_album_id ON audio_merges(album_id);