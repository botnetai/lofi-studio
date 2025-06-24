# Lofi Compilation Video Architecture

## Goal
Generate 30 lofi songs and create a 60-minute YouTube video with:
- All 30 songs combined into one continuous audio track
- A 2-5 second looping video as the visual for the entire duration
- Proper metadata and timestamps for each track

## Proposed Architecture

### 1. Data Storage Structure

**R2 Storage:**
- `/songs/` - Individual audio files (30 tracks)
- `/artwork/` - Album artwork (for video thumbnail)
- `/videos/loops/` - Short 2-5 second video loops
- `/compilations/` - Final 60-minute videos with combined audio

**D1 Database:**
- Track individual songs with metadata
- Store compilation information
- Track publishing status

### 2. Workflow

#### Step 1: Generate/Upload Songs
- Upload or generate 30 lofi tracks
- Each track ~2 minutes for 60 minutes total
- Store metadata: title, duration, BPM

#### Step 2: Create Visual Loop
- Generate a 2-5 second video loop using AI
- Options:
  - Animated artwork (subtle movement)
  - Cinemagraph style (mostly still with one moving element)
  - Particle effects over static image
  - Rain/snow effects on cozy scene

#### Step 3: Create Compilation
- Combine all 30 audio tracks into single file
- Add crossfades between tracks
- Generate timestamp list for description
- Loop the video for 60 minutes
- Combine audio + looped video

#### Step 4: Publish
- YouTube with:
  - Title: "Lofi Hip Hop Radio - 30 Tracks to Study/Relax To"
  - Thumbnail from generated artwork
  - Description with timestamps
  - Proper tags and metadata

### 3. Technical Implementation

**Audio Processing:**
```javascript
// Combine audio files with crossfade
async function createCompilation(songs) {
  // Use FFmpeg in Worker or external service
  const commands = [
    '-i', 'concat:song1.mp3|song2.mp3|...',
    '-filter_complex', '[0:a]afade=t=out:st=110:d=5[a0]...',
    '-c:a', 'libmp3lame',
    '-b:a', '320k',
    'compilation.mp3'
  ];
}
```

**Video Loop Creation:**
```javascript
// Create seamless loop from video
async function createVideoLoop(videoUrl) {
  // Use FFmpeg to:
  // 1. Ensure perfect loop (match first/last frames)
  // 2. Set duration to 2-5 seconds
  // 3. Optimize for repeated playback
}
```

**Final Video Assembly:**
```javascript
// Combine audio compilation with looped video
async function createFinalVideo(audioFile, videoLoop) {
  // FFmpeg command to:
  // 1. Loop video for audio duration
  // 2. Combine with audio track
  // 3. Add metadata
  // 4. Optimize for YouTube
}
```

### 4. YouTube Publishing Data

**Video Metadata:**
```json
{
  "title": "Lofi Hip Hop Mix - 30 Relaxing Beats [1 Hour]",
  "description": "1 hour of lofi hip hop beats to study, relax, and chill to.\n\nTracklist:\n00:00 - Track 1: Midnight Rain\n02:15 - Track 2: Coffee Shop Vibes\n...",
  "tags": ["lofi", "lofi hip hop", "study music", "chill beats", "relaxing music", "1 hour mix"],
  "category": "Music",
  "thumbnail": "generated_artwork.jpg"
}
```

### 5. Database Schema for Compilations

```sql
CREATE TABLE compilations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    total_duration INTEGER, -- in seconds
    audio_file_key TEXT, -- R2 key for combined audio
    video_loop_key TEXT, -- R2 key for video loop
    final_video_key TEXT, -- R2 key for final video
    thumbnail_key TEXT, -- R2 key for thumbnail
    tracklist TEXT, -- JSON array of song IDs in order
    timestamps TEXT, -- JSON with timestamp data
    youtube_url TEXT,
    youtube_id TEXT,
    status TEXT DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE compilation_tracks (
    compilation_id TEXT,
    song_id TEXT,
    position INTEGER,
    start_time INTEGER, -- seconds from start
    FOREIGN KEY (compilation_id) REFERENCES compilations(id),
    FOREIGN KEY (song_id) REFERENCES songs(id)
);
```

## Benefits of This Approach

1. **Efficient Storage**: Store individual songs and combine on-demand
2. **Reusability**: Songs can be used in multiple compilations
3. **Small Video Files**: 2-5 second loops are tiny compared to 60-minute videos
4. **Professional Output**: Proper timestamps and metadata for YouTube
5. **Scalability**: Can create multiple compilations with different themes

## Next Steps

1. Add FFmpeg processing capability (via external API or WASM)
2. Create compilation builder UI
3. Add video loop generation with seamless looping
4. Implement YouTube API integration
5. Add timestamp generator for video descriptions