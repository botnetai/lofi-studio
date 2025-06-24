import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createRequestHandler } from '@tanstack/start/server'
import { getRouterManifest } from '@tanstack/start/router-manifest'

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
  const { prompt = 'lofi beat', customMode = false, title, tags, make_instrumental = true, model = '' } = body
  
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
    apiBody.custom_mode = false
    apiBody.prompt = `Create a lofi hip hop beat with the following characteristics:
- Relaxing and chill atmosphere perfect for studying or working
- Soft, warm bass lines with a mellow groove
- Dusty, vintage drum samples with a laid-back rhythm
- Gentle piano or guitar melodies with jazz influences
- Subtle vinyl crackle and ambient textures
- BPM around 70-90 for that perfect head-nodding tempo
- Optional: rain sounds, cafe ambience, or nature sounds in the background
Theme: ${prompt}`
  }
  
  const response = await fetch('https://api.udio.com/api/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${c.env.UDIOAPI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(apiBody)
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error('API Error:', errorText)
    return c.json({ error: 'Failed to generate music', details: errorText }, 500)
  }
  
  const data = await response.json()
  
  // Store the generation info in DB
  const songId = `song_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const createdAt = new Date().toISOString()
  
  const insertQuery = `
    INSERT INTO songs (
      id, title, prompt, generation_id, audio_url, 
      video_url, image_url, status, created_at, 
      updated_at, custom_mode, tags
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
  
  await c.env.DB.prepare(insertQuery)
    .bind(
      songId,
      title || `Lofi Beat ${new Date().toLocaleDateString()}`,
      prompt,
      data.id || data.request_id,
      null,
      null,
      null,
      'generating',
      createdAt,
      createdAt,
      customMode ? 1 : 0,
      tags || null
    )
    .run()
  
  return c.json({
    ...data,
    songId,
    message: 'Music generation started'
  })
})

app.get('/api/generate-music-status', async (c) => {
  const generationId = c.req.query('id')
  
  if (!generationId) {
    return c.json({ error: 'Generation ID is required' }, 400)
  }
  
  const response = await fetch(`https://api.udio.com/api/generations/${generationId}`, {
    headers: {
      'Authorization': `Bearer ${c.env.UDIOAPI_KEY}`,
    },
  })
  
  if (!response.ok) {
    return c.json({ error: 'Failed to get status' }, 500)
  }
  
  const data = await response.json()
  
  // Update song status in DB if completed
  if (data.status === 'complete' && data.audio_url) {
    const song = await c.env.DB.prepare(
      'SELECT * FROM songs WHERE generation_id = ?'
    ).bind(generationId).first()
    
    if (song) {
      const audioUrl = data.audio_url.startsWith('http') ? data.audio_url : `https://api.udio.com${data.audio_url}`
      
      await c.env.DB.prepare(`
        UPDATE songs 
        SET status = ?, audio_url = ?, updated_at = ?
        WHERE generation_id = ?
      `).bind(
        'completed',
        audioUrl,
        new Date().toISOString(),
        generationId
      ).run()
    }
  }
  
  return c.json(data)
})

app.post('/api/refresh-stuck', async (c) => {
  const { generationId, songId } = await c.req.json()
  
  if (!generationId || !songId) {
    return c.json({ error: 'Generation ID and Song ID are required' }, 400)
  }
  
  try {
    // First, check the current status from the API
    const response = await fetch(`https://api.udio.com/api/generations/${generationId}`, {
      headers: {
        'Authorization': `Bearer ${c.env.UDIOAPI_KEY}`,
      },
    })
    
    if (!response.ok) {
      // If the generation doesn't exist or failed, mark as failed
      await c.env.DB.prepare(`
        UPDATE songs 
        SET status = ?, updated_at = ?
        WHERE id = ?
      `).bind(
        'failed',
        new Date().toISOString(),
        songId
      ).run()
      
      return c.json({ success: true, status: 'failed' })
    }
    
    const data = await response.json()
    
    // Update the song based on the actual status
    if (data.status === 'complete' && data.audio_url) {
      const audioUrl = data.audio_url.startsWith('http') ? data.audio_url : `https://api.udio.com${data.audio_url}`
      
      await c.env.DB.prepare(`
        UPDATE songs 
        SET status = ?, audio_url = ?, updated_at = ?
        WHERE id = ?
      `).bind(
        'completed',
        audioUrl,
        new Date().toISOString(),
        songId
      ).run()
      
      return c.json({ success: true, status: 'completed', audio_url: audioUrl })
    } else if (data.status === 'failed' || data.status === 'error') {
      await c.env.DB.prepare(`
        UPDATE songs 
        SET status = ?, updated_at = ?
        WHERE id = ?
      `).bind(
        'failed',
        new Date().toISOString(),
        songId
      ).run()
      
      return c.json({ success: true, status: 'failed' })
    } else {
      // Still processing
      return c.json({ success: true, status: data.status || 'generating' })
    }
  } catch (error) {
    console.error('Error refreshing stuck song:', error)
    return c.json({ error: 'Failed to refresh song status' }, 500)
  }
})

// File serving from R2
app.get('/files/*', async (c) => {
  const key = c.req.param('*')
  if (!key) {
    return c.text('File not found', 404)
  }

  try {
    const object = await c.env.R2.get(key)
    
    if (!object) {
      return c.text('File not found', 404)
    }

    const headers = new Headers()
    object.writeHttpMetadata(headers)
    headers.set('etag', object.httpEtag)
    headers.set('Accept-Ranges', 'bytes')
    
    // Add cache headers
    headers.set('Cache-Control', 'public, max-age=31536000')
    
    // Handle range requests for audio/video streaming
    const range = c.req.header('range')
    if (range && object.size) {
      const parts = range.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : object.size - 1
      const chunkSize = end - start + 1
      
      headers.set('Content-Range', `bytes ${start}-${end}/${object.size}`)
      headers.set('Content-Length', chunkSize.toString())
      
      const stream = object.body?.getReader()
      if (!stream) {
        return c.body(object.body, 206, headers)
      }
      
      // Skip to start position
      let position = 0
      const chunks: Uint8Array[] = []
      
      while (position < start) {
        const { done, value } = await stream.read()
        if (done) break
        position += value.length
      }
      
      // Read the requested chunk
      while (position < end + 1) {
        const { done, value } = await stream.read()
        if (done) break
        
        const startOffset = position < start ? start - position : 0
        const endOffset = position + value.length > end + 1 ? end + 1 - position : value.length
        
        chunks.push(value.slice(startOffset, endOffset))
        position += value.length
      }
      
      const responseBody = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0))
      let offset = 0
      for (const chunk of chunks) {
        responseBody.set(chunk, offset)
        offset += chunk.length
      }
      
      return c.body(responseBody, 206, headers)
    }

    return c.body(object.body, 200, headers)
  } catch (error) {
    console.error('Error serving file:', error)
    return c.text('Internal server error', 500)
  }
})

app.delete('/api/songs/:id', async (c) => {
  const songId = c.req.param('id')
  
  try {
    // First, get the song to delete its files from R2
    const song = await c.env.DB.prepare('SELECT * FROM songs WHERE id = ?').bind(songId).first()
    
    if (!song) {
      return c.json({ error: 'Song not found' }, 404)
    }
    
    // Delete files from R2
    if (song.audio_url) {
      const audioKey = song.audio_url.replace('/files/', '')
      await c.env.R2.delete(audioKey)
    }
    
    if (song.video_url) {
      const videoKey = song.video_url.replace('/files/', '')
      await c.env.R2.delete(videoKey)
    }
    
    if (song.image_url) {
      const imageKey = song.image_url.replace('/files/', '')
      await c.env.R2.delete(imageKey)
    }
    
    // Delete from database
    await c.env.DB.prepare('DELETE FROM songs WHERE id = ?').bind(songId).run()
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Error deleting song:', error)
    return c.json({ error: 'Failed to delete song' }, 500)
  }
})

// Additional API routes (artwork, video, albums, etc.) would go here...
// For brevity, I'm including just the essential ones

// TanStack Start request handler
const startHandler = createRequestHandler({
  getRouterManifest,
})

// Handle all non-API routes with TanStack Start
app.all('*', async (c) => {
  // Skip API routes
  if (c.req.path.startsWith('/api/') || c.req.path.startsWith('/files/')) {
    return c.notFound()
  }
  
  // Pass to TanStack Start
  return startHandler(c.req.raw, {
    cloudflare: {
      env: c.env,
      // Add other Cloudflare context if needed
    }
  })
})

export default app