-- Improved schema with proper asset tracking and relationships

-- Songs table (audio files)
CREATE TABLE IF NOT EXISTS songs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    artist TEXT,
    duration INTEGER, -- in seconds
    file_key TEXT NOT NULL, -- R2 key for the audio file
    file_size INTEGER, -- in bytes
    file_type TEXT DEFAULT 'audio/mpeg',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    metadata TEXT DEFAULT '{}', -- JSON for additional metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Artwork table (generated images)
CREATE TABLE IF NOT EXISTS artwork (
    id TEXT PRIMARY KEY,
    prompt TEXT NOT NULL,
    model TEXT NOT NULL, -- AI model used
    model_params TEXT DEFAULT '{}', -- JSON parameters used
    file_key TEXT NOT NULL, -- R2 key for the image file
    file_size INTEGER,
    file_type TEXT DEFAULT 'image/jpeg',
    width INTEGER,
    height INTEGER,
    fal_url TEXT, -- Original Fal.ai URL (for reference)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Videos table (generated videos)
CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,
    artwork_id TEXT, -- Source artwork used
    model TEXT NOT NULL, -- AI model used
    model_params TEXT DEFAULT '{}', -- JSON parameters used
    file_key TEXT NOT NULL, -- R2 key for the video file
    file_size INTEGER,
    file_type TEXT DEFAULT 'video/mp4',
    duration INTEGER, -- in seconds
    fps INTEGER,
    width INTEGER,
    height INTEGER,
    fal_url TEXT, -- Original Fal.ai URL (for reference)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (artwork_id) REFERENCES artwork(id)
);

-- Albums table
CREATE TABLE IF NOT EXISTS albums (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    artist TEXT NOT NULL,
    artwork_id TEXT, -- Primary artwork for the album
    release_date DATE,
    genre TEXT DEFAULT 'lofi',
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'published')),
    metadata TEXT DEFAULT '{}', -- JSON for additional metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (artwork_id) REFERENCES artwork(id)
);

-- Album tracks junction table
CREATE TABLE IF NOT EXISTS album_tracks (
    album_id TEXT NOT NULL,
    song_id TEXT NOT NULL,
    track_number INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (album_id, song_id),
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
    FOREIGN KEY (song_id) REFERENCES songs(id)
);

-- Publishing records
CREATE TABLE IF NOT EXISTS publishing_records (
    id TEXT PRIMARY KEY,
    album_id TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('distrokid', 'youtube', 'tiktok')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'published', 'failed')),
    platform_response TEXT, -- JSON response from platform
    published_url TEXT, -- URL where content is published
    published_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (album_id) REFERENCES albums(id)
);

-- Audit log for tracking changes
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL, -- 'song', 'album', 'artwork', etc.
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL, -- 'create', 'update', 'delete', 'status_change'
    old_values TEXT, -- JSON of previous values
    new_values TEXT, -- JSON of new values
    user_agent TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_songs_status ON songs(status);
CREATE INDEX IF NOT EXISTS idx_songs_created ON songs(created_at);
CREATE INDEX IF NOT EXISTS idx_songs_artist ON songs(artist);

CREATE INDEX IF NOT EXISTS idx_artwork_created ON artwork(created_at);
CREATE INDEX IF NOT EXISTS idx_artwork_model ON artwork(model);

CREATE INDEX IF NOT EXISTS idx_videos_artwork ON videos(artwork_id);
CREATE INDEX IF NOT EXISTS idx_videos_created ON videos(created_at);

CREATE INDEX IF NOT EXISTS idx_albums_status ON albums(status);
CREATE INDEX IF NOT EXISTS idx_albums_artist ON albums(artist);
CREATE INDEX IF NOT EXISTS idx_albums_created ON albums(created_at);

CREATE INDEX IF NOT EXISTS idx_album_tracks_album ON album_tracks(album_id);
CREATE INDEX IF NOT EXISTS idx_album_tracks_song ON album_tracks(song_id);

CREATE INDEX IF NOT EXISTS idx_publishing_album ON publishing_records(album_id);
CREATE INDEX IF NOT EXISTS idx_publishing_platform ON publishing_records(platform);
CREATE INDEX IF NOT EXISTS idx_publishing_status ON publishing_records(status);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

-- Triggers to update timestamps
CREATE TRIGGER update_songs_timestamp 
AFTER UPDATE ON songs
BEGIN
    UPDATE songs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_albums_timestamp 
AFTER UPDATE ON albums
BEGIN
    UPDATE albums SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_publishing_timestamp 
AFTER UPDATE ON publishing_records
BEGIN
    UPDATE publishing_records SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;