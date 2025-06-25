import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getAssetFromKV } from '@cloudflare/kv-asset-handler'

// @ts-ignore
import manifestJSON from '__STATIC_CONTENT_MANIFEST'

type Env = {
  DB: D1Database
  R2: R2Bucket
  AI: any
  GOAPI_KEY: string
  UDIOAPI_KEY: string
  FAL_KEY: string
  JSON2VIDEO_KEY: string
  __STATIC_CONTENT: KVNamespace
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
  const { 
    prompt, 
    style = 'lofi anime aesthetic, album cover art', 
    numImages = 4, 
    model = 'flux-kontext',
    mode = 'text-to-image',
    imageId
  } = body
  
  // Map model names to Fal.ai endpoints
  const modelEndpoints = {
    'flux-kontext': 'https://fal.run/fal-ai/flux-kontext',
    'flux-schnell': 'https://fal.run/fal-ai/flux/schnell',
    'flux-dev': 'https://fal.run/fal-ai/flux/dev',
    'flux-pro': 'https://fal.run/fal-ai/flux-pro',
    'flux-pro-ultra': 'https://fal.run/fal-ai/flux-pro-ultra',
    'stable-diffusion-xl': 'https://fal.run/fal-ai/stable-diffusion-xl'
  }
  
  const endpoint = modelEndpoints[model] || modelEndpoints['flux-kontext']
  
  try {
    let requestBody: any = {
      prompt: style ? `${prompt}, ${style}, high quality, detailed` : `${prompt}, high quality, detailed`,
      image_size: 'square_hd',
      num_images: numImages,
      enable_safety_checker: true
    }
    
    // Handle image-to-image mode
    if (mode === 'image-to-image' && imageId) {
      const sourceArtwork = await c.env.DB.prepare(
        'SELECT * FROM artwork WHERE id = ?'
      ).bind(imageId).first()
      
      if (!sourceArtwork) {
        return c.json({ error: 'Source image not found' }, 404)
      }
      
      // Get full URL for the source image
      const origin = c.req.header('origin') || `https://${c.req.header('host')}`
      const fullImageUrl = sourceArtwork.url.startsWith('http') 
        ? sourceArtwork.url 
        : `${origin}${sourceArtwork.url}`
      
      // For image-to-image, add the image URL
      requestBody.image_url = fullImageUrl
      
      // Flux Kontext specific parameters for image-to-image
      if (model === 'flux-kontext') {
        requestBody.strength = 0.85 // How much to transform the image
      }
    }
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${c.env.FAL_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Fal.ai error: ${response.statusText}. ${errorText}`)
    }
    
    let data = await response.json()
    
    // Handle queue response - if we get a request_id, we need to poll for the result
    if (data.request_id && data.status_url) {
      console.log('Got queue response for artwork, polling for result...')
      
      // Poll for the result
      let result = data
      let attempts = 0
      const maxAttempts = 60 // 5 minutes with 5 second intervals
      
      while (result.status !== 'completed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds
        
        const statusResponse = await fetch(data.status_url, {
          headers: {
            'Authorization': `Key ${c.env.FAL_KEY}`
          }
        })
        
        if (!statusResponse.ok) {
          throw new Error(`Status check failed: ${statusResponse.statusText}`)
        }
        
        result = await statusResponse.json()
        console.log(`Artwork polling attempt ${attempts + 1}: ${result.status}`)
        
        if (result.status === 'failed') {
          throw new Error(`Artwork generation failed: ${result.error || 'Unknown error'}`)
        }
        
        attempts++
      }
      
      if (result.status !== 'completed') {
        throw new Error('Artwork generation timed out')
      }
      
      // Use the completed result
      data = result
    }
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
        JSON.stringify({ style, model, mode, sourceImageId: imageId, fal_url: image.url }),
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
    model = 'kling-2.1', 
    enableLoop = false, 
    duration = 5,
    seed = -1,
    cfgScale = 0.5,
    mode = 'standard',
    tailImageId = null,
    async = true // Allow sync generation for testing
  } = body
  
  console.log('Video generation request:', { imageId, model, duration, mode, async })
  
  try {
    // Get image URL
    const artwork = await c.env.DB.prepare(
      'SELECT * FROM artwork WHERE id = ?'
    ).bind(imageId).first()
    
    if (!artwork) {
      return c.json({ error: 'Artwork not found' }, 404)
    }
    
    // Create video placeholder immediately with 'generating' status
    const videoId = crypto.randomUUID()
    const timestamp = new Date().toISOString()
    
    // Save placeholder to database
    await c.env.DB.prepare(`
      INSERT INTO videos (id, url, artwork_id, metadata, created_at, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      videoId,
      '', // Empty URL for now
      imageId,
      JSON.stringify({ 
        model, 
        prompt, 
        enableLoop,
        duration,
        mode,
        status: 'generating',
        startedAt: timestamp
      }),
      timestamp,
      'generating' // Add status field
    ).run()
    
    console.log('Created video placeholder with ID:', videoId)
    
    // Always do sync generation since async isn't working with waitUntil
    try {
      await generateVideoAsync(c, videoId, artwork, {
        imageId, prompt, model, enableLoop, duration, seed, cfgScale, mode, tailImageId
      })
      
      return c.json({ 
        success: true, 
        videoId,
        status: 'completed',
        message: 'Video generated successfully!'
      })
    } catch (genError) {
      console.error('Video generation failed:', genError)
      
      // The video entry exists but failed, so return the ID
      return c.json({ 
        success: false,
        videoId,
        status: 'failed',
        error: genError.message,
        message: 'Video generation failed. Please try again.'
      })
    }
  } catch (error) {
    console.error('Video generation error:', error)
    return c.json({ error: error.message }, 500)
  }
})

// Async video generation function
async function generateVideoAsync(
  c: any,
  videoId: string,
  artwork: any,
  params: any
) {
  const { imageId, prompt, model, enableLoop, duration, seed, cfgScale, mode, tailImageId } = params
  
  console.log('generateVideoAsync started for video:', videoId)
  console.log('Parameters:', { model, duration, mode })
  
  try {
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
      'kling-2.1': {
        endpoint: mode === 'pro' 
          ? 'https://fal.run/fal-ai/kling-video/v2.1/pro/image-to-video'
          : mode === 'master'
          ? 'https://fal.run/fal-ai/kling-video/v2.1/master/image-to-video'
          : 'https://fal.run/fal-ai/kling-video/v2.1/standard/image-to-video',
        params: {
          image_url: fullImageUrl,
          prompt: prompt || 'smooth camera movement, cinematic',
          duration: duration.toString(),
          cfg_scale: cfgScale,
          negative_prompt: 'blur, distort, and low quality',
          seed: seed === -1 ? Math.floor(Math.random() * 1000000) : seed,
          ...(fullTailImageUrl && { tail_image_url: fullTailImageUrl })
        }
      },
      'kling-2.0': {
        endpoint: mode === 'pro' 
          ? 'https://fal.run/fal-ai/kling-video/v2/pro/image-to-video'
          : mode === 'master'
          ? 'https://fal.run/fal-ai/kling-video/v2/master/image-to-video'
          : 'https://fal.run/fal-ai/kling-video/v2/standard/image-to-video',
        params: {
          image_url: fullImageUrl,
          prompt: prompt || 'smooth camera movement, cinematic',
          duration: duration.toString(),
          cfg_scale: cfgScale,
          negative_prompt: 'blur, distort, and low quality',
          seed: seed === -1 ? Math.floor(Math.random() * 1000000) : seed,
          ...(fullTailImageUrl && { tail_image_url: fullTailImageUrl })
        }
      },
      'kling-1.6': {
        endpoint: mode === 'pro' 
          ? 'https://fal.run/fal-ai/kling-video/v1.6/pro/image-to-video'
          : 'https://fal.run/fal-ai/kling-video/v1.6/standard/image-to-video',
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
        endpoint: 'https://fal.run/fal-ai/kling-video/v1.5/pro/image-to-video',
        params: {
          image_url: fullImageUrl,
          prompt: prompt || 'smooth camera movement',
          duration: duration.toString(),
          cfg_scale: cfgScale,
          seed: seed === -1 ? Math.floor(Math.random() * 1000000) : seed
        }
      },
      'kling-1.0': {
        endpoint: 'https://fal.run/fal-ai/kling-video/v1/pro/image-to-video',
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
    
    const config = modelConfigs[model]
    if (!config) {
      console.error('Unknown model:', model)
      console.error('Available models:', Object.keys(modelConfigs))
      return c.json({ 
        error: `Unknown model: ${model}. Available models: ${Object.keys(modelConfigs).join(', ')}`
      }, 400)
    }
    
    console.log('Using model config:', model)
    console.log('Endpoint:', config.endpoint)
    console.log('Params:', JSON.stringify(config.params, null, 2))
    
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${c.env.FAL_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config.params)
    })
    
    const responseText = await response.text()
    console.log('Raw response:', responseText.substring(0, 1000))
    console.log('Response status:', response.status)
    
    if (!response.ok) {
      console.error('Video generation failed:', responseText)
      // Try to parse error response
      try {
        const errorData = JSON.parse(responseText)
        const errorMessage = errorData.detail || errorData.error || errorData.message || response.statusText
        throw new Error(`Video generation error: ${errorMessage}`)
      } catch (e) {
        throw new Error(`Video generation error: ${response.statusText}. ${responseText}`)
      }
    }
    
    let data
    try {
      data = JSON.parse(responseText)
    } catch (e) {
      console.error('Failed to parse response as JSON:', responseText)
      throw new Error('Invalid JSON response from Fal.ai API')
    }
    
    console.log('Video generation response:', JSON.stringify(data, null, 2))
    
    // Handle queue response - if we get a request_id, we need to poll for the result
    if (data.request_id && data.status_url) {
      console.log('Got queue response, will poll for result...')
      console.log('Request ID:', data.request_id)
      
      // Poll for the result
      let result = data
      let attempts = 0
      const maxAttempts = 120 // 10 minutes with 5 second intervals
      
      console.log('Starting to poll for video generation result...')
      console.log('Status URL:', data.status_url)
      
      while (result.status !== 'completed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds
        
        console.log(`Polling attempt ${attempts + 1}/${maxAttempts}...`)
        
        const statusResponse = await fetch(data.status_url, {
          headers: {
            'Authorization': `Key ${c.env.FAL_KEY}`
          }
        })
        
        if (!statusResponse.ok) {
          const errorText = await statusResponse.text()
          console.error('Status check failed:', errorText)
          throw new Error(`Status check failed: ${statusResponse.statusText}`)
        }
        
        result = await statusResponse.json()
        console.log(`Status: ${result.status}`, result.progress ? `Progress: ${result.progress}%` : '')
        
        if (result.status === 'failed') {
          console.error('Generation failed:', result)
          throw new Error(`Video generation failed: ${result.error || result.message || 'Unknown error'}`)
        }
        
        attempts++
      }
      
      if (result.status !== 'completed') {
        throw new Error('Video generation timed out')
      }
      
      // Use the completed result
      data = result
    }
    
    // Get video URL from response - handle different response formats
    let videoUrl = null
    
    // Check different possible locations for the video URL
    if (data.video?.url) {
      videoUrl = data.video.url
    } else if (data.video_url) {
      videoUrl = data.video_url
    } else if (data.url) {
      videoUrl = data.url
    } else if (data.output) {
      videoUrl = data.output
    } else if (data.outputs && Array.isArray(data.outputs) && data.outputs.length > 0) {
      videoUrl = data.outputs[0].url || data.outputs[0].video_url || data.outputs[0]
    } else if (data.result?.video_url) {
      videoUrl = data.result.video_url
    } else if (data.result?.url) {
      videoUrl = data.result.url
    }
    
    console.log('Extracted video URL:', videoUrl)
    console.log('Full response structure:', JSON.stringify(Object.keys(data), null, 2))
    
    if (!videoUrl) {
      console.error('Could not find video URL in response:', JSON.stringify(data, null, 2))
      throw new Error('No video URL found in response. Check logs for response structure.')
    }
    
    const key = `videos/${videoId}.mp4`
    
    // Download and save video
    console.log('Downloading video from:', videoUrl.substring(0, 100) + '...')
    const videoResponse = await fetch(videoUrl)
    
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.statusText}`)
    }
    
    console.log('Saving video to R2:', key)
    await c.env.R2.put(key, videoResponse.body, {
      httpMetadata: { contentType: 'video/mp4' }
    })
    console.log('Video saved to R2 successfully')
    
    // Update database with completed video
    console.log('Updating video in database:', {
      videoId,
      key,
      videoUrl: videoUrl.substring(0, 100) + '...'
    })
    
    try {
      const dbResult = await c.env.DB.prepare(`
        UPDATE videos
        SET url = ?, metadata = ?, status = ?
        WHERE id = ?
      `).bind(
        `/files/${key}`,
        JSON.stringify({ 
          model, 
          prompt, 
          enableLoop,
          duration,
          mode,
          fal_url: videoUrl,
          status: 'completed',
          completedAt: new Date().toISOString()
        }),
        'completed',
        videoId
      ).run()
      
      console.log('Database update result:', dbResult)
      console.log('Video updated successfully in database')
    } catch (dbError) {
      console.error('Database update error:', dbError)
      console.error('Error details:', dbError.stack)
      
      // Update status to failed
      await c.env.DB.prepare(`
        UPDATE videos
        SET status = ?, metadata = json_set(metadata, '$.error', ?)
        WHERE id = ?
      `).bind(
        'failed',
        dbError.message,
        videoId
      ).run()
    }
  } catch (error) {
    console.error('Video generation error:', error)
    console.error('Error stack:', error.stack)
    console.error('Error type:', error.constructor.name)
    
    // Update video status to failed
    try {
      await c.env.DB.prepare(`
        UPDATE videos
        SET status = ?, metadata = json_set(metadata, '$.error', ?, '$.failedAt', ?)
        WHERE id = ?
      `).bind(
        'failed',
        error.message,
        new Date().toISOString(),
        videoId
      ).run()
    } catch (updateError) {
      console.error('Failed to update video status:', updateError)
    }
  }
}

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
  const videos = await c.env.DB.prepare(`
    SELECT v.*, a.prompt as artwork_prompt 
    FROM videos v
    LEFT JOIN artwork a ON v.artwork_id = a.id
    ORDER BY v.created_at DESC
  `).all()
  
  // Parse metadata and add prompt from artwork if video prompt is empty
  const processedVideos = (videos.results || []).map(video => {
    const metadata = JSON.parse(video.metadata || '{}')
    return {
      ...video,
      prompt: metadata.prompt || video.artwork_prompt || 'No prompt',
      metadata: video.metadata,
      status: video.status || 'completed' // Default to completed for old videos
    }
  })
  
  return c.json(processedVideos)
})

// Test endpoint for video insertion
app.post('/api/test-video-insert', async (c) => {
  const videoId = crypto.randomUUID()
  try {
    // Get a valid artwork ID first
    const artwork = await c.env.DB.prepare('SELECT id FROM artwork LIMIT 1').first()
    if (!artwork) {
      return c.json({ 
        success: false, 
        error: 'No artwork found. Please generate some artwork first.'
      }, 400)
    }
    
    const result = await c.env.DB.prepare(`
      INSERT INTO videos (id, url, artwork_id, metadata, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      videoId,
      '/files/test-video.mp4',
      artwork.id,
      JSON.stringify({ test: true, model: 'test' }),
      new Date().toISOString()
    ).run()
    
    return c.json({ 
      success: true, 
      videoId,
      artworkId: artwork.id,
      dbResult: result
    })
  } catch (error) {
    return c.json({ 
      success: false, 
      error: error.message,
      stack: error.stack
    }, 500)
  }
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

// Debug video generation
app.get('/api/debug/video/:videoId', async (c) => {
  const videoId = c.req.param('videoId')
  
  const video = await c.env.DB.prepare(
    'SELECT * FROM videos WHERE id = ?'
  ).bind(videoId).first()
  
  if (!video) {
    return c.json({ error: 'Video not found' }, 404)
  }
  
  return c.json({
    video,
    metadata: JSON.parse(video.metadata || '{}'),
    age: Math.floor((Date.now() - new Date(video.created_at).getTime()) / 1000) + ' seconds'
  })
})

// Test async video generation manually
app.post('/api/test/generate-video-sync', async (c) => {
  const body = await c.req.json()
  const { videoId } = body
  
  try {
    // Get video and artwork
    const video = await c.env.DB.prepare(
      'SELECT * FROM videos WHERE id = ?'
    ).bind(videoId).first()
    
    if (!video) {
      return c.json({ error: 'Video not found' }, 404)
    }
    
    const artwork = await c.env.DB.prepare(
      'SELECT * FROM artwork WHERE id = ?'
    ).bind(video.artwork_id).first()
    
    if (!artwork) {
      return c.json({ error: 'Artwork not found' }, 404)
    }
    
    const metadata = JSON.parse(video.metadata || '{}')
    
    // Call the async function synchronously for testing
    await generateVideoAsync(c, videoId, artwork, {
      imageId: video.artwork_id,
      prompt: metadata.prompt || '',
      model: metadata.model || 'kling-2.1',
      enableLoop: metadata.enableLoop || false,
      duration: metadata.duration || 5,
      seed: -1,
      cfgScale: 0.5,
      mode: metadata.mode || 'standard',
      tailImageId: null
    })
    
    return c.json({ success: true, message: 'Video generation completed' })
  } catch (error) {
    return c.json({ 
      error: error.message, 
      stack: error.stack,
      type: error.constructor.name 
    }, 500)
  }
})

// Delete video
app.delete('/api/videos/:id', async (c) => {
  const id = c.req.param('id')
  
  try {
    // Get video to find R2 key
    const video = await c.env.DB.prepare('SELECT * FROM videos WHERE id = ?').bind(id).first()
    if (!video) {
      return c.json({ error: 'Video not found' }, 404)
    }
    
    // Delete from R2 if it has a URL
    if (video.url) {
      const key = video.url.replace('/files/', '')
      try {
        await c.env.R2.delete(key)
      } catch (error) {
        console.error('Failed to delete video from R2:', error)
      }
    }
    
    // Delete from database
    await c.env.DB.prepare('DELETE FROM videos WHERE id = ?').bind(id).run()
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Delete video error:', error)
    return c.json({ error: error.message }, 500)
  }
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

// Serve static assets
const assetManifest = JSON.parse(manifestJSON)

app.get('/*', async (c) => {
  try {
    // Skip API routes
    if (c.req.path.startsWith('/api/') || c.req.path.startsWith('/files/')) {
      return c.notFound()
    }

    const response = await getAssetFromKV(
      {
        request: c.req.raw,
        waitUntil: (promise) => c.executionCtx.waitUntil(promise),
      },
      {
        ASSET_NAMESPACE: c.env.__STATIC_CONTENT,
        ASSET_MANIFEST: assetManifest,
      }
    )
    
    return response
  } catch (e) {
    // If asset not found, serve index.html for client-side routing
    try {
      const response = await getAssetFromKV(
        {
          request: new Request(new URL('/index.html', c.req.url).toString()),
          waitUntil: (promise) => c.executionCtx.waitUntil(promise),
        },
        {
          ASSET_NAMESPACE: c.env.__STATIC_CONTENT,
          ASSET_MANIFEST: assetManifest,
        }
      )
      return response
    } catch {
      return c.text('Not Found', 404)
    }
  }
})

export default app