import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Env = {
  DB: D1Database
  R2: R2Bucket
  AI: any
  GOAPI_KEY: string
  UDIOAPI_KEY: string
  FAL_KEY: string
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
  const { prompt = 'lofi beat', customMode = false, title, tags, make_instrumental = true } = body
  
  // Prepare request for API
  const apiBody: any = {
    make_instrumental,
    wait_audio: false
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
    
    // Create a single placeholder in DB
    const songId = crypto.randomUUID()
    const placeholderTitle = customMode && title ? title : `Generating: ${prompt.substring(0, 50)}...`
    
    await c.env.DB.prepare(`
      INSERT INTO songs (id, name, url, metadata, created_at, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      songId,
      placeholderTitle,
      '',
      JSON.stringify({ workId: actualWorkId, prompt, customMode, title, tags, status: 'generating' }),
      new Date().toISOString(),
      'generating'
    ).run()
    
    return c.json({ 
      success: true, 
      workId: actualWorkId,
      songId
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
    // Try the feed endpoint first
    let response = await fetch(`https://udioapi.pro/api/v2/feed?workId=${workId}`, {
      headers: {
        'Authorization': `Bearer ${c.env.UDIOAPI_KEY}`
      }
    })
    
    let data = await response.json()
    console.log('Feed endpoint response:', JSON.stringify(data))
    
    // If feed endpoint doesn't have data, try the status endpoint
    if (!data.data || !data.data.response_data || data.data.response_data.length === 0) {
      console.log('Feed endpoint empty, trying status endpoint')
      response = await fetch(`https://udioapi.pro/api/v2/get-generation/${workId}`, {
        headers: {
          'Authorization': `Bearer ${c.env.UDIOAPI_KEY}`
        }
      })
      
      if (response.ok) {
        data = await response.json()
        console.log('Status endpoint response:', JSON.stringify(data))
      }
    }
    
    // Extract tracks from various possible response formats
    let tracks = []
    if (data.data && Array.isArray(data.data)) {
      tracks = data.data
    } else if (data.data && data.data.response_data && Array.isArray(data.data.response_data)) {
      tracks = data.data.response_data
    } else if (data.response_data && Array.isArray(data.response_data)) {
      tracks = data.response_data
    } else if (data.tracks && Array.isArray(data.tracks)) {
      tracks = data.tracks
    } else if (data.songs && Array.isArray(data.songs)) {
      tracks = data.songs
    } else if (Array.isArray(data)) {
      tracks = data
    }
    
    console.log(`Found ${tracks.length} tracks`)
    
    // Handle multiple tracks
    const completedTracks = []
    
    for (const track of tracks) {
      console.log('Track:', JSON.stringify(track))
      
      // Check various fields that might contain the audio URL
      const audioUrl = track.audio_url || track.song_url || track.url || track.audio || track.mp3_url
      
      // Check various status fields
      const isComplete = track.status === 'complete' || 
                       track.status === 'completed' ||
                       track.status === 'SUCCESS' || 
                       track.status === 'success' ||
                       track.status === 'streaming' ||
                       track.finished === true ||
                       (audioUrl && audioUrl.length > 0)
      
      if (isComplete && audioUrl) {
        completedTracks.push({
          ...track,
          audio_url: audioUrl,
          title: track.title || track.song_title || track.name || 'Untitled'
        })
      }
    }
    
    console.log(`${completedTracks.length} tracks completed`)
    
    if (completedTracks.length > 0) {
      // Get the original song record
      const result = await c.env.DB.prepare(
        "SELECT * FROM songs WHERE json_extract(metadata, '$.workId') = ?"
      ).bind(workId).first()
      
      if (result) {
        console.log('Updating song:', result.id)
        
        // Update the first/main track
        const mainTrack = completedTracks[0]
        try {
          console.log('Downloading audio from:', mainTrack.audio_url)
          const audioResponse = await fetch(mainTrack.audio_url)
          
          if (!audioResponse.ok) {
            console.error('Failed to download audio:', audioResponse.status)
            throw new Error('Failed to download audio')
          }
          
          const audioBlob = await audioResponse.blob()
          const audioKey = `songs/${result.id}.mp3`
          
          console.log('Saving to R2:', audioKey, 'Size:', audioBlob.size)
          
          await c.env.R2.put(audioKey, audioBlob.stream(), {
            httpMetadata: { 
              contentType: 'audio/mpeg',
              contentLength: audioBlob.size.toString()
            }
          })
          
          const metadata = JSON.parse(result.metadata as string || '{}')
          metadata.title = mainTrack.title
          metadata.duration = mainTrack.duration
          metadata.status = 'completed'
          metadata.audio_url = mainTrack.audio_url
          metadata.track_count = completedTracks.length
          
          await c.env.DB.prepare(`
            UPDATE songs 
            SET name = ?, url = ?, metadata = ?, status = 'completed'
            WHERE id = ?
          `).bind(
            mainTrack.title,
            `/files/${audioKey}`,
            JSON.stringify(metadata),
            result.id
          ).run()
          
          console.log('Main track updated')
          
          // If there are additional tracks, create separate entries
          for (let i = 1; i < completedTracks.length; i++) {
            const track = completedTracks[i]
            const variantId = crypto.randomUUID()
            const variantKey = `songs/${variantId}.mp3`
            
            console.log(`Creating variant ${i + 1}:`, track.title)
            
            try {
              const variantResponse = await fetch(track.audio_url)
              if (variantResponse.ok) {
                const variantBlob = await variantResponse.blob()
                
                await c.env.R2.put(variantKey, variantBlob.stream(), {
                  httpMetadata: { 
                    contentType: 'audio/mpeg',
                    contentLength: variantBlob.size.toString()
                  }
                })
                
                await c.env.DB.prepare(`
                  INSERT INTO songs (id, name, url, metadata, created_at, status)
                  VALUES (?, ?, ?, ?, ?, ?)
                `).bind(
                  variantId,
                  `${track.title} (Variant ${i + 1})`,
                  `/files/${variantKey}`,
                  JSON.stringify({
                    ...metadata,
                    title: track.title,
                    duration: track.duration,
                    audio_url: track.audio_url,
                    variant_of: result.id,
                    variant_number: i + 1
                  }),
                  new Date().toISOString(),
                  'completed'
                ).run()
                
                console.log(`Variant ${i + 1} created`)
              }
            } catch (error) {
              console.error('Error saving variant track:', error)
            }
          }
          
          return c.json({ 
            status: 'completed',
            tracks: completedTracks.length,
            songId: result.id 
          })
        } catch (error) {
          console.error('Error downloading/saving audio:', error)
          return c.json({ 
            status: 'error',
            error: error.message
          })
        }
      } else {
        console.error('Song not found in DB for workId:', workId)
      }
    }
    
    // Still processing
    return c.json({ 
      status: 'processing',
      tracks: tracks.length,
      rawData: data
    })
  } catch (error) {
    console.error('Status check error:', error)
    return c.json({ 
      status: 'error',
      error: error.message
    })
  }
})

// Debug endpoint to check API response
app.get('/api/debug-status/:workId', async (c) => {
  const workId = c.req.param('workId')
  
  const responses = {}
  
  // Try feed endpoint
  try {
    const feedRes = await fetch(`https://udioapi.pro/api/v2/feed?workId=${workId}`, {
      headers: {
        'Authorization': `Bearer ${c.env.UDIOAPI_KEY}`
      }
    })
    responses.feed = {
      status: feedRes.status,
      data: await feedRes.json()
    }
  } catch (e) {
    responses.feed = { error: e.message }
  }
  
  // Try status endpoint
  try {
    const statusRes = await fetch(`https://udioapi.pro/api/v2/get-generation/${workId}`, {
      headers: {
        'Authorization': `Bearer ${c.env.UDIOAPI_KEY}`
      }
    })
    responses.status = {
      status: statusRes.status,
      data: await statusRes.json()
    }
  } catch (e) {
    responses.status = { error: e.message }
  }
  
  // Check DB
  const dbSong = await c.env.DB.prepare(
    "SELECT * FROM songs WHERE json_extract(metadata, '$.workId') = ?"
  ).bind(workId).first()
  
  return c.json({
    workId,
    dbSong: dbSong ? {
      id: dbSong.id,
      name: dbSong.name,
      status: dbSong.status,
      metadata: JSON.parse(dbSong.metadata as string || '{}')
    } : null,
    apiResponses: responses
  })
})

// Manual completion endpoint for stuck songs
app.post('/api/manual-complete/:songId', async (c) => {
  const songId = c.req.param('songId')
  const body = await c.req.json()
  const { audioUrl, title } = body
  
  if (!audioUrl) {
    return c.json({ error: 'Audio URL required' }, 400)
  }
  
  const song = await c.env.DB.prepare(
    "SELECT * FROM songs WHERE id = ?"
  ).bind(songId).first()
  
  if (!song) {
    return c.json({ error: 'Song not found' }, 404)
  }
  
  try {
    // Download audio from provided URL
    const audioResponse = await fetch(audioUrl)
    if (!audioResponse.ok) {
      throw new Error('Failed to fetch audio')
    }
    
    const audioBlob = await audioResponse.blob()
    const audioKey = `songs/${songId}.mp3`
    
    await c.env.R2.put(audioKey, audioBlob.stream(), {
      httpMetadata: { 
        contentType: 'audio/mpeg',
        contentLength: audioBlob.size.toString()
      }
    })
    
    const metadata = JSON.parse(song.metadata as string || '{}')
    metadata.status = 'completed'
    metadata.manual_complete = true
    
    await c.env.DB.prepare(`
      UPDATE songs 
      SET name = ?, url = ?, metadata = ?, status = 'completed'
      WHERE id = ?
    `).bind(
      title || metadata.title || metadata.prompt || 'Untitled',
      `/files/${audioKey}`,
      JSON.stringify(metadata),
      songId
    ).run()
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Manual complete error:', error)
    return c.json({ 
      error: 'Failed to complete song',
      details: error.message 
    }, 500)
  }
})

// Other endpoints
app.post('/api/songs', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file') as File
  const metadata = JSON.parse(formData.get('metadata') as string || '{}')
  
  if (!file) {
    return c.json({ error: 'No file provided' }, 400)
  }
  
  const id = crypto.randomUUID()
  const key = `songs/${id}.mp3`
  
  await c.env.R2.put(key, file.stream(), {
    httpMetadata: { 
      contentType: 'audio/mpeg',
      contentLength: file.size.toString()
    }
  })
  
  await c.env.DB.prepare(`
    INSERT INTO songs (id, name, url, metadata, created_at, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    metadata.name || file.name,
    `/files/${key}`,
    JSON.stringify(metadata),
    new Date().toISOString(),
    'completed'
  ).run()
  
  return c.json({ success: true, id, url: `/files/${key}` })
})

// Refresh stuck songs
app.post('/api/refresh-stuck-songs', async (c) => {
  const stuckSongs = await c.env.DB.prepare(
    "SELECT * FROM songs WHERE status = 'generating'"
  ).all()
  
  let updated = 0
  let errors = []
  
  for (const song of stuckSongs.results || []) {
    const metadata = JSON.parse(song.metadata as string || '{}')
    if (metadata.workId) {
      try {
        // Use the same logic as status endpoint
        const response = await fetch(`https://udioapi.pro/api/v2/feed?workId=${metadata.workId}`, {
          headers: {
            'Authorization': `Bearer ${c.env.UDIOAPI_KEY}`
          }
        })
        
        if (!response.ok) {
          errors.push(`${song.name}: API error ${response.status}`)
          continue
        }
        
        const data = await response.json()
        
        // Extract tracks
        let tracks = []
        if (data.data && data.data.response_data) {
          tracks = data.data.response_data
        } else if (data.tracks) {
          tracks = data.tracks
        }
        
        for (const track of tracks) {
          const audioUrl = track.audio_url || track.song_url || track.url
          const isComplete = (audioUrl && audioUrl.length > 0)
          
          if (isComplete) {
            const audioResponse = await fetch(audioUrl)
            if (audioResponse.ok) {
              const audioBlob = await audioResponse.blob()
              const audioKey = `songs/${song.id}.mp3`
              
              await c.env.R2.put(audioKey, audioBlob.stream(), {
                httpMetadata: { 
                  contentType: 'audio/mpeg',
                  contentLength: audioBlob.size.toString()
                }
              })
              
              await c.env.DB.prepare(`
                UPDATE songs 
                SET name = ?, url = ?, status = 'completed'
                WHERE id = ?
              `).bind(
                track.title || track.song_title || metadata.prompt || 'Untitled',
                `/files/${audioKey}`,
                song.id
              ).run()
              
              updated++
              break
            } else {
              errors.push(`${song.name}: Failed to download audio`)
            }
          }
        }
        
        if (tracks.length === 0) {
          errors.push(`${song.name}: No tracks found`)
        }
      } catch (error) {
        console.error(`Error updating song ${song.id}:`, error)
        errors.push(`${song.name}: ${error.message}`)
      }
    }
  }
  
  return c.json({ 
    stuckSongs: stuckSongs.results?.length || 0,
    updated,
    errors
  })
})

app.post('/api/generate-artwork', async (c) => {
  const body = await c.req.json()
  const { prompt, model = 'flux-pro' } = body
  
  if (!prompt) {
    return c.json({ error: 'Prompt required' }, 400)
  }
  
  const results = []
  const aspectRatios = ['1:1', '16:9', '9:16']
  
  for (const aspectRatio of aspectRatios) {
    const response = await fetch('https://fal.run/fal-ai/' + model, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${c.env.FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        image_size: aspectRatio === '1:1' ? 'square' : aspectRatio === '16:9' ? 'landscape_16_9' : 'portrait_9_16',
        num_inference_steps: 28,
        guidance_scale: 3.5,
        num_images: 1,
        enable_safety_checker: true,
      }),
    })
    
    if (!response.ok) {
      throw new Error(`Fal.ai error: ${response.statusText}`)
    }
    
    const data = await response.json()
    if (data.images && data.images[0]) {
      const imageUrl = data.images[0].url
      const imageId = crypto.randomUUID()
      const key = `artwork/${imageId}_${aspectRatio.replace(':', 'x')}.jpg`
      
      const imageResponse = await fetch(imageUrl)
      const imageBlob = await imageResponse.blob()
      
      await c.env.R2.put(key, imageBlob.stream(), {
        httpMetadata: { contentType: 'image/jpeg' }
      })
      
      await c.env.DB.prepare(`
        INSERT INTO artwork (id, prompt, model, file_key, file_type, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        imageId,
        prompt,
        model,
        key,
        'image/jpeg',
        new Date().toISOString()
      ).run()
      
      results.push({
        id: imageId,
        aspectRatio,
        url: `/files/${key}`,
        originalUrl: imageUrl
      })
    }
  }
  
  return c.json({ success: true, images: results })
})

app.get('/api/artwork', async (c) => {
  const artwork = await c.env.DB.prepare('SELECT * FROM artwork ORDER BY created_at DESC').all()
  return c.json(artwork.results || [])
})

app.post('/api/compilations', async (c) => {
  const body = await c.req.json()
  const { name, songIds, artworkId } = body
  
  const id = crypto.randomUUID()
  await c.env.DB.prepare(`
    INSERT INTO compilations (id, name, songs, artwork_id, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    id,
    name,
    JSON.stringify(songIds),
    artworkId,
    new Date().toISOString()
  ).run()
  
  return c.json({ success: true, id })
})

app.get('/api/compilations', async (c) => {
  const compilations = await c.env.DB.prepare('SELECT * FROM compilations ORDER BY created_at DESC').all()
  return c.json(compilations.results || [])
})

// OPTIONS handler for CORS preflight
app.options('/files/*', async (c) => {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type',
      'Access-Control-Max-Age': '86400',
    }
  })
})

// Serve R2 files
app.get('/files/*', async (c) => {
  const key = c.req.param('*')
  
  if (!key) {
    return c.text('Bad Request', 400)
  }
  
  try {
    const object = await c.env.R2.get(key)
    
    if (!object) {
      return c.text('Not Found', 404)
    }
    
    const headers = new Headers()
    
    // Set content type
    headers.set('Content-Type', 'audio/mpeg')
    
    // Add R2 metadata if available
    if (object.httpMetadata) {
      object.writeHttpMetadata(headers)
    }
    
    // Override with correct content type for audio
    if (key.includes('songs/') || key.endsWith('.mp3')) {
      headers.set('Content-Type', 'audio/mpeg')
    }
    
    // Add size
    if (object.size) {
      headers.set('Content-Length', object.size.toString())
    }
    
    // CORS headers
    headers.set('Access-Control-Allow-Origin', '*')
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
    headers.set('Access-Control-Allow-Headers', '*')
    headers.set('Access-Control-Expose-Headers', '*')
    
    // Cache control
    headers.set('Cache-Control', 'no-cache')
    
    // Support range requests
    headers.set('Accept-Ranges', 'bytes')
    
    return c.body(object.body, { headers })
  } catch (error) {
    console.error('Error serving file:', error)
    return c.text('Internal Server Error', 500)
  }
})

// Serve React app with improved UI and error handling
app.get('*', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lofi Studio - AI Music Generation</title>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            purple: {
              500: '#8b5cf6',
              600: '#7c3aed',
              700: '#6d28d9'
            }
          }
        }
      }
    }
  </script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    body { font-family: 'Inter', sans-serif; }
    .scrollbar-thin::-webkit-scrollbar { width: 6px; }
    .scrollbar-thin::-webkit-scrollbar-track { background: #1f2937; }
    .scrollbar-thin::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 3px; }
    .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #6b7280; }
  </style>
</head>
<body class="bg-black text-white antialiased">
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useEffect, useRef } = React;
    
    function App() {
      const [activeTab, setActiveTab] = useState('music');
      const [songs, setSongs] = useState([]);
      const [selectedSongs, setSelectedSongs] = useState([]);
      const [artwork, setArtwork] = useState([]);
      const [compilations, setCompilations] = useState([]);
      const [prompt, setPrompt] = useState('');
      const [customMode, setCustomMode] = useState(false);
      const [title, setTitle] = useState('');
      const [tags, setTags] = useState('');
      const [makeInstrumental, setMakeInstrumental] = useState(true);
      const [isGenerating, setIsGenerating] = useState(false);
      const [artworkPrompt, setArtworkPrompt] = useState('');
      const [artworkModel, setArtworkModel] = useState('flux-pro');
      const [isGeneratingArt, setIsGeneratingArt] = useState(false);
      const [selectedArtwork, setSelectedArtwork] = useState(null);
      const [compilationName, setCompilationName] = useState('');
      const [playingSongId, setPlayingSongId] = useState(null);
      const [manualCompleteModal, setManualCompleteModal] = useState(null);
      const [manualAudioUrl, setManualAudioUrl] = useState('');
      const [manualTitle, setManualTitle] = useState('');
      const [sortOrder, setSortOrder] = useState('newest'); // 'newest' or 'oldest'
      const [error, setError] = useState(null);
      const [playbackErrors, setPlaybackErrors] = useState({});
      const audioRef = useRef(null);
      
      const fetchSongs = async () => {
        const res = await fetch('/api/songs');
        const data = await res.json();
        setSongs(data);
      };
      
      // Sort songs based on current sort order
      const sortedSongs = songs.sort((a, b) => {
        const dateA = new Date(a.created_at || 0);
        const dateB = new Date(b.created_at || 0);
        return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
      });
      
      const fetchArtwork = async () => {
        const res = await fetch('/api/artwork');
        const data = await res.json();
        setArtwork(data);
      };
      
      const fetchCompilations = async () => {
        const res = await fetch('/api/compilations');
        const data = await res.json();
        setCompilations(data);
      };
      
      useEffect(() => {
        fetchSongs();
        fetchArtwork();
        fetchCompilations();
        const interval = setInterval(() => {
          fetchSongs();
          if (activeTab === 'artwork') fetchArtwork();
          if (activeTab === 'compile') fetchCompilations();
        }, 5000);
        return () => clearInterval(interval);
      }, [activeTab]);
      
      const generateMusic = async () => {
        if (!prompt.trim() && !customMode) return;
        if (customMode && !title.trim()) return;
        
        // Set generating state immediately for instant feedback
        setIsGenerating(true);
        setError(null);
        
        // Immediately refresh songs to show the placeholder
        setTimeout(() => fetchSongs(), 100);
        
        try {
          const res = await fetch('/api/generate-music', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              prompt,
              customMode,
              title,
              tags,
              make_instrumental: makeInstrumental
            })
          });
          const data = await res.json();
          
          if (data.workId) {
            // Clear form immediately on success
            setPrompt('');
            setTitle('');
            setTags('');
            setIsGenerating(false);
            
            // Start polling for status
            pollStatus(data.workId);
            
            // Refresh songs again to ensure we have the latest
            fetchSongs();
          } else {
            setError('Failed to start generation: ' + (data.error || 'Unknown error'));
            setIsGenerating(false);
          }
        } catch (error) {
          setError('Error: ' + error.message);
          setIsGenerating(false);
        }
      };
      
      const pollStatus = async (workId) => {
        const maxAttempts = 60; // 5 minutes max
        let attempts = 0;
        
        const checkStatus = async () => {
          try {
            const res = await fetch(\`/api/generate-music-status?workId=\${workId}\`);
            const data = await res.json();
            
            console.log('Status check:', data);
            
            if (data.status === 'completed') {
              fetchSongs();
              if (data.tracks > 1) {
                setError(\`Generation complete! Created \${data.tracks} track variations.\`);
                setTimeout(() => setError(null), 5000);
              }
            } else if (data.status === 'error') {
              setError('Generation failed: ' + (data.error || 'Unknown error'));
            } else if (attempts < maxAttempts) {
              attempts++;
              setTimeout(checkStatus, 5000);
            } else {
              setError('Generation timed out. The track may still be processing. Use "Refresh Stuck" button to check later.');
            }
          } catch (error) {
            console.error('Status check error:', error);
            if (attempts < maxAttempts) {
              attempts++;
              setTimeout(checkStatus, 5000);
            }
          }
        };
        
        setTimeout(checkStatus, 5000);
      };
      
      const debugStatus = async (workId) => {
        try {
          const res = await fetch(\`/api/debug-status/\${workId}\`);
          const data = await res.json();
          console.log('Debug status:', data);
          setError('Check console for debug info on workId: ' + workId);
        } catch (error) {
          setError('Debug error: ' + error.message);
        }
      };
      
      const refreshStuckSongs = async () => {
        try {
          const res = await fetch('/api/refresh-stuck-songs', {
            method: 'POST'
          });
          const data = await res.json();
          if (data.updated > 0) {
            setError(\`Updated \${data.updated} stuck songs!\`);
            setTimeout(() => setError(null), 3000);
            fetchSongs();
          } else if (data.errors && data.errors.length > 0) {
            setError(\`Found \${data.stuckSongs} stuck songs. Errors: \${data.errors.join(', ')}\`);
          } else {
            setError(\`Found \${data.stuckSongs} stuck songs but couldn't update any. Try manual completion.\`);
          }
        } catch (error) {
          setError('Error refreshing: ' + error.message);
        }
      };
      
      const manualComplete = async (songId) => {
        if (!manualAudioUrl.trim()) {
          setError('Please enter an audio URL');
          return;
        }
        
        try {
          const res = await fetch(\`/api/manual-complete/\${songId}\`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioUrl: manualAudioUrl,
              title: manualTitle
            })
          });
          
          if (res.ok) {
            setError('Song completed successfully!');
            setTimeout(() => setError(null), 3000);
            setManualCompleteModal(null);
            setManualAudioUrl('');
            setManualTitle('');
            fetchSongs();
          } else {
            const data = await res.json();
            setError('Error: ' + data.error);
          }
        } catch (error) {
          setError('Error: ' + error.message);
        }
      };
      
      const generateArtwork = async () => {
        if (!artworkPrompt.trim()) return;
        
        setIsGeneratingArt(true);
        setError(null);
        try {
          const res = await fetch('/api/generate-artwork', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              prompt: artworkPrompt,
              model: artworkModel
            })
          });
          const data = await res.json();
          
          if (data.success) {
            fetchArtwork();
            setArtworkPrompt('');
          } else {
            setError('Failed to generate artwork');
          }
        } catch (error) {
          setError('Error: ' + error.message);
        } finally {
          setIsGeneratingArt(false);
        }
      };
      
      const createCompilation = async () => {
        if (!compilationName.trim() || selectedSongs.length === 0) {
          setError('Please select songs and enter a compilation name');
          return;
        }
        
        try {
          const res = await fetch('/api/compilations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: compilationName,
              songIds: selectedSongs,
              artworkId: selectedArtwork
            })
          });
          
          if (res.ok) {
            setCompilationName('');
            setSelectedSongs([]);
            setSelectedArtwork(null);
            fetchCompilations();
            setError('Compilation created successfully!');
            setTimeout(() => setError(null), 3000);
          }
        } catch (error) {
          setError('Error: ' + error.message);
        }
      };
      
      const toggleSong = (songId) => {
        setSelectedSongs(prev => 
          prev.includes(songId) 
            ? prev.filter(id => id !== songId)
            : [...prev, songId]
        );
      };
      
      const uploadFile = async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('metadata', JSON.stringify({ name: file.name }));
        
        const res = await fetch('/api/songs', {
          method: 'POST',
          body: formData
        });
        
        if (res.ok) {
          fetchSongs();
          setError('File uploaded successfully!');
          setTimeout(() => setError(null), 3000);
        } else {
          setError('Failed to upload file');
        }
      };
      
      const togglePlay = async (songId, songUrl) => {
        if (playingSongId === songId) {
          // Stop playing
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
          }
          setPlayingSongId(null);
          setPlaybackErrors(prev => ({ ...prev, [songId]: null }));
        } else {
          // Stop any current playback
          if (audioRef.current) {
            audioRef.current.pause();
          }
          
          // Clear previous error for this song
          setPlaybackErrors(prev => ({ ...prev, [songId]: null }));
          
          try {
            // Create new audio element
            audioRef.current = new Audio();
            
            // Build full URL
            let fullUrl = songUrl;
            if (songUrl.startsWith('/')) {
              fullUrl = window.location.origin + songUrl;
            }
            
            audioRef.current.src = fullUrl;
            
            // Set up event handlers
            audioRef.current.onended = () => {
              setPlayingSongId(null);
              audioRef.current = null;
            };
            
            audioRef.current.onerror = (e) => {
              const errorMessage = 'Cannot play audio. Try downloading the file instead.';
              setPlaybackErrors(prev => ({ ...prev, [songId]: errorMessage }));
              setPlayingSongId(null);
              audioRef.current = null;
            };
            
            // Try to play
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
              playPromise.then(() => {
                setPlayingSongId(songId);
                setPlaybackErrors(prev => ({ ...prev, [songId]: null }));
              }).catch(error => {
                const errorMessage = 'Playback failed: ' + error.message;
                setPlaybackErrors(prev => ({ ...prev, [songId]: errorMessage }));
                audioRef.current = null;
              });
            }
          } catch (error) {
            const errorMessage = 'Error: ' + error.message;
            setPlaybackErrors(prev => ({ ...prev, [songId]: errorMessage }));
            setPlayingSongId(null);
          }
        }
      };
      
      // Clean up audio on unmount
      useEffect(() => {
        return () => {
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
          }
        };
      }, []);
      
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
          <div className="container mx-auto px-4 py-8 max-w-7xl">
            {/* Header */}
            <div className="text-center mb-10">
              <h1 className="text-6xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-3">
                Lofi Studio
              </h1>
              <p className="text-gray-400 text-lg">Create AI-powered lofi music compilations in minutes</p>
            </div>
            
            {/* Global Error Display */}
            {error && (
              <div className="mb-6 p-4 bg-red-900/20 border border-red-700/50 rounded-xl text-red-400">
                {error}
              </div>
            )}
            
            {/* Navigation Tabs */}
            <div className="flex flex-wrap gap-3 mb-10 justify-center">
              {[
                { id: 'music', name: 'Music', desc: 'Generate & manage tracks' },
                { id: 'artwork', name: 'Artwork', desc: 'Create album art' },
                { id: 'compile', name: 'Compile', desc: 'Build compilations' },
                { id: 'publish', name: 'Publish', desc: 'Export & distribute' }
              ].map((tab, idx) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={\`relative px-8 py-4 rounded-xl font-medium transition-all duration-300 \${
                    activeTab === tab.id 
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 scale-105' 
                      : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-gray-300 border border-gray-700'
                  }\`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold">{idx + 1}</span>
                    <div className="text-left">
                      <div className="font-semibold">{tab.name}</div>
                      <div className="text-xs opacity-75">{tab.desc}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            
            {/* Music Tab */}
            {activeTab === 'music' && (
              <div className="grid lg:grid-cols-2 gap-8">
                {/* Generate Music Panel */}
                <div className="bg-gray-800/30 backdrop-blur rounded-2xl p-8 border border-gray-700/50">
                  <h2 className="text-3xl font-bold mb-2">Generate Music</h2>
                  <p className="text-gray-400 mb-8">
                    Create unique lofi beats using AI. Each generation creates 2 track variations.
                  </p>
                  
                  <div className="space-y-6">
                    {/* Mode Toggle */}
                    <div className="p-4 bg-gray-900/50 rounded-xl">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={customMode}
                          onChange={(e) => setCustomMode(e.target.checked)}
                          className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
                        />
                        <div>
                          <span className="font-medium">Custom Mode</span>
                          <p className="text-sm text-gray-500">Specify exact title and tags for more control</p>
                        </div>
                      </label>
                    </div>
                    
                    {!customMode ? (
                      <div>
                        <label className="block text-sm font-semibold mb-2 text-gray-300">
                          Music Description (AI Mode)
                        </label>
                        <textarea
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          placeholder="Example: lofi hip hop, jazzy, warm vinyl crackle, soft piano, rain sounds, nostalgic 90s vibe"
                          className="w-full px-4 py-3 bg-gray-900/50 rounded-xl border border-gray-700 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 resize-none text-white placeholder-gray-500"
                          rows="4"
                        />
                        <p className="text-xs text-gray-500 mt-2">
                          <strong>Tip:</strong> Use descriptive keywords like genres, moods, instruments, and atmospheres. The AI will creatively interpret your description.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-sm font-semibold mb-2 text-gray-300">
                            Song Title <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Example: Midnight Rain Study Session"
                            className="w-full px-4 py-3 bg-gray-900/50 rounded-xl border border-gray-700 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-white placeholder-gray-500"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-semibold mb-2 text-gray-300">
                            Detailed Description
                          </label>
                          <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Example: Chill lofi beat with soft jazz piano, gentle rain sounds, warm vinyl crackle, 75-85 BPM, perfect for late night studying"
                            className="w-full px-4 py-3 bg-gray-900/50 rounded-xl border border-gray-700 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 resize-none text-white placeholder-gray-500"
                            rows="3"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-semibold mb-2 text-gray-300">
                            Style Tags
                          </label>
                          <input
                            type="text"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            placeholder="Example: lofi, chill, jazz, study, relaxing, ambient"
                            className="w-full px-4 py-3 bg-gray-900/50 rounded-xl border border-gray-700 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-white placeholder-gray-500"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Comma-separated tags to help categorize your track
                          </p>
                        </div>
                      </>
                    )}
                    
                    <div className="p-4 bg-gray-900/50 rounded-xl">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={makeInstrumental}
                          onChange={(e) => setMakeInstrumental(e.target.checked)}
                          className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
                        />
                        <div>
                          <span className="font-medium">Instrumental Only</span>
                          <p className="text-sm text-gray-500">No vocals, pure instrumental track</p>
                        </div>
                      </label>
                    </div>
                    
                    <button
                      onClick={generateMusic}
                      disabled={isGenerating || (!prompt.trim() && !customMode) || (customMode && !title.trim())}
                      className={\`w-full py-4 rounded-xl font-semibold text-lg transition-all duration-300 \${
                        isGenerating || (!prompt.trim() && !customMode) || (customMode && !title.trim())
                          ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                          : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                      }\`}
                    >
                      {isGenerating ? 'Generating Music...' : 'Generate Music'}
                    </button>
                    
                    {isGenerating && (
                      <div className="p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-xl">
                        <p className="text-sm text-yellow-400">
                          <strong>Generating...</strong> Each generation creates 2 track variations. This typically takes 2-3 minutes.
                        </p>
                        <div className="mt-2">
                          <div className="w-full bg-yellow-900/30 rounded-full h-2">
                            <div className="bg-yellow-500 h-2 rounded-full animate-pulse" style={{width: '50%'}}></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Music Library Panel */}
                <div className="bg-gray-800/30 backdrop-blur rounded-2xl p-8 border border-gray-700/50">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-3xl font-bold">Music Library</h2>
                      <p className="text-gray-400 mt-1">Your tracks and uploads</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
                        className="px-4 py-2.5 bg-gray-700/50 hover:bg-gray-700 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
                        title="Sort by date"
                      >
                        <span>Sort:</span>
                        <span className="text-purple-400">{sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}</span>
                      </button>
                      <button
                        onClick={refreshStuckSongs}
                        className="px-5 py-2.5 bg-gray-700/50 hover:bg-gray-700 rounded-xl text-sm font-medium transition-colors"
                        title="Check if any stuck songs have completed"
                      >
                        Refresh Stuck
                      </button>
                    </div>
                  </div>
                  
                  {/* Upload Section */}
                  <div className="mb-6 p-5 bg-gray-900/30 rounded-xl border border-gray-700/50">
                    <label className="block text-sm font-semibold mb-3">Upload Your Own Track</label>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(e) => e.target.files[0] && uploadFile(e.target.files[0])}
                      className="w-full text-sm text-gray-400 file:mr-4 file:py-2.5 file:px-5 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-purple-600 file:text-white hover:file:bg-purple-700 file:cursor-pointer cursor-pointer"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Upload MP3 files to add to your library
                    </p>
                  </div>
                  
                  {/* Songs List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-400">
                        {songs.length} track{songs.length !== 1 ? 's' : ''} in library
                      </span>
                      {selectedSongs.length > 0 && (
                        <span className="text-sm font-medium text-purple-400">
                          {selectedSongs.length} selected
                        </span>
                      )}
                    </div>
                    
                    {songs.length === 0 ? (
                      <div className="text-center py-16 text-gray-500">
                        <div className="text-6xl mb-4 opacity-20">♪</div>
                        <p className="text-lg font-medium mb-2">No tracks yet</p>
                        <p className="text-sm">Generate or upload music to get started</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[500px] overflow-y-auto scrollbar-thin pr-2">
                        {sortedSongs.map(song => {
                          const metadata = typeof song.metadata === 'string' 
                            ? JSON.parse(song.metadata) 
                            : song.metadata || {};
                          const isGenerating = song.status === 'generating';
                          const isSelected = selectedSongs.includes(song.id);
                          const isPlaying = playingSongId === song.id;
                          const isVariant = metadata.variant_of;
                          const playbackError = playbackErrors[song.id];
                          
                          return (
                            <div 
                              key={song.id} 
                              className={\`group relative p-4 rounded-xl border transition-all duration-200 \${
                                isSelected 
                                  ? 'bg-purple-600/10 border-purple-600/50' 
                                  : 'bg-gray-900/30 border-gray-700/50 hover:bg-gray-900/50 hover:border-gray-600'
                              } \${isVariant ? 'ml-8' : ''}\`}
                            >
                              <div className="flex items-center gap-4">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSong(song.id)}
                                  disabled={isGenerating}
                                  className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
                                />
                                
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium truncate">
                                    {song.name}
                                    {isVariant && (
                                      <span className="text-sm text-gray-500 ml-2">
                                        (Variant {metadata.variant_number})
                                      </span>
                                    )}
                                  </h4>
                                  {metadata.prompt && (
                                    <p className="text-sm text-gray-500 truncate mt-1">{metadata.prompt}</p>
                                  )}
                                  <div className="flex items-center gap-4 mt-1">
                                    {isGenerating && (
                                      <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                                        <span className="text-xs text-yellow-500">Generating...</span>
                                        {metadata.workId && (
                                          <button
                                            onClick={() => debugStatus(metadata.workId)}
                                            className="text-xs text-gray-600 hover:text-gray-400"
                                          >
                                            (debug)
                                          </button>
                                        )}
                                      </div>
                                    )}
                                    {song.created_at && (
                                      <span className="text-xs text-gray-600">
                                        {new Date(song.created_at).toLocaleString('en-US', {
                                          month: 'short',
                                          day: 'numeric',
                                          hour: 'numeric',
                                          minute: '2-digit',
                                          hour12: true
                                        })}
                                      </span>
                                    )}
                                  </div>
                                  {playbackError && (
                                    <p className="text-xs text-red-400 mt-1">{playbackError}</p>
                                  )}
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  {isGenerating ? (
                                    <button
                                      onClick={() => {
                                        setManualCompleteModal(song.id);
                                        setManualTitle(metadata.title || metadata.prompt || '');
                                      }}
                                      className="px-3 py-1.5 bg-gray-700/50 hover:bg-gray-700 rounded-lg text-sm transition-colors"
                                      title="Manually complete if stuck"
                                    >
                                      Fix
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => togglePlay(song.id, song.url)}
                                        className="px-3 py-1.5 bg-gray-700/50 hover:bg-gray-700 rounded-lg text-sm transition-colors"
                                        disabled={!song.url}
                                      >
                                        {isPlaying ? 'Pause' : 'Play'}
                                      </button>
                                      <a 
                                        href={song.url} 
                                        download 
                                        className="px-3 py-1.5 bg-gray-700/50 hover:bg-gray-700 rounded-lg text-sm transition-colors"
                                      >
                                        Download
                                      </a>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Artwork Tab */}
            {activeTab === 'artwork' && (
              <div className="grid lg:grid-cols-2 gap-8">
                <div className="bg-gray-800/30 backdrop-blur rounded-2xl p-8 border border-gray-700/50">
                  <h2 className="text-3xl font-bold mb-2">Generate Artwork</h2>
                  <p className="text-gray-400 mb-8">
                    Create album artwork in all aspect ratios automatically
                  </p>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-gray-300">
                        Artwork Description
                      </label>
                      <textarea
                        value={artworkPrompt}
                        onChange={(e) => setArtworkPrompt(e.target.value)}
                        placeholder="Example: Cozy bedroom at night, warm lamp light, vintage record player, plants by the window, rain outside, lofi aesthetic"
                        className="w-full px-4 py-3 bg-gray-900/50 rounded-xl border border-gray-700 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 resize-none text-white placeholder-gray-500"
                        rows="4"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Generates 1:1 (album), 16:9 (YouTube), and 9:16 (TikTok/Shorts) versions
                      </p>
                    </div>
                    
                    <button
                      onClick={generateArtwork}
                      disabled={isGeneratingArt || !artworkPrompt.trim()}
                      className={\`w-full py-4 rounded-xl font-semibold text-lg transition-all duration-300 \${
                        isGeneratingArt || !artworkPrompt.trim()
                          ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                          : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                      }\`}
                    >
                      {isGeneratingArt ? 'Creating Artwork...' : 'Generate Artwork'}
                    </button>
                  </div>
                </div>
                
                <div className="bg-gray-800/30 backdrop-blur rounded-2xl p-8 border border-gray-700/50">
                  <h2 className="text-3xl font-bold mb-6">Artwork Gallery</h2>
                  
                  {artwork.length === 0 ? (
                    <div className="text-center py-16 text-gray-500">
                      <div className="text-6xl mb-4 opacity-20">🎨</div>
                      <p className="text-lg font-medium mb-2">No artwork yet</p>
                      <p className="text-sm">Generate some visuals to get started</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 max-h-[600px] overflow-y-auto scrollbar-thin pr-2">
                      {artwork.map(art => (
                        <div 
                          key={art.id}
                          onClick={() => setSelectedArtwork(art.id)}
                          className={\`relative group cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-200 \${
                            selectedArtwork === art.id 
                              ? 'border-purple-600 shadow-lg shadow-purple-600/20' 
                              : 'border-gray-700 hover:border-gray-600'
                          }\`}
                        >
                          <img 
                            src={\`/files/\${art.file_key}\`} 
                            alt={art.prompt}
                            className="w-full h-48 object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="absolute bottom-0 left-0 right-0 p-4">
                              <p className="text-sm text-white truncate">{art.prompt}</p>
                            </div>
                          </div>
                          {selectedArtwork === art.id && (
                            <div className="absolute top-3 right-3 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                              <span className="text-white text-sm">✓</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Compile Tab */}
            {activeTab === 'compile' && (
              <div className="max-w-3xl mx-auto">
                <div className="bg-gray-800/30 backdrop-blur rounded-2xl p-8 border border-gray-700/50">
                  <h2 className="text-3xl font-bold mb-2">Create Release</h2>
                  <p className="text-gray-400 mb-8">
                    Combine your selected tracks and artwork into a release
                  </p>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-gray-300">
                        Release Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={compilationName}
                        onChange={(e) => setCompilationName(e.target.value)}
                        placeholder="Example: Late Night Lofi Sessions Vol. 1"
                        className="w-full px-4 py-3 bg-gray-900/50 rounded-xl border border-gray-700 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-white placeholder-gray-500"
                      />
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="p-5 bg-gray-900/30 rounded-xl">
                        <h3 className="font-semibold mb-2">Selected Tracks</h3>
                        <p className="text-2xl font-bold text-purple-400">{selectedSongs.length}</p>
                        {selectedSongs.length === 0 && (
                          <p className="text-sm text-gray-500 mt-1">Go to Music tab to select tracks</p>
                        )}
                      </div>
                      
                      <div className="p-5 bg-gray-900/30 rounded-xl">
                        <h3 className="font-semibold mb-2">Selected Artwork</h3>
                        <p className="text-2xl font-bold text-purple-400">{selectedArtwork ? 'Yes' : 'None'}</p>
                        {!selectedArtwork && (
                          <p className="text-sm text-gray-500 mt-1">Go to Artwork tab to select</p>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={createCompilation}
                      disabled={!compilationName.trim() || selectedSongs.length === 0}
                      className={\`w-full py-4 rounded-xl font-semibold text-lg transition-all duration-300 \${
                        !compilationName.trim() || selectedSongs.length === 0
                          ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                          : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                      }\`}
                    >
                      Create Release
                    </button>
                  </div>
                  
                  {compilations.length > 0 && (
                    <div className="mt-10">
                      <h3 className="text-xl font-semibold mb-4">Your Releases</h3>
                      <div className="space-y-3">
                        {compilations.map(comp => (
                          <div key={comp.id} className="p-4 bg-gray-900/30 rounded-xl border border-gray-700/50">
                            <h4 className="font-medium">{comp.name}</h4>
                            <p className="text-sm text-gray-500 mt-1">
                              {JSON.parse(comp.songs).length} tracks • Created {new Date(comp.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Publish Tab */}
            {activeTab === 'publish' && (
              <div className="max-w-3xl mx-auto space-y-6">
                <div className="bg-gray-800/30 backdrop-blur rounded-2xl p-8 border border-gray-700/50">
                  <h2 className="text-3xl font-bold mb-2">Publishing Options</h2>
                  <p className="text-gray-400 mb-8">
                    Distribute your lofi compilation to major platforms
                  </p>
                  
                  <div className="space-y-6">
                    <div className="p-6 bg-gray-900/30 rounded-xl border border-purple-600/30">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-semibold">DistroKid</h3>
                        <span className="px-3 py-1 bg-purple-600/20 text-purple-400 rounded-lg text-sm">Recommended</span>
                      </div>
                      <p className="text-gray-400 mb-4">
                        Distribute to Spotify, Apple Music, YouTube Music, and 150+ streaming services. Keep 100% of royalties.
                      </p>
                      <ul className="text-sm text-gray-500 space-y-1 mb-4">
                        <li>• One-time upload to all platforms</li>
                        <li>• Spotify verified artist profile</li>
                        <li>• YouTube Content ID monetization</li>
                      </ul>
                      <button className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors">
                        Export for DistroKid
                      </button>
                    </div>
                    
                    <div className="p-6 bg-gray-900/30 rounded-xl border border-gray-700/50">
                      <h3 className="text-xl font-semibold mb-4">YouTube</h3>
                      <p className="text-gray-400 mb-4">
                        Create visualizer videos with your artwork for YouTube uploads.
                      </p>
                      <button className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors">
                        Generate YouTube Video
                      </button>
                    </div>
                    
                    <div className="p-6 bg-gray-900/30 rounded-xl border border-gray-700/50">
                      <h3 className="text-xl font-semibold mb-4">Social Media</h3>
                      <p className="text-gray-400 mb-4">
                        Create short clips for TikTok, Instagram Reels, and YouTube Shorts.
                      </p>
                      <button className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors">
                        Generate Short Clips
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Manual Complete Modal */}
            {manualCompleteModal && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full border border-gray-700">
                  <h3 className="text-xl font-bold mb-4">Manually Complete Song</h3>
                  <p className="text-gray-400 mb-6 text-sm">
                    If your song is stuck but you have the audio URL from Udio, you can manually complete it here.
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Audio URL <span className="text-red-400">*</span></label>
                      <input
                        type="text"
                        value={manualAudioUrl}
                        onChange={(e) => setManualAudioUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full px-4 py-2 bg-gray-900/50 rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none text-white"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        The direct URL to the MP3 file
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Title (optional)</label>
                      <input
                        type="text"
                        value={manualTitle}
                        onChange={(e) => setManualTitle(e.target.value)}
                        placeholder="Track title"
                        className="w-full px-4 py-2 bg-gray-900/50 rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none text-white"
                      />
                    </div>
                    
                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={() => manualComplete(manualCompleteModal)}
                        className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
                      >
                        Complete Song
                      </button>
                      <button
                        onClick={() => {
                          setManualCompleteModal(null);
                          setManualAudioUrl('');
                          setManualTitle('');
                        }}
                        className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }
    
    ReactDOM.render(<App />, document.getElementById('root'));
  </script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
</body>
</html>`)
})

export default app