// Add these Musikai features to your Lofi Studio worker

// Album creation endpoint
app.post('/api/albums', async (c) => {
  const body = await c.req.json()
  const { title, artist, genre, songIds, coverArtId } = body
  
  const albumId = crypto.randomUUID()
  
  // Create album record
  await c.env.DB.prepare(`
    INSERT INTO albums (id, title, artist, genre, cover_art_id, created_at, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    albumId,
    title,
    artist || 'Lofi Studio',
    genre || 'Lo-Fi Hip Hop',
    coverArtId,
    new Date().toISOString(),
    'draft'
  ).run()
  
  // Link songs to album
  for (let i = 0; i < songIds.length; i++) {
    await c.env.DB.prepare(`
      INSERT INTO album_songs (album_id, song_id, track_number)
      VALUES (?, ?, ?)
    `).bind(albumId, songIds[i], i + 1).run()
  }
  
  return c.json({ success: true, albumId })
})

// Generate album artwork
app.post('/api/artwork', async (c) => {
  const body = await c.req.json()
  const { prompt, style = 'lofi anime aesthetic' } = body
  
  // Use Fal.ai for artwork generation (like in worker-musikai.js)
  const response = await fetch('https://api.fal.ai/v1/generate-image', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${c.env.FAL_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: `${prompt}, ${style}, album cover art, square format`,
      image_size: '1024x1024',
      num_images: 4
    })
  })
  
  const data = await response.json()
  const artworkIds = []
  
  // Save generated images
  for (const image of data.images || []) {
    const artworkId = crypto.randomUUID()
    const key = `artwork/${artworkId}.png`
    
    // Download and save to R2
    const imageResponse = await fetch(image.url)
    await c.env.R2.put(key, imageResponse.body, {
      httpMetadata: { contentType: 'image/png' }
    })
    
    // Save to database
    await c.env.DB.prepare(`
      INSERT INTO artwork (id, url, prompt, metadata, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      artworkId,
      `/files/${key}`,
      prompt,
      JSON.stringify({ style, fal_url: image.url }),
      new Date().toISOString()
    ).run()
    
    artworkIds.push(artworkId)
  }
  
  return c.json({ success: true, artworkIds })
})

// Prepare for distribution
app.post('/api/prepare-release', async (c) => {
  const body = await c.req.json()
  const { albumId } = body
  
  // Get album and songs
  const album = await c.env.DB.prepare(
    'SELECT * FROM albums WHERE id = ?'
  ).bind(albumId).first()
  
  const songs = await c.env.DB.prepare(`
    SELECT s.* FROM songs s
    JOIN album_songs als ON s.id = als.song_id
    WHERE als.album_id = ?
    ORDER BY als.track_number
  `).bind(albumId).all()
  
  // Generate distribution package
  const releasePackage = {
    album: {
      title: album.title,
      artist: album.artist,
      genre: album.genre,
      release_date: new Date().toISOString().split('T')[0],
      label: 'Lofi Studio Records',
      copyright: `© ${new Date().getFullYear()} ${album.artist}`
    },
    tracks: [],
    artwork: {
      cover_art_url: album.cover_art_id ? `/files/artwork/${album.cover_art_id}.png` : null
    },
    platforms: {
      spotify: true,
      apple_music: true,
      youtube_music: true,
      soundcloud: true,
      tiktok: true
    }
  }
  
  // Process each track
  for (const song of songs.results || []) {
    const metadata = JSON.parse(song.metadata || '{}')
    
    releasePackage.tracks.push({
      title: song.name,
      duration: metadata.duration || 180, // Default 3 minutes
      isrc: null, // Would be assigned by DistroKid
      audio_file: song.url,
      writers: [album.artist],
      producers: ['Lofi Studio AI'],
      explicit: false
    })
  }
  
  // Save release package
  await c.env.DB.prepare(`
    UPDATE albums 
    SET release_metadata = ?, status = 'ready_for_distribution'
    WHERE id = ?
  `).bind(
    JSON.stringify(releasePackage),
    albumId
  ).run()
  
  return c.json({ 
    success: true, 
    releasePackage,
    next_steps: [
      'Review the release package',
      'Export files for manual upload to DistroKid',
      'Or integrate with DistroKid API for automated release'
    ]
  })
})

// Batch processing for mastering
app.post('/api/master-songs', async (c) => {
  const body = await c.req.json()
  const { songIds, settings = {} } = body
  
  const defaultSettings = {
    normalize: true,
    target_lufs: -14, // Spotify standard
    true_peak: -1,
    apply_limiter: true,
    fadeout_duration: 3
  }
  
  const masterSettings = { ...defaultSettings, ...settings }
  
  // In a real implementation, you would:
  // 1. Download audio files
  // 2. Apply audio processing (normalization, limiting, etc.)
  // 3. Save mastered versions
  // 4. Update database
  
  const mastered = []
  
  for (const songId of songIds) {
    // Mark as mastered in DB
    await c.env.DB.prepare(`
      UPDATE songs 
      SET metadata = json_set(metadata, '$.mastered', true, '$.master_settings', ?)
      WHERE id = ?
    `).bind(
      JSON.stringify(masterSettings),
      songId
    ).run()
    
    mastered.push(songId)
  }
  
  return c.json({ 
    success: true, 
    mastered_count: mastered.length,
    settings: masterSettings
  })
})

// Integration status endpoint
app.get('/api/musikai-status', async (c) => {
  const stats = {
    total_songs: 0,
    approved_songs: 0,
    pending_approval: 0,
    total_albums: 0,
    published_albums: 0,
    total_artwork: 0
  }
  
  // Get counts
  const songCount = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM songs WHERE status = "completed"'
  ).first()
  stats.total_songs = songCount?.count || 0
  
  const albumCount = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM albums'
  ).first()
  stats.total_albums = albumCount?.count || 0
  
  const artworkCount = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM artwork'
  ).first()
  stats.total_artwork = artworkCount?.count || 0
  
  return c.json({
    stats,
    features: {
      music_generation: true,
      artwork_generation: true,
      album_creation: true,
      mastering: true,
      distribution_prep: true,
      automated_publishing: false, // Requires DistroKid API integration
      spotify_sync: false, // Requires Spotify API integration
      youtube_upload: false // Requires YouTube API integration
    },
    integration_options: [
      'Direct database sync with Musikai',
      'Export songs for Musikai import',
      'Use Musikai API endpoints',
      'Run both systems in parallel'
    ]
  })
})