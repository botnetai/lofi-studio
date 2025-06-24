-- Schema for Lofi Compilation Video System

-- Keep existing tables
CREATE TABLE IF NOT EXISTS songs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    duration INTEGER, -- duration in seconds
    status TEXT DEFAULT 'pending',
    metadata TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS artwork (
    id TEXT PRIMARY KEY,
    prompt TEXT NOT NULL,
    model TEXT NOT NULL,
    file_key TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add compilations table
CREATE TABLE IF NOT EXISTS compilations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    total_duration INTEGER, -- total duration in seconds
    
    -- Video loop info
    video_loop_id TEXT,
    video_loop_url TEXT,
    loop_duration INTEGER, -- loop duration in seconds (2-5s)
    
    -- Final output files
    audio_compilation_key TEXT, -- R2 key for combined audio
    final_video_key TEXT, -- R2 key for final video
    thumbnail_id TEXT, -- artwork ID for thumbnail
    
    -- Publishing info
    tracklist TEXT, -- JSON array with timestamps
    youtube_url TEXT,
    youtube_id TEXT,
    
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'ready', 'published')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Compilation tracks junction table
CREATE TABLE IF NOT EXISTS compilation_tracks (
    compilation_id TEXT NOT NULL,
    song_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    start_time INTEGER, -- seconds from compilation start
    end_time INTEGER, -- seconds from compilation start
    FOREIGN KEY (compilation_id) REFERENCES compilations(id),
    FOREIGN KEY (song_id) REFERENCES songs(id),
    PRIMARY KEY (compilation_id, position)
);

-- Video loops table (2-5 second loops for compilations)
CREATE TABLE IF NOT EXISTS video_loops (
    id TEXT PRIMARY KEY,
    name TEXT,
    source_artwork_id TEXT, -- if generated from artwork
    file_key TEXT NOT NULL,
    url TEXT NOT NULL,
    duration INTEGER, -- in seconds
    fps INTEGER,
    seamless BOOLEAN DEFAULT 0, -- whether it loops seamlessly
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_artwork_id) REFERENCES artwork(id)
);

-- Processing queue for async operations
CREATE TABLE IF NOT EXISTS processing_queue (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('audio_compilation', 'video_loop', 'final_video')),
    compilation_id TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    input_data TEXT, -- JSON with processing parameters
    output_data TEXT, -- JSON with results
    error_message TEXT,
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (compilation_id) REFERENCES compilations(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_songs_status ON songs(status);
CREATE INDEX IF NOT EXISTS idx_compilations_status ON compilations(status);
CREATE INDEX IF NOT EXISTS idx_compilation_tracks_comp ON compilation_tracks(compilation_id);
CREATE INDEX IF NOT EXISTS idx_processing_queue_status ON processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_processing_queue_type ON processing_queue(type);