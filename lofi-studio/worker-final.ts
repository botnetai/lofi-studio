import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Env = {
  DB: D1Database
  R2: R2Bucket
  AI: any
  GOAPI_KEY: string
  UDIOAPI_KEY: string
  FAL_KEY: string
  JSON2VIDEO_KEY: string
}

const app = new Hono<{ Bindings: Env }>()

// Enable CORS for all routes
app.use('*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization', 'Range'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
  exposeHeaders: ['Content-Length', 'Content-Type', 'Content-Range', 'Accept-Ranges'],
  maxAge: 600,
  credentials: true,
}))

// API Routes
app.get('/api/songs', async (c) => {
  const songs = await c.env.DB.prepare('SELECT * FROM songs ORDER BY created_at DESC').all()
  return c.json(songs.results || [])
})

app.post('/api/generate-music', async (c) => {
  const body = await c.req.json()
  const { prompt = 'lofi beat', customMode = false, title, tags, make_instrumental = true, model } = body
  
  // Prepare request for API
  const apiBody: any = {
    make_instrumental,
    wait_audio: false
  }
  
  // Add model if specified
  if (model) {
    apiBody.model = model
  }
  
  if (customMode) {
    apiBody.prompt = prompt
    if (title) apiBody.title = title
    if (tags) apiBody.tags = tags
  } else {
    apiBody.gpt_description_prompt = prompt
  }
  
  console.log('Sending to Udio API:', JSON.stringify(apiBody))
  
  // Start generation with AI Music API
  try {
    const response = await fetch('https://udioapi.pro/api/v2/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.UDIOAPI_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(apiBody)
    })
    
    const responseText = await response.text()
    console.log('Generate response:', responseText)
    
    if (!response.ok) {
      console.error('AI Music API error:', responseText)
      return c.json({ 
        error: 'Failed to start generation',
        details: responseText
      }, 500)
    }
    
    let data
    try {
      data = JSON.parse(responseText)
    } catch (e) {
      return c.json({ 
        error: 'Invalid response from API',
        details: responseText 
      }, 500)
    }
    
    // Get the actual work ID from the response
    const actualWorkId = data.workId || data.work_id || data.id || data.generation_id || data.data?.workId || data.data?.id
    
    if (!actualWorkId) {
      console.error('No workId found in response:', JSON.stringify(data))
      return c.json({ 
        error: 'No work ID in response',
        response: data 
      }, 500)
    }
    
    console.log('Got workId:', actualWorkId)
    
    // Create placeholders for both expected variants
    const timestamp = new Date().toISOString()
    const songIds = []
    
    // Create first variant placeholder
    const songId1 = crypto.randomUUID()
    songIds.push(songId1)
    const placeholderTitle1 = customMode && title ? `${title} (Variant 1)` : `Generating: ${prompt.substring(0, 50)}... (Variant 1)`
    
    await c.env.DB.prepare(`
      INSERT INTO songs (id, name, url, metadata, created_at, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      songId1,
      placeholderTitle1,
      '',
      JSON.stringify({ 
        workId: actualWorkId, 
        prompt, 
        customMode, 
        title, 
        tags, 
        status: 'generating',
        variant: 1,
        groupId: songId1
      }),
      timestamp,
      'generating'
    ).run()
    
    // Create second variant placeholder
    const songId2 = crypto.randomUUID()
    songIds.push(songId2)
    const placeholderTitle2 = customMode && title ? `${title} (Variant 2)` : `Generating: ${prompt.substring(0, 50)}... (Variant 2)`
    
    await c.env.DB.prepare(`
      INSERT INTO songs (id, name, url, metadata, created_at, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      songId2,
      placeholderTitle2,
      '',
      JSON.stringify({ 
        workId: actualWorkId, 
        prompt, 
        customMode, 
        title, 
        tags, 
        status: 'generating',
        variant: 2,
        groupId: songId1
      }),
      timestamp,
      'generating'
    ).run()
    
    return c.json({ 
      success: true, 
      workId: actualWorkId,
      songIds
    })
  } catch (error) {
    console.error('Generate music error:', error)
    return c.json({ 
      error: 'Failed to generate music',
      details: error.message 
    }, 500)
  }
})

app.get('/api/generate-music-status', async (c) => {
  const workId = c.req.query('workId')
  if (!workId) {
    return c.json({ error: 'Work ID required' }, 400)
  }
  
  console.log('Checking status for workId:', workId)
  
  try {
    // Check the Udio API status endpoint
    const response = await fetch(`https://udioapi.pro/api/v2/feed?workId=${workId}`, {
      headers: {
        'Authorization': `Bearer ${c.env.UDIOAPI_KEY}`
      }
    })
    
    const data = await response.json()
    console.log('API Response:', JSON.stringify(data, null, 2))
    
    // Check if we have response data
    if (data && data.data && data.data.response_data && Array.isArray(data.data.response_data)) {
      const tracks = data.data.response_data
      console.log(`Found ${tracks.length} tracks in response`)
      
      // Get all DB records for this workId
      const songs = await c.env.DB.prepare(
        "SELECT * FROM songs WHERE json_extract(metadata, '$.workId') = ? ORDER BY json_extract(metadata, '$.variant')"
      ).bind(workId).all()
      
      if (songs.results && songs.results.length > 0) {
        let updatedCount = 0
        
        // Update each variant with its corresponding track
        for (let i = 0; i < Math.min(tracks.length, songs.results.length); i++) {
          const track = tracks[i]
          const song = songs.results[i]
          
          if (track.audio_url) {
            console.log(`Updating variant ${i + 1} with track:`, track.title)
            
            try {
              // Download and save audio
              const audioResponse = await fetch(track.audio_url)
              if (audioResponse.ok) {
                const audioBlob = await audioResponse.blob()
                const audioKey = `songs/${song.id}.mp3`
                
                await c.env.R2.put(audioKey, audioBlob.stream(), {
                  httpMetadata: { 
                    contentType: 'audio/mpeg',
                    contentLength: audioBlob.size.toString()
                  }
                })
                
                // Update database record
                const metadata = JSON.parse(song.metadata as string || '{}')
                metadata.title = track.title
                metadata.duration = track.duration
                metadata.status = 'completed'
                metadata.audio_url = track.audio_url
                metadata.completedAt = new Date().toISOString()
                
                await c.env.DB.prepare(`
                  UPDATE songs 
                  SET name = ?, url = ?, metadata = ?, status = 'completed'
                  WHERE id = ?
                `).bind(
                  track.title + (songs.results.length > 1 ? ` (Variant ${i + 1})` : ''),
                  `/files/${audioKey}`,
                  JSON.stringify(metadata),
                  song.id
                ).run()
                
                updatedCount++
              }
            } catch (error) {
              console.error(`Error saving variant ${i + 1}:`, error)
            }
          }
        }
        
        if (updatedCount > 0) {
          return c.json({ 
            status: 'completed',
            tracksUpdated: updatedCount,
            totalTracks: tracks.length
          })
        }
      }
    }
    
    // Still processing
    return c.json({ 
      status: 'processing',
      data: data
    })
  } catch (error) {
    console.error('Status check error:', error)
    return c.json({ 
      status: 'error',
      error: error.message
    })
  }
})

// Manual refresh stuck songs
app.post('/api/refresh-stuck', async (c) => {
  const stuckSongs = await c.env.DB.prepare(`
    SELECT DISTINCT json_extract(metadata, '$.workId') as workId
    FROM songs 
    WHERE status = 'generating'
    AND created_at < datetime('now', '-5 minutes')
  `).all()
  
  let updatedCount = 0
  const errors = []
  
  for (const song of stuckSongs.results || []) {
    if (!song.workId) continue
    
    try {
      const response = await fetch(`https://udioapi.pro/api/v2/feed?workId=${song.workId}`, {
        headers: {
          'Authorization': `Bearer ${c.env.UDIOAPI_KEY}`
        }
      })
      
      const data = await response.json()
      
      if (data && data.data && data.data.response_data && Array.isArray(data.data.response_data)) {
        const tracks = data.data.response_data
        
        // Get all DB records for this workId
        const songs = await c.env.DB.prepare(
          "SELECT * FROM songs WHERE json_extract(metadata, '$.workId') = ? ORDER BY json_extract(metadata, '$.variant')"
        ).bind(song.workId).all()
        
        if (songs.results) {
          for (let i = 0; i < Math.min(tracks.length, songs.results.length); i++) {
            const track = tracks[i]
            const dbSong = songs.results[i]
            
            if (track.audio_url) {
              try {
                const audioResponse = await fetch(track.audio_url)
                if (audioResponse.ok) {
                  const audioBlob = await audioResponse.blob()
                  const audioKey = `songs/${dbSong.id}.mp3`
                  
                  await c.env.R2.put(audioKey, audioBlob.stream(), {
                    httpMetadata: { 
                      contentType: 'audio/mpeg',
                      contentLength: audioBlob.size.toString()
                    }
                  })
                  
                  const metadata = JSON.parse(dbSong.metadata as string || '{}')
                  metadata.title = track.title
                  metadata.duration = track.duration
                  metadata.status = 'completed'
                  metadata.audio_url = track.audio_url
                  metadata.completedAt = new Date().toISOString()
                  
                  await c.env.DB.prepare(`
                    UPDATE songs 
                    SET name = ?, url = ?, metadata = ?, status = 'completed'
                    WHERE id = ?
                  `).bind(
                    track.title + (songs.results.length > 1 ? ` (Variant ${i + 1})` : ''),
                    `/files/${audioKey}`,
                    JSON.stringify(metadata),
                    dbSong.id
                  ).run()
                  
                  updatedCount++
                }
              } catch (error) {
                console.error(`Error updating song ${dbSong.id}:`, error)
                errors.push({ songId: dbSong.id, error: error.message })
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error checking workId ${song.workId}:`, error)
      errors.push({ workId: song.workId, error: error.message })
    }
  }
  
  return c.json({ 
    stuckCount: stuckSongs.results?.length || 0,
    updatedCount,
    errors: errors.length > 0 ? errors : undefined
  })
})

// File serving
app.get('/files/*', async (c) => {
  const path = c.req.path.replace('/files/', '')
  
  try {
    const object = await c.env.R2.get(path)
    
    if (!object) {
      return c.text('File not found', 404)
    }
    
    const headers = new Headers()
    headers.set('Content-Type', object.httpMetadata?.contentType || 'audio/mpeg')
    headers.set('Accept-Ranges', 'bytes')
    headers.set('Cache-Control', 'public, max-age=86400')
    
    if (object.size) {
      headers.set('Content-Length', object.size.toString())
    }
    
    const range = c.req.header('Range')
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-")
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : object.size - 1
      
      headers.set('Content-Range', `bytes ${start}-${end}/${object.size}`)
      headers.set('Content-Length', (end - start + 1).toString())
      
      return new Response(object.body, {
        status: 206,
        headers
      })
    }
    
    return new Response(object.body, { headers })
  } catch (error) {
    console.error('File serving error:', error)
    return c.text('Error serving file', 500)
  }
})

// Delete song
app.delete('/api/songs/:id', async (c) => {
  const id = c.req.param('id')
  
  try {
    // Get song metadata to find related songs
    const song = await c.env.DB.prepare('SELECT * FROM songs WHERE id = ?').bind(id).first()
    if (!song) {
      return c.json({ error: 'Song not found' }, 404)
    }
    
    const metadata = JSON.parse(song.metadata as string || '{}')
    const groupId = metadata.groupId
    
    // Delete all songs in the group if they share the same groupId
    if (groupId) {
      const songs = await c.env.DB.prepare(
        "SELECT * FROM songs WHERE json_extract(metadata, '$.groupId') = ?"
      ).bind(groupId).all()
      
      for (const s of songs.results || []) {
        // Delete from R2
        if (s.url) {
          const key = s.url.replace('/files/', '')
          await c.env.R2.delete(key)
        }
        
        // Delete from DB
        await c.env.DB.prepare('DELETE FROM songs WHERE id = ?').bind(s.id).run()
      }
    } else {
      // Delete single song
      if (song.url) {
        const key = song.url.replace('/files/', '')
        await c.env.R2.delete(key)
      }
      
      await c.env.DB.prepare('DELETE FROM songs WHERE id = ?').bind(id).run()
    }
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Delete error:', error)
    return c.json({ error: 'Failed to delete song' }, 500)
  }
})

// Generate artwork using Fal.ai
app.post('/api/artwork', async (c) => {
  const body = await c.req.json()
  const { prompt, style = 'lofi anime aesthetic, album cover art', numImages = 4, model = 'flux-schnell' } = body
  
  // Map model names to Fal.ai endpoints
  const modelEndpoints = {
    'flux-schnell': 'https://fal.run/fal-ai/flux/schnell',
    'flux-dev': 'https://fal.run/fal-ai/flux/dev',
    'flux-pro': 'https://fal.run/fal-ai/flux-pro',
    'stable-diffusion-xl': 'https://fal.run/fal-ai/stable-diffusion-xl'
  }
  
  const endpoint = modelEndpoints[model] || modelEndpoints['flux-schnell']
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${c.env.FAL_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: `${prompt}, ${style}, high quality, detailed`,
        image_size: 'square_hd',
        num_images: numImages,
        enable_safety_checker: true
      })
    })
    
    if (!response.ok) {
      throw new Error(`Fal.ai error: ${response.statusText}`)
    }
    
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
        JSON.stringify({ style, model, fal_url: image.url }),
        new Date().toISOString()
      ).run()
      
      artworkIds.push({
        id: artworkId,
        url: `/files/${key}`
      })
    }
    
    return c.json({ success: true, artworkIds })
  } catch (error) {
    console.error('Artwork generation error:', error)
    return c.json({ error: error.message }, 500)
  }
})

// Generate video using various AI models
app.post('/api/video', async (c) => {
  const body = await c.req.json()
  const { 
    imageId, 
    prompt = '', 
    model = 'kling-1.6', 
    enableLoop = false, 
    duration = 5,
    seed = -1,
    cfgScale = 0.5,
    mode = 'standard',
    tailImageId = null
  } = body
  
  try {
    // Get image URL
    const artwork = await c.env.DB.prepare(
      'SELECT * FROM artwork WHERE id = ?'
    ).bind(imageId).first()
    
    if (!artwork) {
      return c.json({ error: 'Artwork not found' }, 404)
    }
    
    // Get full URL for the artwork
    const origin = c.req.header('origin') || `https://${c.req.header('host')}`
    const fullImageUrl = artwork.url.startsWith('http') ? artwork.url : `${origin}${artwork.url}`
    
    // Get tail image URL if provided
    let fullTailImageUrl = null
    if (tailImageId) {
      const tailArtwork = await c.env.DB.prepare(
        'SELECT * FROM artwork WHERE id = ?'
      ).bind(tailImageId).first()
      
      if (tailArtwork) {
        fullTailImageUrl = tailArtwork.url.startsWith('http') 
          ? tailArtwork.url 
          : `${origin}${tailArtwork.url}`
      }
    }
    
    console.log('Using image URL:', fullImageUrl)
    if (fullTailImageUrl) console.log('Using tail image URL:', fullTailImageUrl)
    
    // Map models to endpoints and configurations
    const modelConfigs = {
      'kling-1.6': {
        endpoint: mode === 'pro' 
          ? 'https://fal.run/fal-ai/kling-video/v1.6/pro/image-to-video'
          : 'https://fal.run/fal-ai/kling-video/v1.6/image-to-video',
        params: {
          image_url: fullImageUrl,
          prompt: prompt || 'smooth camera movement, cinematic',
          duration: duration.toString(),
          cfg_scale: cfgScale,
          seed: seed === -1 ? Math.floor(Math.random() * 1000000) : seed,
          ...(fullTailImageUrl && { tail_image_url: fullTailImageUrl })
        }
      },
      'kling-1.5': {
        endpoint: 'https://fal.run/fal-ai/kling-video/v1.5/image-to-video',
        params: {
          image_url: fullImageUrl,
          prompt: prompt || 'smooth camera movement',
          duration: duration.toString(),
          cfg_scale: cfgScale,
          seed: seed === -1 ? Math.floor(Math.random() * 1000000) : seed
        }
      },
      'stable-video': {
        endpoint: 'https://fal.run/fal-ai/stable-video-diffusion',
        params: {
          image_url: fullImageUrl,
          motion_bucket_id: 127,
          cond_aug: 0.02,
          fps: duration <= 4 ? 6 : 10,
          seed: Math.floor(Math.random() * 1000000)
        }
      },
      'animatediff-sparsectrl': {
        endpoint: 'https://fal.run/fal-ai/animatediff-sparsectrl-lcm',
        params: {
          image_url: fullImageUrl,
          prompt: prompt || 'smooth camera movement, cinematic motion',
          n_prompt: 'worst quality, low quality, nsfw',
          guidance_scale: 1.2,
          num_inference_steps: 6,
          gif: false,
          frames: duration * 8
        }
      },
      'animatediff-lightning': {
        endpoint: 'https://fal.run/fal-ai/animatediff-v2v',
        params: {
          image_url: fullImageUrl,
          prompt: prompt || 'smooth cinematic camera movement',
          negative_prompt: 'worst quality, low quality',
          guidance_scale: 7.5,
          num_inference_steps: 20,
          video_length: duration * 8
        }
      }
    }
    
    const config = modelConfigs[model] || modelConfigs['stable-video']
    
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${c.env.FAL_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config.params)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Video generation failed:', errorText)
      throw new Error(`Video generation error: ${response.statusText}. ${errorText}`)
    }
    
    const data = await response.json()
    console.log('Video generation response:', data)
    
    // Get video URL from response
    const videoUrl = data.video?.url || data.video_url || data.url || data.output
    
    if (!videoUrl) {
      throw new Error('No video URL in response')
    }
    
    const videoId = crypto.randomUUID()
    const key = `videos/${videoId}.mp4`
    
    // Download and save video
    const videoResponse = await fetch(videoUrl)
    await c.env.R2.put(key, videoResponse.body, {
      httpMetadata: { contentType: 'video/mp4' }
    })
    
    // Save to database
    await c.env.DB.prepare(`
      INSERT INTO videos (id, url, artwork_id, metadata, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      videoId,
      `/files/${key}`,
      imageId,
      JSON.stringify({ 
        model, 
        prompt, 
        enableLoop,
        duration,
        fal_url: videoUrl 
      }),
      new Date().toISOString()
    ).run()
    
    return c.json({ 
      success: true, 
      videoId,
      url: `/files/${key}`
    })
  } catch (error) {
    console.error('Video generation error:', error)
    return c.json({ error: error.message }, 500)
  }
})

// Create album/compilation
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

// Prepare for DistroKid
app.post('/api/prepare-distrokid', async (c) => {
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
  
  // Generate DistroKid package
  const distroPackage = {
    album: {
      title: album.title,
      artist: album.artist,
      genre: album.genre,
      release_date: new Date().toISOString().split('T')[0],
      label: 'Lofi Studio Records',
      copyright: `℗ ${new Date().getFullYear()} ${album.artist}`,
      upc: null // Will be assigned by DistroKid
    },
    tracks: [],
    artwork: {
      cover_art_url: album.cover_art_id ? `/files/artwork/${album.cover_art_id}.png` : null
    },
    platforms: {
      spotify: true,
      apple_music: true,
      youtube_music: true,
      amazon_music: true,
      tidal: true,
      deezer: true,
      tiktok: true,
      instagram: true
    }
  }
  
  // Process each track
  for (const song of songs.results || []) {
    const metadata = JSON.parse(song.metadata || '{}')
    
    distroPackage.tracks.push({
      title: song.name,
      duration_seconds: metadata.duration || 180,
      isrc: null, // Will be assigned by DistroKid
      audio_file: song.url,
      writers: [album.artist],
      producers: ['Lofi Studio AI'],
      explicit: false,
      language: 'Instrumental',
      primary_genre: 'Hip-Hop',
      secondary_genre: 'Electronic'
    })
  }
  
  // Save DistroKid package
  await c.env.DB.prepare(`
    UPDATE albums 
    SET distrokid_metadata = ?, status = 'ready_for_distribution'
    WHERE id = ?
  `).bind(
    JSON.stringify(distroPackage),
    albumId
  ).run()
  
  return c.json({ 
    success: true, 
    distroPackage,
    instructions: {
      manual_steps: [
        '1. Download all audio files from the URLs provided',
        '2. Download the cover art from the URL provided',
        '3. Log into DistroKid',
        '4. Create new release with the metadata provided',
        '5. Upload audio files in the correct track order',
        '6. Upload cover art (3000x3000 recommended)',
        '7. Select distribution platforms',
        '8. Submit for distribution'
      ],
      automation_note: 'For automated distribution, integrate DistroKid API'
    }
  })
})

// Get all artwork
app.get('/api/artwork', async (c) => {
  const artwork = await c.env.DB.prepare('SELECT * FROM artwork ORDER BY created_at DESC').all()
  return c.json(artwork.results || [])
})

// Get all albums
app.get('/api/albums', async (c) => {
  const albums = await c.env.DB.prepare('SELECT * FROM albums ORDER BY created_at DESC').all()
  return c.json(albums.results || [])
})

// Get all videos
app.get('/api/videos', async (c) => {
  const videos = await c.env.DB.prepare('SELECT * FROM videos ORDER BY created_at DESC').all()
  return c.json(videos.results || [])
})

// Get distribution-ready albums for desktop app
app.get('/api/distribution/pending', async (c) => {
  const albums = await c.env.DB.prepare(`
    SELECT a.*, 
           (SELECT COUNT(*) FROM album_songs WHERE album_id = a.id) as track_count
    FROM albums a 
    WHERE a.status = 'ready_for_distribution' 
    ORDER BY a.created_at DESC
  `).all()
  
  return c.json(albums.results || [])
})

// Mark album as published
app.post('/api/distribution/complete/:albumId', async (c) => {
  const albumId = c.req.param('albumId')
  const body = await c.req.json()
  const { upc, platform_ids } = body
  
  await c.env.DB.prepare(`
    UPDATE albums 
    SET status = 'published',
        distrokid_metadata = json_set(
          COALESCE(distrokid_metadata, '{}'),
          '$.upc', ?,
          '$.platform_ids', ?,
          '$.published_at', ?
        )
    WHERE id = ?
  `).bind(
    upc,
    JSON.stringify(platform_ids),
    new Date().toISOString(),
    albumId
  ).run()
  
  return c.json({ success: true })
})

// Get album songs
app.get('/api/albums/:albumId/songs', async (c) => {
  const albumId = c.req.param('albumId')
  
  const songs = await c.env.DB.prepare(`
    SELECT s.* FROM songs s
    JOIN album_songs als ON s.id = als.song_id
    WHERE als.album_id = ?
    ORDER BY als.track_number
  `).bind(albumId).all()
  
  return c.json(songs.results || [])
})

// YouTube OAuth2 endpoints
app.get('/api/youtube/auth', async (c) => {
  const CLIENT_ID = c.env.YOUTUBE_CLIENT_ID || 'YOUR_CLIENT_ID'
  const REDIRECT_URI = `${c.req.url.origin}/api/youtube/callback`
  
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent('https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube')}&` +
    `access_type=offline&` +
    `prompt=consent`
  
  return c.redirect(authUrl)
})

// OAuth2 callback
app.get('/api/youtube/callback', async (c) => {
  const code = c.req.query('code')
  const CLIENT_ID = c.env.YOUTUBE_CLIENT_ID
  const CLIENT_SECRET = c.env.YOUTUBE_CLIENT_SECRET
  const REDIRECT_URI = `${c.req.url.origin}/api/youtube/callback`
  
  if (!code) {
    return c.json({ error: 'No authorization code provided' }, 400)
  }
  
  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    })
    
    const tokens = await tokenResponse.json()
    
    // Store tokens in D1 (in production, encrypt these)
    await c.env.DB.prepare(`
      INSERT OR REPLACE INTO youtube_auth (id, access_token, refresh_token, expires_at)
      VALUES ('default', ?, ?, ?)
    `).bind(
      tokens.access_token,
      tokens.refresh_token,
      new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    ).run()
    
    // Redirect back to publish tab
    return c.redirect('/#publish?youtube=connected')
  } catch (error) {
    return c.json({ error: error.message }, 500)
  }
})

// Prepare YouTube upload
app.post('/api/youtube/prepare', async (c) => {
  const body = await c.req.json()
  const { albumId, apiKey, videoStyle, album, songs } = body
  
  try {
    // Generate description
    const description = `${album.title} by ${album.artist}
    
Full album lofi music compilation.

Tracklist:
${songs.map((song, idx) => {
  const minutes = Math.floor(idx * 3);
  const seconds = (idx * 3) % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} - ${song.name}`;
}).join('\n')}

Created with Lofi Studio - AI-powered music generation
    
#lofi #lofihiphop #studymusic #chillbeats #relaxingmusic`
    
    // Generate tags
    const tags = [
      'lofi', 'lofi hip hop', 'study music', 'chill beats',
      'relaxing music', 'lofi mix', 'lofi compilation',
      album.artist.toLowerCase(), album.title.toLowerCase()
    ]
    
    // Step 1: Generate video based on style
    let videoData;
    const origin = c.req.header('origin') || `https://${c.req.header('host')}`
    
    if (videoStyle === 'static' || videoStyle === 'animated') {
      // Generate video with either static image or looping video
      const videoGenResponse = await fetch(`${origin}/api/video/generate-static`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          albumId,
          album,
          songs,
          videoStyle,
          videoLoopId: body.videoLoopId // Optional: ID of video to loop
        })
      })
      
      if (!videoGenResponse.ok) {
        const error = await videoGenResponse.json()
        throw new Error(error.error || 'Failed to generate video')
      }
      
      videoData = await videoGenResponse.json()
    } else {
      // For other styles, return instructions for manual creation
      videoData = {
        status: 'manual',
        message: 'Please create video manually for this style'
      }
    }
    
    // Step 2: Create YouTube upload URL (requires OAuth2, not just API key)
    // YouTube requires OAuth2 for uploads, not just API key
    // We'll need to implement OAuth2 flow or use service account
    
    return c.json({
      success: true,
      description,
      tags,
      videoStyle,
      title: `${album.title} - ${album.artist} [Full Album]`,
      categoryId: '10', // Music category
      privacyStatus: 'private', // Start as private, user can make public
      video: videoData,
      message: videoData.status === 'rendering' 
        ? `Video is being generated (${videoData.estimatedTime}). Check back soon!`
        : 'YouTube upload package prepared. Use YouTube Studio to upload.',
      oauth_url: `https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=${encodeURIComponent(c.req.url.origin + '/api/youtube/callback')}&response_type=code&scope=https://www.googleapis.com/auth/youtube.upload&access_type=offline`
    })
  } catch (error) {
    return c.json({ error: error.message }, 500)
  }
})

// Audio merge endpoint
app.post('/api/audio/merge', async (c) => {
  const body = await c.req.json()
  const { albumId, songs } = body
  
  try {
    // For a simple solution, we'll use an audio merging service
    // Options: 
    // 1. Use FFmpeg via external service
    // 2. Use Audio API services like AudioStack or Dolby.io
    // 3. For now, we'll create a simple concatenated playlist URL
    
    // Check if we already have a merged file for this album
    const existingMerge = await c.env.DB.prepare(
      'SELECT * FROM audio_merges WHERE album_id = ? ORDER BY created_at DESC LIMIT 1'
    ).bind(albumId).first()
    
    if (existingMerge && existingMerge.url) {
      return c.json({
        success: true,
        url: existingMerge.url,
        duration: existingMerge.duration,
        cached: true
      })
    }
    
    // For JSON2Video, we can actually provide multiple audio tracks
    // and it will merge them automatically!
    // Create a concatenated audio manifest
    const audioManifest = {
      type: 'concatenated',
      tracks: songs.map((song, index) => ({
        url: song.url,
        name: song.name,
        order: index,
        crossfade: index > 0 ? 2 : 0 // 2 second crossfade between tracks
      }))
    }
    
    // Store the manifest
    const mergeId = crypto.randomUUID()
    const manifestKey = `audio-merges/${albumId}/${mergeId}.json`
    
    await c.env.R2.put(manifestKey, JSON.stringify(audioManifest), {
      httpMetadata: { contentType: 'application/json' }
    })
    
    const manifestUrl = `/files/${manifestKey}`
    
    // Calculate total duration (estimate)
    const estimatedDuration = songs.length * 180 // 3 minutes per song average
    
    // Store merge record
    await c.env.DB.prepare(`
      INSERT INTO audio_merges (id, album_id, url, duration, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      mergeId,
      albumId,
      manifestUrl,
      estimatedDuration,
      JSON.stringify({ manifest: audioManifest, song_count: songs.length }),
      new Date().toISOString()
    ).run()
    
    // For actual audio merging, we'll use the first track as a placeholder
    // JSON2Video doesn't support manifest URLs yet
    // In production, you'd use an audio processing service here
    const mergedUrl = songs[0]?.url || ''
    
    return c.json({
      success: true,
      url: mergedUrl, // For now, just use first track
      duration: estimatedDuration,
      manifest: manifestUrl,
      message: 'Using first track as placeholder. Full merging coming soon.'
    })
  } catch (error) {
    console.error('Audio merge error:', error)
    return c.json({ error: error.message }, 500)
  }
})

// Video generation endpoint using JSON2Video
app.post('/api/video/generate-static', async (c) => {
  const body = await c.req.json()
  const { albumId, album, songs, videoStyle, videoLoopId } = body
  
  try {
    // Get full URLs for all audio files
    const origin = c.req.header('origin') || `https://${c.req.header('host')}`
    
    // Prepare song URLs with full paths
    const songsWithFullUrls = songs.map(s => ({
      ...s,
      url: s.url.startsWith('http') ? s.url : `${origin}${s.url}`
    }))
    
    // Prepare background based on style
    let background;
    
    if (videoStyle === 'animated' && videoLoopId) {
      // Use a looping video as background
      const video = await c.env.DB.prepare(
        'SELECT * FROM videos WHERE id = ?'
      ).bind(videoLoopId).first()
      
      if (video) {
        background = {
          type: 'video',
          url: video.url.startsWith('http') ? video.url : `${origin}${video.url}`,
          loop: true
        }
      } else {
        // Fallback to album cover if video not found
        background = {
          type: 'image',
          url: album.cover_art_id 
            ? `${origin}/files/artwork/${album.cover_art_id}.png`
            : `${origin}/placeholder-album-art.png`,
          zoom: 'ken-burns'
        }
      }
    } else {
      // Static mode: use album cover
      background = {
        type: 'image',
        url: album.cover_art_id 
          ? `${origin}/files/artwork/${album.cover_art_id}.png`
          : `${origin}/placeholder-album-art.png`,
        zoom: 'ken-burns'
      }
    }
    
    // Calculate total duration (3 minutes per song)
    const totalDuration = songs.length * 180
    
    // Create video with JSON2Video using multiple audio tracks
    const json2videoResponse = await fetch('https://api.json2video.com/v2/movies', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.JSON2VIDEO_KEY || 'your-api-key'}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        template: 'basic',
        width: 1920,
        height: 1080,
        duration: totalDuration,
        scenes: [
          {
            comment: 'Lofi album cover with title',
            duration: totalDuration,
            background: background,
            elements: [
              {
                type: 'text',
                text: album.title,
                x: '50%',
                y: '15%',
                fontSize: 72,
                fontFamily: 'Montserrat',
                fontWeight: 'bold',
                color: '#ffffff',
                shadow: {
                  color: '#000000',
                  opacity: 0.8,
                  blur: 10
                }
              },
              {
                type: 'text',
                text: `by ${album.artist}`,
                x: '50%',
                y: '25%',
                fontSize: 36,
                fontFamily: 'Montserrat',
                color: '#ffffff',
                shadow: {
                  color: '#000000',
                  opacity: 0.8,
                  blur: 10
                }
              },
              // Add track titles with timestamps
              ...songs.map((song, index) => {
                const startTime = index * 180; // 3 minutes per song
                const minutes = Math.floor(startTime / 60);
                const seconds = startTime % 60;
                const timestamp = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                
                return {
                  type: 'text',
                  text: `${timestamp} - ${song.name}`,
                  x: '10%',
                  y: `${40 + (index * 4)}%`,
                  fontSize: 18,
                  fontFamily: 'Montserrat',
                  color: '#ffffff',
                  opacity: 0.7,
                  start: 0,
                  duration: totalDuration
                };
              }).slice(0, 10), // Limit to 10 tracks on screen
              {
                type: 'waveform',
                audio: songsWithFullUrls[0].url, // Waveform from first track
                x: '50%',
                y: '85%',
                width: '80%',
                height: '15%',
                color: '#ffffff',
                opacity: 0.8
              }
            ],
            // Stack all audio tracks - JSON2Video will play them sequentially!
            audio: songsWithFullUrls.map((song, index) => ({
              url: song.url,
              start: index * 180, // Each song starts 3 minutes after the previous
              fadeIn: index > 0 ? 1 : 2, // Fade in between tracks
              fadeOut: index < songs.length - 1 ? 1 : 3, // Fade out between tracks
              volume: 1.0
            }))
          }
        ],
        settings: {
          quality: 'high',
          format: 'mp4'
        }
      })
    })
    
    if (!json2videoResponse.ok) {
      const error = await json2videoResponse.text()
      throw new Error(`JSON2Video API error: ${error}`)
    }
    
    const videoData = await json2videoResponse.json()
    
    // Store video reference in database
    const videoId = crypto.randomUUID()
    await c.env.DB.prepare(`
      INSERT INTO videos (id, url, artwork_id, metadata, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      videoId,
      videoData.url || videoData.video_url,
      album.id,
      JSON.stringify({ 
        type: 'youtube-compilation',
        duration: totalDuration,
        json2video_id: videoData.id,
        render_status: videoData.status || 'rendering'
      }),
      new Date().toISOString()
    ).run()
    
    return c.json({ 
      success: true,
      videoId,
      videoUrl: videoData.url,
      renderingId: videoData.id,
      status: videoData.status || 'rendering',
      estimatedTime: videoData.estimated_time || '2-3 minutes'
    })
  } catch (error) {
    console.error('Video generation error:', error)
    return c.json({ error: error.message }, 500)
  }
})

// YouTube resumable upload
app.post('/api/youtube/upload', async (c) => {
  const body = await c.req.json()
  const { albumId, videoKey, metadata } = body
  
  try {
    // Get stored auth token
    const auth = await c.env.DB.prepare(
      'SELECT * FROM youtube_auth WHERE id = "default"'
    ).first()
    
    if (!auth || new Date(auth.expires_at) < new Date()) {
      return c.json({ error: 'YouTube authentication required' }, 401)
    }
    
    // Step 1: Create video resource
    const createResponse = await fetch('https://www.googleapis.com/youtube/v3/videos?part=snippet,status', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${auth.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        snippet: {
          title: metadata.title,
          description: metadata.description,
          tags: metadata.tags,
          categoryId: '10'
        },
        status: {
          privacyStatus: 'private',
          selfDeclaredMadeForKids: false
        }
      })
    })
    
    const videoResource = await createResponse.json()
    
    // Step 2: Get resumable upload URL
    const uploadUrl = createResponse.headers.get('Location') || 
      `https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&upload_id=${videoResource.id}`
    
    // Step 3: Return upload URL for client-side resumable upload
    return c.json({
      success: true,
      uploadUrl,
      videoId: videoResource.id,
      videoUrl: `https://youtube.com/watch?v=${videoResource.id}`
    })
  } catch (error) {
    return c.json({ error: error.message }, 500)
  }
})

// Serve React app
app.get('/', async (c) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lofi Studio</title>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f0f0f;
      color: #e0e0e0;
      min-height: 100vh;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }
    
    .header {
      margin-bottom: 3rem;
    }
    
    .header h1 {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    
    .header p {
      color: #888;
      font-size: 1.1rem;
    }
    
    .main-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
      margin-bottom: 3rem;
    }
    
    @media (max-width: 768px) {
      .main-grid {
        grid-template-columns: 1fr;
      }
    }
    
    .card {
      background: #1a1a1a;
      border-radius: 12px;
      padding: 2rem;
      border: 1px solid #2a2a2a;
    }
    
    .card h2 {
      font-size: 1.5rem;
      margin-bottom: 1.5rem;
      color: #fff;
    }
    
    .form-group {
      margin-bottom: 1.5rem;
    }
    
    .form-group label {
      display: block;
      margin-bottom: 0.5rem;
      font-size: 0.9rem;
      color: #bbb;
    }
    
    .form-group input,
    .form-group textarea {
      width: 100%;
      padding: 0.75rem;
      background: #2a2a2a;
      border: 1px solid #3a3a3a;
      border-radius: 8px;
      color: #e0e0e0;
      font-size: 1rem;
      transition: all 0.2s;
    }
    
    .form-group input:focus,
    .form-group textarea:focus {
      outline: none;
      border-color: #667eea;
      background: #2f2f2f;
    }
    
    .form-group textarea {
      resize: vertical;
      min-height: 80px;
    }
    
    .form-group small {
      display: block;
      margin-top: 0.25rem;
      color: #666;
      font-size: 0.85rem;
    }
    
    .checkbox-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
    }
    
    .checkbox-group input[type="checkbox"] {
      width: auto;
      cursor: pointer;
    }
    
    .button {
      display: inline-block;
      padding: 0.75rem 1.5rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s;
    }
    
    .button:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    
    .button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    
    .button-secondary {
      background: #2a2a2a;
      border: 1px solid #3a3a3a;
    }
    
    .button-secondary:hover {
      background: #3a3a3a;
      box-shadow: none;
    }
    
    .music-library {
      margin-top: 3rem;
    }
    
    .library-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
    }
    
    .library-header h2 {
      font-size: 2rem;
      color: #fff;
    }
    
    .track-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.5rem;
    }
    
    .track-card {
      background: #1a1a1a;
      border-radius: 12px;
      padding: 1.5rem;
      border: 1px solid #2a2a2a;
      transition: all 0.3s;
    }
    
    .track-card:hover {
      border-color: #3a3a3a;
      transform: translateY(-2px);
    }
    
    .track-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1rem;
    }
    
    .track-title {
      font-size: 1.1rem;
      font-weight: 500;
      color: #fff;
      margin-bottom: 0.25rem;
    }
    
    .track-status {
      font-size: 0.85rem;
      padding: 0.25rem 0.75rem;
      border-radius: 20px;
      background: #2a2a2a;
      color: #888;
    }
    
    .track-status.generating {
      background: #3a3a2a;
      color: #ffcc00;
    }
    
    .track-status.completed {
      background: #2a3a2a;
      color: #66ff66;
    }
    
    .track-meta {
      font-size: 0.85rem;
      color: #666;
      margin-bottom: 1rem;
    }
    
    .audio-player {
      width: 100%;
      margin-bottom: 1rem;
      border-radius: 8px;
      background: #2a2a2a;
    }
    
    .track-actions {
      display: flex;
      gap: 0.5rem;
    }
    
    .action-button {
      padding: 0.5rem 1rem;
      background: #2a2a2a;
      border: 1px solid #3a3a3a;
      border-radius: 6px;
      color: #e0e0e0;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 0.9rem;
      margin-right: 0.5rem;
    }
    
    .action-button:hover {
      background: #3a3a3a;
    }
    
    .action-button.delete {
      background: #2a1a1a;
      border-color: #3a2a2a;
      color: #ff6666;
    }
    
    .action-button.delete:hover {
      background: #3a2a2a;
      color: #ff8888;
    }
    
    .error-message {
      background: #2a1a1a;
      border: 1px solid #ff6666;
      color: #ff9999;
      padding: 1rem;
      border-radius: 8px;
      margin-bottom: 1rem;
    }
    
    .success-message {
      background: #1a2a1a;
      border: 1px solid #66ff66;
      color: #99ff99;
      padding: 1rem;
      border-radius: 8px;
      margin-bottom: 1rem;
    }
    
    .loading {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 2px solid #3a3a3a;
      border-top-color: #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-left: 0.5rem;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .empty-state {
      text-align: center;
      padding: 3rem;
      color: #666;
    }
    
    .empty-state p {
      font-size: 1.1rem;
      margin-bottom: 1rem;
    }
    
    .tabs {
      display: flex;
      gap: 1rem;
      margin-bottom: 2rem;
      border-bottom: 1px solid #2a2a2a;
    }
    
    .tab {
      padding: 1rem 2rem;
      background: none;
      border: none;
      color: #888;
      font-size: 1.1rem;
      cursor: pointer;
      transition: all 0.3s;
      border-bottom: 2px solid transparent;
    }
    
    .tab:hover {
      color: #e0e0e0;
    }
    
    .tab.active {
      color: #fff;
      border-bottom-color: #667eea;
    }
    
    .tab-content {
      animation: fadeIn 0.3s ease-in;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    
    .modal {
      background: #1a1a1a;
      border-radius: 12px;
      padding: 2rem;
      max-width: 600px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      border: 1px solid #2a2a2a;
    }
    
    .modal h2 {
      font-size: 1.5rem;
      margin-bottom: 1.5rem;
      color: #fff;
    }
    
    .artwork-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    
    .artwork-item {
      cursor: pointer;
      border: 2px solid transparent;
      border-radius: 8px;
      overflow: hidden;
      transition: all 0.2s;
    }
    
    .artwork-item:hover {
      border-color: #667eea;
    }
    
    .artwork-item.selected {
      border-color: #667eea;
    }
    
    .artwork-item img {
      width: 100%;
      height: auto;
      display: block;
    }
    
    .artwork-info {
      padding: 0.75rem;
      background: #1a1a1a;
      border-top: 1px solid #2a2a2a;
    }
    
    .artwork-model {
      font-size: 0.8rem;
      color: #999;
      margin-bottom: 0.25rem;
    }
    
    .artwork-prompt {
      font-size: 0.85rem;
      color: #e0e0e0;
      margin-bottom: 0.5rem;
      line-height: 1.3;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    
    .artwork-date {
      font-size: 0.75rem;
      color: #666;
    }
    
    .modal-actions {
      display: flex;
      gap: 1rem;
      margin-top: 1.5rem;
    }
    
    .track-checkbox {
      margin-right: 0.5rem;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  
  <script type="text/babel">
    const { useState, useEffect, useCallback } = React;
    
    function App() {
      const [songs, setSongs] = useState([]);
      const [prompt, setPrompt] = useState('');
      const [customMode, setCustomMode] = useState(false);
      const [title, setTitle] = useState('');
      const [tags, setTags] = useState('');
      const [makeInstrumental, setMakeInstrumental] = useState(true);
      const [isGenerating, setIsGenerating] = useState(false);
      const [error, setError] = useState('');
      const [success, setSuccess] = useState('');
      const [selectedSongs, setSelectedSongs] = useState(new Set());
      const [playbackErrors, setPlaybackErrors] = useState({});
      
      // Tab state - get from URL hash
      const getTabFromHash = () => {
        const hash = window.location.hash.slice(1);
        return ['music', 'artwork', 'distribute', 'publish'].includes(hash) ? hash : 'music';
      };
      
      const [activeTab, setActiveTab] = useState(getTabFromHash());
      
      // Update tab when hash changes
      useEffect(() => {
        const handleHashChange = () => {
          setActiveTab(getTabFromHash());
        };
        
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
      }, []);
      
      // Custom setActiveTab that also updates URL
      const changeTab = (tab) => {
        window.location.hash = tab;
        setActiveTab(tab);
      };
      
      // Modal states
      const [showArtworkModal, setShowArtworkModal] = useState(false);
      const [showAlbumModal, setShowAlbumModal] = useState(false);
      const [artworkPrompt, setArtworkPrompt] = useState('');
      const [generatedArtwork, setGeneratedArtwork] = useState([]);
      const [selectedArtwork, setSelectedArtwork] = useState(null);
      const [albumTitle, setAlbumTitle] = useState('');
      const [albumArtist, setAlbumArtist] = useState('');
      const [isGeneratingArtwork, setIsGeneratingArtwork] = useState(false);
      const [allArtwork, setAllArtwork] = useState([]);
      const [albums, setAlbums] = useState([]);
      const [musicModel, setMusicModel] = useState('');
      const [artworkModel, setArtworkModel] = useState('flux-schnell');
      const [videoModel, setVideoModel] = useState('kling-1.6');
      const [selectedImageForVideo, setSelectedImageForVideo] = useState(null);
      const [videoPrompt, setVideoPrompt] = useState('');
      const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
      const [enableLoop, setEnableLoop] = useState(true);
      const [videos, setVideos] = useState([]);
      const [videoDuration, setVideoDuration] = useState(5);
      const [videoSeed, setVideoSeed] = useState(-1);
      const [videoCfgScale, setVideoCfgScale] = useState(0.5);
      const [videoMode, setVideoMode] = useState('standard');
      const [tailImageUrl, setTailImageUrl] = useState('');
      const [selectedTailImage, setSelectedTailImage] = useState(null);
      const [mediaFilter, setMediaFilter] = useState('all');
      const [showPublishingOptions] = useState(true); // Always show publishing options
      
      // YouTube publishing state
      const [youtubeApiKey, setYoutubeApiKey] = useState('');
      const [selectedAlbumForYT, setSelectedAlbumForYT] = useState('');
      const [ytVideoStyle, setYtVideoStyle] = useState('static');
      const [isPublishingToYT, setIsPublishingToYT] = useState(false);
      const [selectedVideoLoop, setSelectedVideoLoop] = useState('');
      
      // Track generation status
      const [activeGenerations, setActiveGenerations] = useState(new Map());
      
      const fetchSongs = useCallback(async () => {
        try {
          const response = await fetch('/api/songs');
          const data = await response.json();
          setSongs(data);
          
          // Check for any songs that are still generating
          const generatingSongs = data.filter(song => song.status === 'generating');
          const newActiveGens = new Map();
          
          generatingSongs.forEach(song => {
            const metadata = JSON.parse(song.metadata || '{}');
            if (metadata.workId) {
              newActiveGens.set(metadata.workId, metadata.groupId || song.id);
            }
          });
          
          setActiveGenerations(newActiveGens);
        } catch (error) {
          console.error('Failed to fetch songs:', error);
        }
      }, []);
      
      const fetchArtwork = useCallback(async () => {
        try {
          const response = await fetch('/api/artwork');
          const data = await response.json();
          setAllArtwork(data);
        } catch (error) {
          console.error('Failed to fetch artwork:', error);
        }
      }, []);
      
      const fetchAlbums = useCallback(async () => {
        try {
          const response = await fetch('/api/albums');
          const data = await response.json();
          setAlbums(data);
        } catch (error) {
          console.error('Failed to fetch albums:', error);
        }
      }, []);
      
      useEffect(() => {
        fetchSongs();
        fetchArtwork();
        fetchAlbums();
        fetchVideos();
        const interval = setInterval(fetchSongs, 5000);
        return () => clearInterval(interval);
      }, [fetchSongs, fetchArtwork, fetchAlbums]);
      
      // Check status of active generations
      useEffect(() => {
        const checkStatuses = async () => {
          for (const [workId, groupId] of activeGenerations.entries()) {
            try {
              const response = await fetch(\`/api/generate-music-status?workId=\${workId}\`);
              const data = await response.json();
              
              if (data.status === 'completed') {
                // Remove from active generations
                setActiveGenerations(prev => {
                  const newMap = new Map(prev);
                  newMap.delete(workId);
                  return newMap;
                });
                
                // Refresh songs
                fetchSongs();
              }
            } catch (error) {
              console.error(\`Failed to check status for \${workId}:\`, error);
            }
          }
        };
        
        if (activeGenerations.size > 0) {
          const interval = setInterval(checkStatuses, 3000);
          return () => clearInterval(interval);
        }
      }, [activeGenerations, fetchSongs]);
      
      const generateMusic = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsGenerating(true);
        
        try {
          const response = await fetch('/api/generate-music', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: prompt || 'lofi beat',
              customMode,
              title: customMode ? title : undefined,
              tags: customMode ? tags : undefined,
              make_instrumental: makeInstrumental,
              model: musicModel
            })
          });
          
          const data = await response.json();
          
          if (!response.ok) {
            throw new Error(data.error || 'Failed to generate music');
          }
          
          setSuccess('Music generation started. Two variants will be created.');
          setPrompt('');
          setTitle('');
          setTags('');
          
          // Add to active generations
          if (data.workId) {
            setActiveGenerations(prev => new Map(prev).set(data.workId, data.songIds?.[0]));
          }
          
          // Refresh songs immediately
          fetchSongs();
        } catch (error) {
          setError(error.message);
        } finally {
          setIsGenerating(false);
        }
      };
      
      const refreshStuck = async () => {
        try {
          const response = await fetch('/api/refresh-stuck', { method: 'POST' });
          const data = await response.json();
          
          if (data.updatedCount > 0) {
            setSuccess(\`Updated \${data.updatedCount} stuck songs\`);
          } else {
            setError('No stuck songs were updated');
          }
          
          fetchSongs();
        } catch (error) {
          setError('Failed to refresh stuck songs');
        }
      };
      
      const deleteSong = async (id) => {
        try {
          const response = await fetch(\`/api/songs/\${id}\`, { method: 'DELETE' });
          
          if (response.ok) {
            fetchSongs();
          }
        } catch (error) {
          console.error('Failed to delete song:', error);
        }
      };
      
      const handlePlayError = (songId, error) => {
        setPlaybackErrors(prev => ({
          ...prev,
          [songId]: 'Cannot play audio. The file may still be processing or the URL is invalid.'
        }));
      };
      
      const generateArtwork = async () => {
        if (!artworkPrompt) {
          setError('Please enter an artwork prompt');
          return;
        }
        
        setIsGeneratingArtwork(true);
        setError('');
        
        try {
          const response = await fetch('/api/artwork', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              prompt: artworkPrompt,
              model: artworkModel 
            })
          });
          
          const data = await response.json();
          
          if (!response.ok) {
            throw new Error(data.error || 'Failed to generate artwork');
          }
          
          setGeneratedArtwork(data.artworkIds);
          setSuccess('Artwork generated successfully');
          fetchArtwork(); // Refresh artwork list
        } catch (error) {
          setError(error.message);
        } finally {
          setIsGeneratingArtwork(false);
        }
      };
      
      const createAlbum = async () => {
        if (!albumTitle || selectedSongs.size === 0) {
          setError('Please enter album title and select songs');
          return;
        }
        
        try {
          const response = await fetch('/api/albums', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: albumTitle,
              artist: albumArtist || 'Lofi Studio',
              songIds: Array.from(selectedSongs),
              coverArtId: selectedArtwork
            })
          });
          
          const data = await response.json();
          
          if (!response.ok) {
            throw new Error(data.error || 'Failed to create album');
          }
          
          // Prepare for DistroKid
          const distroResponse = await fetch('/api/prepare-distrokid', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ albumId: data.albumId })
          });
          
          const distroData = await distroResponse.json();
          
          setSuccess('Album created and prepared for distribution');
          setShowAlbumModal(false);
          setSelectedSongs(new Set());
          
          // Show distribution instructions
          alert(JSON.stringify(distroData.instructions.manual_steps, null, 2));
        } catch (error) {
          setError(error.message);
        }
      };
      
      const toggleSongSelection = (songId) => {
        setSelectedSongs(prev => {
          const newSet = new Set(prev);
          if (newSet.has(songId)) {
            newSet.delete(songId);
          } else {
            newSet.add(songId);
          }
          return newSet;
        });
      };
      
      const generateVideo = async () => {
        if (!selectedImageForVideo) {
          setError('Please select an image for video generation');
          return;
        }
        
        setIsGeneratingVideo(true);
        setError('');
        
        try {
          const response = await fetch('/api/video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageId: selectedImageForVideo,
              prompt: videoPrompt,
              model: videoModel,
              enableLoop,
              duration: videoDuration,
              seed: videoSeed,
              cfgScale: videoCfgScale,
              mode: videoMode,
              tailImageId: selectedTailImage
            })
          });
          
          const data = await response.json();
          
          if (!response.ok) {
            throw new Error(data.error || 'Failed to generate video');
          }
          
          setSuccess('Video generated successfully');
          // Fetch videos list
          fetchVideos();
        } catch (error) {
          setError(error.message);
        } finally {
          setIsGeneratingVideo(false);
        }
      };
      
      const fetchVideos = async () => {
        try {
          const response = await fetch('/api/videos');
          const data = await response.json();
          setVideos(data);
        } catch (error) {
          console.error('Failed to fetch videos:', error);
        }
      };
      
      const publishToYouTube = async () => {
        if (!selectedAlbumForYT) {
          setError('Please select an album');
          return;
        }
        
        setIsPublishingToYT(true);
        setError('');
        
        try {
          // Get album details
          const album = albums.find(a => a.id === selectedAlbumForYT);
          if (!album) throw new Error('Album not found');
          
          // Get album songs
          const albumSongs = await fetch(\`/api/albums/\${selectedAlbumForYT}/songs\`);
          const songsData = await albumSongs.json();
          
          // Prepare YouTube upload
          const response = await fetch('/api/youtube/prepare', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              albumId: selectedAlbumForYT,
              videoStyle: ytVideoStyle,
              videoLoopId: selectedVideoLoop,
              album: album,
              songs: songsData
            })
          });
          
          const data = await response.json();
          
          if (!response.ok) {
            throw new Error(data.error || 'Failed to prepare YouTube upload');
          }
          
          // Handle video generation response
          if (data.video && data.video.status === 'rendering') {
            // Video is being generated
            setSuccess(\`Video is being generated! \${data.video.estimatedTime}. Video ID: \${data.video.renderingId}\`);
            
            // Store rendering ID for status checking
            localStorage.setItem(\`video-rendering-\${selectedAlbumForYT}\`, data.video.renderingId);
          } else if (data.video && data.video.videoUrl) {
            // Video is ready
            setSuccess('Video generated successfully! Download link ready.');
            
            // Create download info with video URL
            const uploadInfo = \`YouTube Upload Information
==========================

Title: \${data.title}

Description:
\${data.description}

Tags: \${data.tags.join(', ')}

Category: Music (ID: 10)
Privacy: Private (change after upload if desired)

Generated Video: \${data.video.videoUrl}

Instructions:
1. Download the video from the link above
2. Go to YouTube Studio (studio.youtube.com)
3. Click "Create" → "Upload videos"
4. Select the downloaded video
5. Copy and paste the title, description, and tags
6. Set category to "Music"
7. Upload!\`;
            
            // Create download link for instructions
            const blob = new Blob([uploadInfo], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = \`youtube-upload-\${album.title.replace(/\s+/g, '-')}.txt\`;
            a.click();
            URL.revokeObjectURL(url);
          } else {
            // Manual video creation needed
            const uploadInfo = \`YouTube Upload Information
==========================

Title: \${data.title}

Description:
\${data.description}

Tags: \${data.tags.join(', ')}

Category: Music (ID: 10)
Privacy: Private (change after upload if desired)

Manual Video Creation Required
Video Style: \${ytVideoStyle}

Instructions:
1. Create video using your preferred editor
2. Use album artwork and audio files
3. Export as MP4 (1920x1080)
4. Upload to YouTube Studio with above metadata\`;
            
            const blob = new Blob([uploadInfo], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = \`youtube-upload-\${album.title.replace(/\s+/g, '-')}.txt\`;
            a.click();
            URL.revokeObjectURL(url);
          }
          
          setSuccess('YouTube upload package downloaded! Check your downloads folder.');
        } catch (error) {
          setError(error.message);
        } finally {
          setIsPublishingToYT(false);
        }
      };
      
      // Group songs by their groupId
      const groupedSongs = songs.reduce((groups, song) => {
        const metadata = JSON.parse(song.metadata || '{}');
        const groupId = metadata.groupId || song.id;
        
        if (!groups[groupId]) {
          groups[groupId] = [];
        }
        groups[groupId].push(song);
        return groups;
      }, {});
      
      return (
        <div className="container">
          <header className="header">
            <h1>Lofi Studio</h1>
            <p>Create AI-powered lofi music compilations</p>
          </header>
          
          <div className="tabs">
            <button 
              className={'tab' + (activeTab === 'music' ? ' active' : '')}
              onClick={() => changeTab('music')}
            >
              Music
            </button>
            <button 
              className={'tab' + (activeTab === 'artwork' ? ' active' : '')}
              onClick={() => changeTab('artwork')}
            >
              Artwork
            </button>
            <button 
              className={'tab' + (activeTab === 'distribute' ? ' active' : '')}
              onClick={() => changeTab('distribute')}
            >
              Distribute
            </button>
            <button 
              className={'tab' + (activeTab === 'publish' ? ' active' : '')}
              onClick={() => changeTab('publish')}
            >
              Publish
            </button>
          </div>
          
          <div className="tab-content">
            {activeTab === 'music' && (
              <div>
                <div className="main-grid">
                  <div className="card">
                    <h2>Generate Music</h2>
                    <form onSubmit={generateMusic}>
                {error && <div className="error-message">{error}</div>}
                {success && <div className="success-message">{success}</div>}
                
                      <div className="form-group">
                        <label htmlFor="musicModel">AI Model</label>
                        <select 
                          id="musicModel"
                          value={musicModel}
                          onChange={(e) => setMusicModel(e.target.value)}
                          style={{ 
                            width: '100%',
                            padding: '0.75rem',
                            background: '#2a2a2a',
                            border: '1px solid #3a3a3a',
                            borderRadius: '8px',
                            color: '#e0e0e0'
                          }}
                        >
                          <option value="">Default Model</option>
                          <option value="chirp-v3.5">Chirp v3.5 (Latest)</option>
                          <option value="chirp-v3">Chirp v3</option>
                          <option value="chirp-v2">Chirp v2</option>
                        </select>
                        <small>Different models have different characteristics</small>
                      </div>
                      
                      <div className="checkbox-group">
                        <input
                          type="checkbox"
                          id="customMode"
                          checked={customMode}
                          onChange={(e) => setCustomMode(e.target.checked)}
                        />
                        <label htmlFor="customMode">Custom Mode (Advanced)</label>
                      </div>
                
                {!customMode ? (
                  <div className="form-group">
                    <label htmlFor="prompt">Describe your lofi beat</label>
                    <textarea
                      id="prompt"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="e.g., chill lofi beat with rain sounds and vinyl crackle"
                    />
                    <small>AI will generate a title and appropriate tags</small>
                  </div>
                ) : (
                  <>
                    <div className="form-group">
                      <label htmlFor="title">Title</label>
                      <input
                        type="text"
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g., Midnight Rain"
                      />
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="customPrompt">Custom Prompt</label>
                      <textarea
                        id="customPrompt"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., lofi hip hop beat, chill, mellow, nostalgic"
                      />
                      <small>Describe the style and mood</small>
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="tags">Tags</label>
                      <input
                        type="text"
                        id="tags"
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        placeholder="e.g., chill, study, relaxing"
                      />
                      <small>Comma-separated tags</small>
                    </div>
                  </>
                )}
                
                <div className="checkbox-group">
                  <input
                    type="checkbox"
                    id="instrumental"
                    checked={makeInstrumental}
                    onChange={(e) => setMakeInstrumental(e.target.checked)}
                  />
                  <label htmlFor="instrumental">Instrumental only</label>
                </div>
                
                <button type="submit" className="button" disabled={isGenerating}>
                  {isGenerating ? (
                    <>Generating<span className="loading"></span></>
                  ) : (
                    'Generate Music'
                  )}
                </button>
              </form>
            </div>
            
            <div className="card">
              <h2>Quick Actions</h2>
              <p style={{ marginBottom: '1.5rem', color: '#888' }}>
                Create artwork, albums, and prepare for distribution
              </p>
              
              <p style={{ fontSize: '0.9rem', color: '#666' }}>
                Generate music first, then create albums and artwork
              </p>
            </div>
                  </div>
                  
                  <section className="music-library">
                    <div className="library-header">
                      <h2>Music Library</h2>
                    </div>
                    
                    {/* Filter Bar */}
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '1rem', 
                      marginBottom: '1.5rem',
                      padding: '1rem',
                      background: '#1a1a1a',
                      borderRadius: '8px',
                      border: '1px solid #2a2a2a'
                    }}>
                      <div style={{ flex: 1 }}>
                        <strong>Filter:</strong>
                        <span style={{ marginLeft: '1rem', color: '#888' }}>
                          {songs.filter(s => s.status === 'generating').length} generating, 
                          {' '}{songs.filter(s => s.status === 'completed').length} completed,
                          {' '}{songs.length} total
                        </span>
                      </div>
                      <button 
                        className="button button-secondary"
                        onClick={refreshStuck}
                        style={{ padding: '0.5rem 1rem' }}
                      >
                        Refresh Stuck Songs
                      </button>
                    </div>
                    
                    {songs.length === 0 ? (
                      <div className="empty-state">
                        <p>No tracks yet. Generate your first lofi beat!</p>
                      </div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                            <th style={{ padding: '1rem', textAlign: 'left' }}>Select</th>
                            <th style={{ padding: '1rem', textAlign: 'left' }}>Title</th>
                            <th style={{ padding: '1rem', textAlign: 'left' }}>Status</th>
                            <th style={{ padding: '1rem', textAlign: 'left' }}>Created</th>
                            <th style={{ padding: '1rem', textAlign: 'left' }}>Player</th>
                            <th style={{ padding: '1rem', textAlign: 'left' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {songs.map((song) => {
                            const metadata = JSON.parse(song.metadata || '{}');
                            return (
                              <tr key={song.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                                <td style={{ padding: '1rem' }}>
                                  {song.status === 'completed' && (
                                    <input
                                      type="checkbox"
                                      checked={selectedSongs.has(song.id)}
                                      onChange={() => toggleSongSelection(song.id)}
                                    />
                                  )}
                                </td>
                                <td style={{ padding: '1rem' }}>{song.name}</td>
                                <td style={{ padding: '1rem' }}>
                                  <span className={'track-status ' + song.status}>
                                    {song.status}
                                  </span>
                                </td>
                                <td style={{ padding: '1rem' }}>
                                  {new Date(song.created_at).toLocaleString()}
                                </td>
                                <td style={{ padding: '1rem' }}>
                                  {song.status === 'completed' && song.url && (
                                    <>
                                      {playbackErrors[song.id] && (
                                        <div style={{ 
                                          fontSize: '0.85rem', 
                                          color: '#ff6666'
                                        }}>
                                          {playbackErrors[song.id]}
                                        </div>
                                      )}
                                      <audio 
                                        controls 
                                        style={{ width: '200px' }}
                                        onError={(e) => handlePlayError(song.id, e)}
                                        onCanPlay={() => {
                                          setPlaybackErrors(prev => {
                                            const newErrors = {...prev};
                                            delete newErrors[song.id];
                                            return newErrors;
                                          });
                                        }}
                                      >
                                        <source src={song.url} type="audio/mpeg" />
                                      </audio>
                                    </>
                                  )}
                                </td>
                                <td style={{ padding: '1rem' }}>
                                  {song.status === 'completed' && song.url && (
                                    <button 
                                      className="action-button"
                                      onClick={() => window.open(song.url, '_blank')}
                                    >
                                      Download
                                    </button>
                                  )}
                                  <button 
                                    className="action-button delete"
                                    onClick={() => deleteSong(song.id)}
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </section>
                </div>
              )}
              
              {activeTab === 'artwork' && (
                <div>
                  <div className="main-grid">
                    <div className="card">
                      <h2>Generate Image</h2>
                      {error && <div className="error-message">{error}</div>}
                      {success && <div className="success-message">{success}</div>}
                      
                      <div className="form-group">
                        <label htmlFor="artworkModel">AI Model</label>
                        <select 
                          id="artworkModel"
                          value={artworkModel}
                          onChange={(e) => setArtworkModel(e.target.value)}
                          style={{ 
                            width: '100%',
                            padding: '0.75rem',
                            background: '#2a2a2a',
                            border: '1px solid #3a3a3a',
                            borderRadius: '8px',
                            color: '#e0e0e0'
                          }}
                        >
                          <option value="flux-schnell">FLUX Schnell (Fast)</option>
                          <option value="flux-dev">FLUX Dev (Quality)</option>
                          <option value="flux-pro">FLUX Pro (Best)</option>
                          <option value="stable-diffusion-xl">Stable Diffusion XL</option>
                        </select>
                      </div>
                      
                      <div className="form-group">
                        <label>Describe your album artwork</label>
                        <textarea
                          value={artworkPrompt}
                          onChange={(e) => setArtworkPrompt(e.target.value)}
                          placeholder="e.g., cozy bedroom with rain on window, lofi aesthetic, anime style"
                        />
                      </div>
                      
                      <button 
                        className="button"
                        onClick={generateArtwork}
                        disabled={isGeneratingArtwork}
                      >
                        {isGeneratingArtwork ? 'Generating...' : 'Generate Image'}
                      </button>
                    </div>
                    
                    <div className="card">
                      <h2>Generate Video from Image</h2>
                      {error && <div className="error-message">{error}</div>}
                      
                      <div className="form-group">
                        <label htmlFor="videoModel">Video Model</label>
                        <select 
                          id="videoModel"
                          value={videoModel}
                          onChange={(e) => setVideoModel(e.target.value)}
                          style={{ 
                            width: '100%',
                            padding: '0.75rem',
                            background: '#2a2a2a',
                            border: '1px solid #3a3a3a',
                            borderRadius: '8px',
                            color: '#e0e0e0'
                          }}
                        >
                          <option value="kling-1.6">Kling 1.6 Pro (Best quality, supports loop)</option>
                          <option value="kling-1.5">Kling 1.5</option>
                          <option value="stable-video">Stable Video Diffusion</option>
                          <option value="animatediff-sparsectrl">AnimateDiff SparseCtrl</option>
                          <option value="animatediff-lightning">AnimateDiff Lightning</option>
                        </select>
                      </div>
                      
                      <div className="form-group">
                        <label>Motion Prompt (optional)</label>
                        <textarea
                          value={videoPrompt}
                          onChange={(e) => setVideoPrompt(e.target.value)}
                          placeholder="e.g., gentle zoom in with floating particles, smooth camera movement"
                        />
                        <small>Describe the motion you want in the video</small>
                      </div>
                      
                      <div className="form-group">
                        <label>Duration (seconds)</label>
                        <select 
                          value={videoDuration}
                          onChange={(e) => setVideoDuration(Number(e.target.value))}
                          style={{ 
                            width: '100%',
                            padding: '0.75rem',
                            background: '#2a2a2a',
                            border: '1px solid #3a3a3a',
                            borderRadius: '8px',
                            color: '#e0e0e0'
                          }}
                        >
                          <option value={5}>5 seconds</option>
                          {(videoModel === 'kling-1.6' || videoModel === 'kling-1.5') && (
                            <option value={10}>10 seconds</option>
                          )}
                        </select>
                        <small>Kling models support 5 or 10 second videos</small>
                      </div>
                      
                      {(videoModel === 'kling-1.6' || videoModel === 'kling-1.5') && (
                        <>
                          <div className="form-group">
                            <label>Mode</label>
                            <select 
                              value={videoMode}
                              onChange={(e) => setVideoMode(e.target.value)}
                              style={{ 
                                width: '100%',
                                padding: '0.75rem',
                                background: '#2a2a2a',
                                border: '1px solid #3a3a3a',
                                borderRadius: '8px',
                                color: '#e0e0e0'
                              }}
                            >
                              <option value="standard">Standard</option>
                              <option value="pro">Pro (Higher quality)</option>
                            </select>
                          </div>
                          
                          <div className="form-group">
                            <label>CFG Scale</label>
                            <input
                              type="number"
                              value={videoCfgScale}
                              onChange={(e) => setVideoCfgScale(parseFloat(e.target.value))}
                              min="0"
                              max="1"
                              step="0.1"
                              style={{ 
                                width: '100%',
                                padding: '0.75rem',
                                background: '#2a2a2a',
                                border: '1px solid #3a3a3a',
                                borderRadius: '8px',
                                color: '#e0e0e0'
                              }}
                            />
                            <small>Controls adherence to prompt (0-1, default 0.5)</small>
                          </div>
                          
                          <div className="form-group">
                            <label>Seed (optional)</label>
                            <input
                              type="number"
                              value={videoSeed}
                              onChange={(e) => setVideoSeed(parseInt(e.target.value))}
                              placeholder="-1 for random"
                              style={{ 
                                width: '100%',
                                padding: '0.75rem',
                                background: '#2a2a2a',
                                border: '1px solid #3a3a3a',
                                borderRadius: '8px',
                                color: '#e0e0e0'
                              }}
                            />
                            <small>Use -1 for random seed</small>
                          </div>
                          
                          {videoModel === 'kling-1.6' && (
                            <div className="form-group">
                              <label>Tail Image for Seamless Loop (optional)</label>
                              {selectedTailImage ? (
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                  <div className="artwork-item" style={{ width: '100px' }}>
                                    <img src={allArtwork.find(a => a.id === selectedTailImage)?.url} alt="Tail image" />
                                  </div>
                                  <button 
                                    type="button"
                                    className="button button-secondary"
                                    onClick={() => setSelectedTailImage(null)}
                                  >
                                    Remove
                                  </button>
                                </div>
                              ) : (
                                <div>
                                  <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>
                                    Select a tail image from your artwork to create a perfect loop
                                  </p>
                                  <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto' }}>
                                    {allArtwork.slice(0, 5).map((art) => (
                                      <div 
                                        key={art.id}
                                        className="artwork-item"
                                        onClick={() => setSelectedTailImage(art.id)}
                                        style={{ width: '80px', cursor: 'pointer', flexShrink: 0 }}
                                      >
                                        <img src={art.url} alt="Tail option" />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                      
                      <div className="form-group">
                        <label>Select Image</label>
                        {selectedImageForVideo ? (
                          <div className="artwork-item" style={{ width: '150px' }}>
                            <img src={allArtwork.find(a => a.id === selectedImageForVideo)?.url} alt="Selected" />
                          </div>
                        ) : (
                          <p>Select an image from below</p>
                        )}
                      </div>
                      
                      <button 
                        className="button"
                        onClick={generateVideo}
                        disabled={isGeneratingVideo || !selectedImageForVideo}
                      >
                        {isGeneratingVideo ? 'Generating Video...' : 'Generate Video'}
                      </button>
                    </div>
                  </div>
                  
                  <section className="music-library">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                      <h2>Media Library</h2>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          className={'button' + (mediaFilter === 'all' ? '' : ' button-secondary')}
                          onClick={() => setMediaFilter('all')}
                          style={{ padding: '0.5rem 1rem' }}
                        >
                          All
                        </button>
                        <button 
                          className={'button' + (mediaFilter === 'images' ? '' : ' button-secondary')}
                          onClick={() => setMediaFilter('images')}
                          style={{ padding: '0.5rem 1rem' }}
                        >
                          Images
                        </button>
                        <button 
                          className={'button' + (mediaFilter === 'videos' ? '' : ' button-secondary')}
                          onClick={() => setMediaFilter('videos')}
                          style={{ padding: '0.5rem 1rem' }}
                        >
                          Videos
                        </button>
                      </div>
                    </div>
                    
                    {mediaFilter !== 'videos' && allArtwork.length === 0 && (
                      <div className="empty-state">
                        <p>No artwork yet. Generate your first album cover!</p>
                      </div>
                    )}
                    
                    {mediaFilter !== 'videos' && allArtwork.length > 0 && (
                      <>
                        <h3 style={{ marginBottom: '1rem', color: '#bbb' }}>Images</h3>
                        <div className="artwork-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', marginBottom: '2rem' }}>
                          {allArtwork.map((art) => (
                          <div 
                            key={art.id} 
                            className={'artwork-item' + (selectedImageForVideo === art.id ? ' selected' : '')}
                            onClick={() => setSelectedImageForVideo(art.id)}
                            style={{ cursor: 'pointer' }}
                          >
                            <img src={art.url} alt="Artwork" />
                            <div className="artwork-info">
                              <div style={{ marginBottom: '0.5rem' }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Artwork</div>
                                <div className="artwork-model">
                                  {(() => {
                                    const metadata = JSON.parse(art.metadata || '{}');
                                    const modelMap = {
                                      'flux-schnell': 'FLUX Schnell',
                                      'flux-dev': 'FLUX Dev',
                                      'flux-pro': 'FLUX Pro',
                                      'stable-diffusion-xl': 'Stable Diffusion XL'
                                    };
                                    return modelMap[metadata.model] || metadata.model || 'Unknown model';
                                  })()}
                                </div>
                              </div>
                              <div className="artwork-prompt" title={art.prompt}>
                                {art.prompt ? (art.prompt.length > 50 ? art.prompt.substring(0, 50) + '...' : art.prompt) : 'No prompt'}
                              </div>
                              <div className="artwork-date">
                                {new Date(art.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        ))}
                        </div>
                      </>
                    )}
                    
                    {mediaFilter !== 'images' && videos.length > 0 && (
                      <>
                        <h3 style={{ marginBottom: '1rem', color: '#bbb' }}>Videos</h3>
                        <div className="track-grid">
                          {videos.map((video) => (
                          <div key={video.id} className="track-card">
                            <video 
                              controls 
                              loop={JSON.parse(video.metadata || '{}').enableLoop}
                              style={{ width: '100%', borderRadius: '8px' }}
                            >
                              <source src={video.url} type="video/mp4" />
                            </video>
                            <div style={{ padding: '1rem' }}>
                              <p style={{ fontSize: '0.9rem', color: '#666' }}>
                                {new Date(video.created_at).toLocaleDateString()}
                              </p>
                              <button 
                                className="action-button"
                                onClick={() => window.open(video.url, '_blank')}
                              >
                                Download
                              </button>
                            </div>
                          </div>
                          ))}
                        </div>
                      </>
                    )}
                  </section>
                </div>
              )}
              
              {activeTab === 'distribute' && (
                <div>
                  <div className="main-grid">
                    <div className="card">
                      <h2>Create Album for DistroKid</h2>
                      <div className="form-group">
                        <label>Album Title</label>
                        <input
                          type="text"
                          value={albumTitle}
                          onChange={(e) => setAlbumTitle(e.target.value)}
                          placeholder="e.g., Midnight Vibes Vol. 1"
                        />
                      </div>
                      
                      <div className="form-group">
                        <label>Artist Name</label>
                        <input
                          type="text"
                          value={albumArtist}
                          onChange={(e) => setAlbumArtist(e.target.value)}
                          placeholder="e.g., Lofi Studio"
                        />
                      </div>
                      
                      <div className="form-group">
                        <label>Selected Tracks</label>
                        <p>{selectedSongs.size} tracks selected</p>
                        {selectedSongs.size > 0 ? (
                          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#888' }}>
                            {songs.filter(s => selectedSongs.has(s.id)).map(s => s.name).join(', ')}
                          </div>
                        ) : (
                          <small>Go to Music tab to select tracks</small>
                        )}
                      </div>
                      
                      <div className="form-group">
                        <label>Album Artwork</label>
                        {selectedArtwork ? (
                          <div className="artwork-item" style={{ width: '150px' }}>
                            <img src={allArtwork.find(a => a.id === selectedArtwork)?.url} alt="Selected artwork" />
                          </div>
                        ) : (
                          <p>Select artwork below</p>
                        )}
                      </div>
                      
                      <button 
                        className="button"
                        onClick={createAlbum}
                        disabled={!albumTitle || selectedSongs.size === 0}
                      >
                        Create Album & Prepare for DistroKid
                      </button>
                      
                      <div style={{ marginTop: '1rem' }}>
                        <button 
                          className="button"
                          disabled
                          style={{ opacity: 0.6 }}
                        >
                          Auto-Publish to DistroKid (Requires Desktop App)
                        </button>
                        <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>
                          Download Musikai desktop app for automated publishing
                        </p>
                      </div>
                    </div>
                    
                    <div className="card">
                      <h2>Select Artwork</h2>
                      <div className="artwork-grid">
                        {allArtwork.slice(0, 4).map((art) => (
                          <div 
                            key={art.id}
                            className={'artwork-item' + (selectedArtwork === art.id ? ' selected' : '')}
                            onClick={() => setSelectedArtwork(art.id)}
                            style={{ cursor: 'pointer' }}
                          >
                            <img src={art.url} alt="Artwork option" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <section className="music-library">
                    <h2>Published Albums</h2>
                    {albums.length === 0 ? (
                      <div className="empty-state">
                        <p>No albums published yet</p>
                      </div>
                    ) : (
                      <div className="track-grid">
                        {albums.map((album) => (
                          <div key={album.id} className="track-card">
                            <h3>{album.title}</h3>
                            <p>by {album.artist}</p>
                            <p>{album.status}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              )}
              
              {activeTab === 'publish' && (
                <div>
                  <div className="main-grid">
                    <div className="card">
                      <h2>Publish to YouTube</h2>
                      <p style={{ marginBottom: '1.5rem', color: '#888' }}>
                        Upload your albums and tracks to YouTube Music and YouTube
                      </p>
                      
                      <div className="form-group">
                        <label>Select Album</label>
                        <select 
                          value={selectedAlbumForYT}
                          onChange={(e) => setSelectedAlbumForYT(e.target.value)}
                          style={{ 
                            width: '100%',
                            padding: '0.75rem',
                            background: '#2a2a2a',
                            border: '1px solid #3a3a3a',
                            borderRadius: '8px',
                            color: '#e0e0e0'
                          }}
                        >
                          <option value="">Select an album to publish</option>
                          {albums.filter(a => a.status === 'ready_for_distribution' || a.status === 'published').map(album => (
                            <option key={album.id} value={album.id}>{album.title} by {album.artist}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="form-group">
                        <label>Video Style</label>
                        <select 
                          value={ytVideoStyle}
                          onChange={(e) => setYtVideoStyle(e.target.value)}
                          style={{ 
                            width: '100%',
                            padding: '0.75rem',
                            background: '#2a2a2a',
                            border: '1px solid #3a3a3a',
                            borderRadius: '8px',
                            color: '#e0e0e0'
                          }}
                        >
                          <option value="static">Static Image with Audio Visualizer</option>
                          <option value="animated">Animated Loop Video</option>
                        </select>
                      </div>
                      
                      {ytVideoStyle === 'animated' && (
                        <div className="form-group">
                          <label>Select Loop Video</label>
                          <select 
                            value={selectedVideoLoop}
                            onChange={(e) => setSelectedVideoLoop(e.target.value)}
                            style={{ 
                              width: '100%',
                              padding: '0.75rem',
                              background: '#2a2a2a',
                              border: '1px solid #3a3a3a',
                              borderRadius: '8px',
                              color: '#e0e0e0'
                            }}
                          >
                            <option value="">Select a video to loop</option>
                            {videos.map(video => (
                              <option key={video.id} value={video.id}>
                                Video generated on {new Date(video.created_at).toLocaleDateString()}
                              </option>
                            ))}
                          </select>
                          <small>This video will loop for the entire duration of the album</small>
                        </div>
                      )}
                      
                      <div className="form-group">
                        <label>Publishing Method</label>
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '1rem',
                          marginTop: '1rem' 
                        }}>
                          <button 
                            className="button"
                            onClick={() => publishToYouTube()}
                            disabled={!selectedAlbumForYT || isPublishingToYT}
                          >
                            {isPublishingToYT ? 'Preparing...' : 'Generate Upload Package'}
                          </button>
                          
                          <button 
                            className="button button-secondary"
                            onClick={() => window.open('https://studio.youtube.com', '_blank')}
                          >
                            Open YouTube Studio
                          </button>
                        </div>
                        
                        <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '1rem' }}>
                          YouTube requires OAuth2 authentication for automated uploads. 
                          Click "Generate Upload Package" to prepare your video metadata, 
                          then upload manually via YouTube Studio.
                        </p>
                      </div>
                    </div>
                    
                    <div className="card">
                      <h2>Publish to TikTok</h2>
                      <p style={{ marginBottom: '1.5rem', color: '#888' }}>
                        Create short clips and publish to TikTok
                      </p>
                      
                      <div className="form-group">
                        <label>Select Track</label>
                        <select 
                          style={{ 
                            width: '100%',
                            padding: '0.75rem',
                            background: '#2a2a2a',
                            border: '1px solid #3a3a3a',
                            borderRadius: '8px',
                            color: '#e0e0e0'
                          }}
                        >
                          <option value="">Select a track</option>
                          {songs.filter(s => s.status === 'completed').map(song => (
                            <option key={song.id} value={song.id}>{song.name}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="form-group">
                        <label>Clip Duration</label>
                        <select 
                          style={{ 
                            width: '100%',
                            padding: '0.75rem',
                            background: '#2a2a2a',
                            border: '1px solid #3a3a3a',
                            borderRadius: '8px',
                            color: '#e0e0e0'
                          }}
                        >
                          <option value="15">15 seconds</option>
                          <option value="30">30 seconds</option>
                          <option value="60">60 seconds</option>
                        </select>
                      </div>
                      
                      <button className="button" disabled>
                        Connect TikTok Account (Coming Soon)
                      </button>
                      
                      <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '1rem' }}>
                        TikTok API integration will be available soon
                      </p>
                    </div>
                  </div>
                  
                  <section className="music-library">
                    <h2>Publishing History</h2>
                    <div className="empty-state">
                      <p>No content published yet. Connect your accounts to start publishing.</p>
                    </div>
                  </section>
                </div>
              )}
            </div>
          
        </div>
      );
    }
    
    ReactDOM.render(<App />, document.getElementById('root'));
  </script>
</body>
</html>`
  
  return c.html(html)
})

export default app