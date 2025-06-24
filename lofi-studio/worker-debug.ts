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

// Enable CORS
app.use('*', cors())

// Debug endpoint to check Udio API response
app.get('/api/debug-udio/:workId', async (c) => {
  const workId = c.req.param('workId')
  
  try {
    const response = await fetch(`https://udioapi.pro/api/v2/feed?workId=${workId}`, {
      headers: {
        'Authorization': `Bearer ${c.env.UDIOAPI_KEY}`
      }
    })
    
    const text = await response.text()
    console.log('Raw response:', text)
    
    let data
    try {
      data = JSON.parse(text)
    } catch (e) {
      return c.json({ 
        error: 'Invalid JSON response',
        status: response.status,
        statusText: response.statusText,
        rawText: text
      })
    }
    
    return c.json({
      status: response.status,
      statusText: response.statusText,
      data,
      workId
    })
  } catch (error) {
    return c.json({ 
      error: error.message,
      workId 
    })
  }
})

// API Routes
app.get('/api/songs', async (c) => {
  const songs = await c.env.DB.prepare('SELECT * FROM songs ORDER BY created_at DESC').all()
  return c.json(songs.results || [])
})

app.post('/api/generate-music', async (c) => {
  const body = await c.req.json()
  const { prompt = 'lofi beat', customMode = false, title, tags, make_instrumental = true } = body
  
  const songId = crypto.randomUUID()
  
  // Create placeholder in DB immediately
  const placeholderTitle = customMode && title ? title : `Generating: ${prompt.substring(0, 50)}...`
  await c.env.DB.prepare(`
    INSERT INTO songs (id, name, url, metadata, created_at, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    songId,
    placeholderTitle,
    '',
    JSON.stringify({ prompt, customMode, title, tags, status: 'generating' }),
    new Date().toISOString(),
    'generating'
  ).run()
  
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
    console.log('Generate response text:', responseText)
    
    if (!response.ok) {
      console.error('AI Music API error:', responseText)
      return c.json({ 
        error: 'Failed to start generation',
        details: responseText,
        status: response.status
      }, 500)
    }
    
    let data
    try {
      data = JSON.parse(responseText)
    } catch (e) {
      console.error('Failed to parse response:', e)
      return c.json({ 
        error: 'Invalid response from API',
        details: responseText 
      }, 500)
    }
    
    console.log('Generate response parsed:', JSON.stringify(data))
    
    // Get the actual work ID from the response - it might be in different fields
    const actualWorkId = data.workId || data.work_id || data.id || data.generation_id || data.data?.workId || data.data?.id
    
    if (!actualWorkId) {
      console.error('No workId found in response:', data)
      return c.json({ 
        error: 'No work ID in response',
        response: data 
      }, 500)
    }
    
    // Update with actual workId
    await c.env.DB.prepare(`
      UPDATE songs 
      SET metadata = json_set(metadata, '$.workId', ?)
      WHERE id = ?
    `).bind(actualWorkId, songId).run()
    
    return c.json({ 
      success: true, 
      workId: actualWorkId,
      songId,
      response: data
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
  
  // Use the correct feed endpoint
  const response = await fetch(`https://udioapi.pro/api/v2/feed?workId=${workId}`, {
    headers: {
      'Authorization': `Bearer ${c.env.UDIOAPI_KEY}`
    }
  })
  
  const responseText = await response.text()
  console.log('Status response text:', responseText)
  
  if (!response.ok) {
    console.error('Status check failed:', responseText)
    return c.json({ 
      status: 'error',
      error: responseText,
      httpStatus: response.status
    }, 500)
  }
  
  let data
  try {
    data = JSON.parse(responseText)
  } catch (e) {
    console.error('Failed to parse status response:', e)
    return c.json({ 
      status: 'error',
      error: 'Invalid JSON response',
      rawText: responseText
    }, 500)
  }
  
  console.log('Status response parsed:', JSON.stringify(data))
  
  // Try different possible response structures
  let tracks = []
  if (data.data && Array.isArray(data.data)) {
    tracks = data.data
  } else if (data.data && data.data.response_data && Array.isArray(data.data.response_data)) {
    tracks = data.data.response_data
  } else if (data.response_data && Array.isArray(data.response_data)) {
    tracks = data.response_data
  } else if (Array.isArray(data)) {
    tracks = data
  }
  
  console.log(`Found ${tracks.length} tracks`)
  
  for (const track of tracks) {
    console.log('Track status:', track.status, 'Has audio_url:', !!track.audio_url)
    
    // Check various status fields that might indicate completion
    const isComplete = track.status === 'complete' || 
                     track.status === 'completed' || 
                     track.status === 'SUCCESS' || 
                     track.status === 'success' ||
                     track.status === 'streaming' ||
                     (track.audio_url && track.audio_url.length > 0)
    
    if (isComplete && track.audio_url) {
      const result = await c.env.DB.prepare(
        "SELECT * FROM songs WHERE json_extract(metadata, '$.workId') = ?"
      ).bind(workId).first()
      
      if (result) {
        try {
          console.log('Downloading audio from:', track.audio_url)
          const audioResponse = await fetch(track.audio_url)
          const audioBlob = await audioResponse.blob()
          const audioKey = `songs/${result.id}.mp3`
          
          await c.env.R2.put(audioKey, audioBlob.stream(), {
            httpMetadata: { contentType: 'audio/mpeg' }
          })
          
          const metadata = JSON.parse(result.metadata as string || '{}')
          metadata.title = track.title || metadata.prompt
          metadata.duration = track.duration
          metadata.status = 'completed'
          metadata.audio_url = track.audio_url
          
          await c.env.DB.prepare(`
            UPDATE songs 
            SET name = ?, url = ?, metadata = ?, status = 'completed'
            WHERE id = ?
          `).bind(
            track.title || metadata.prompt || 'Untitled',
            `/files/${audioKey}`,
            JSON.stringify(metadata),
            result.id
          ).run()
          
          console.log('Song completed and updated:', result.id)
          
          return c.json({ 
            status: 'completed',
            track,
            songId: result.id 
          })
        } catch (error) {
          console.error('Error downloading audio:', error)
          return c.json({ 
            status: 'error',
            error: error.message
          })
        }
      } else {
        console.log('No song found in DB for workId:', workId)
      }
    }
  }
  
  // Still processing or no tracks found
  return c.json({ 
    status: 'processing',
    tracks: tracks.length,
    data,
    message: tracks.length === 0 ? 'No tracks found yet' : 'Still processing'
  })
})

// Manual refresh endpoint with better logging
app.post('/api/refresh-stuck-songs', async (c) => {
  // Find all songs stuck in generating status
  const stuckSongs = await c.env.DB.prepare(
    "SELECT * FROM songs WHERE status = 'generating'"
  ).all()
  
  console.log(`Found ${stuckSongs.results?.length || 0} stuck songs`)
  
  let updated = 0
  const errors = []
  
  for (const song of stuckSongs.results || []) {
    const metadata = JSON.parse(song.metadata as string || '{}')
    console.log(`Checking song ${song.id} with workId: ${metadata.workId}`)
    
    if (metadata.workId) {
      try {
        const response = await fetch(`https://udioapi.pro/api/v2/feed?workId=${metadata.workId}`, {
          headers: {
            'Authorization': `Bearer ${c.env.UDIOAPI_KEY}`
          }
        })
        
        const text = await response.text()
        let data
        try {
          data = JSON.parse(text)
        } catch (e) {
          console.error('Invalid JSON for workId', metadata.workId, ':', text)
          errors.push({ songId: song.id, error: 'Invalid JSON response' })
          continue
        }
        
        // Try different response structures
        let tracks = []
        if (data.data && Array.isArray(data.data)) {
          tracks = data.data
        } else if (data.data && data.data.response_data) {
          tracks = data.data.response_data
        } else if (data.response_data) {
          tracks = data.response_data
        } else if (Array.isArray(data)) {
          tracks = data
        }
        
        console.log(`WorkId ${metadata.workId}: found ${tracks.length} tracks`)
        
        for (const track of tracks) {
          const isComplete = track.status === 'complete' || 
                           track.status === 'completed' ||
                           track.status === 'SUCCESS' || 
                           track.status === 'success' ||
                           track.status === 'streaming' ||
                           (track.audio_url && track.audio_url.length > 0)
          
          if (isComplete && track.audio_url) {
            // Download and update
            const audioResponse = await fetch(track.audio_url)
            const audioBlob = await audioResponse.blob()
            const audioKey = `songs/${song.id}.mp3`
            
            await c.env.R2.put(audioKey, audioBlob.stream(), {
              httpMetadata: { contentType: 'audio/mpeg' }
            })
            
            await c.env.DB.prepare(`
              UPDATE songs 
              SET name = ?, url = ?, status = 'completed'
              WHERE id = ?
            `).bind(
              track.title || metadata.prompt || 'Untitled',
              `/files/${audioKey}`,
              song.id
            ).run()
            
            updated++
            console.log(`Updated song ${song.id}`)
            break
          }
        }
        
        if (tracks.length === 0) {
          errors.push({ songId: song.id, error: 'No tracks found', response: data })
        }
      } catch (error) {
        console.error(`Error updating song ${song.id}:`, error)
        errors.push({ songId: song.id, error: error.message })
      }
    }
  }
  
  return c.json({ 
    stuckSongs: stuckSongs.results?.length || 0,
    updated,
    errors
  })
})

// Other endpoints remain the same...
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
    httpMetadata: { contentType: 'audio/mpeg' }
  })
  
  await c.env.DB.prepare(`
    INSERT INTO songs (id, name, url, metadata, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    id,
    metadata.name || file.name,
    `/files/${key}`,
    JSON.stringify(metadata),
    new Date().toISOString()
  ).run()
  
  return c.json({ success: true, id, url: `/files/${key}` })
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

// Serve R2 files
app.get('/files/*', async (c) => {
  const key = c.req.param('*')
  const object = await c.env.R2.get(key)
  
  if (!object) {
    return c.text('Not Found', 404)
  }
  
  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('Cache-Control', 'public, max-age=3600')
  
  return c.body(object.body, { headers })
})

// Serve React app
app.get('*', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lofi Studio</title>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
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
</head>
<body>
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
      const [compilationArtist, setCompilationArtist] = useState('');
      const [playingSongId, setPlayingSongId] = useState(null);
      const audioRef = useRef(null);
      
      const fetchSongs = async () => {
        const res = await fetch('/api/songs');
        const data = await res.json();
        setSongs(data);
      };
      
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
        
        setIsGenerating(true);
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
            console.log('Generation started with workId:', data.workId);
            pollStatus(data.workId);
          } else {
            console.error('No workId in response:', data);
            alert('Failed to start generation: ' + (data.error || 'Unknown error'));
          }
          
          setPrompt('');
          setTitle('');
          setTags('');
        } catch (error) {
          alert('Error: ' + error.message);
        } finally {
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
            } else if (data.status === 'error') {
              console.error('Generation failed:', data);
              alert('Generation failed: ' + (data.error || 'Unknown error'));
            } else if (attempts < maxAttempts) {
              attempts++;
              setTimeout(checkStatus, 5000);
            } else {
              alert('Generation timed out. Please check your library or use Refresh Stuck.');
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
      
      const refreshStuckSongs = async () => {
        try {
          const res = await fetch('/api/refresh-stuck-songs', {
            method: 'POST'
          });
          const data = await res.json();
          console.log('Refresh result:', data);
          if (data.updated > 0) {
            alert(\`Updated \${data.updated} stuck songs!\`);
            fetchSongs();
          } else {
            alert(\`Found \${data.stuckSongs} stuck songs but couldn't update any. Check console for details.\`);
            if (data.errors) {
              console.error('Errors:', data.errors);
            }
          }
        } catch (error) {
          alert('Error refreshing: ' + error.message);
        }
      };
      
      const debugWorkId = async (workId) => {
        try {
          const res = await fetch(\`/api/debug-udio/\${workId}\`);
          const data = await res.json();
          console.log('Debug result for', workId, ':', data);
          alert('Check console for debug info');
        } catch (error) {
          alert('Debug error: ' + error.message);
        }
      };
      
      const generateArtwork = async () => {
        if (!artworkPrompt.trim()) return;
        
        setIsGeneratingArt(true);
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
          }
        } catch (error) {
          alert('Error: ' + error.message);
        } finally {
          setIsGeneratingArt(false);
        }
      };
      
      const createCompilation = async () => {
        if (!compilationName.trim() || selectedSongs.length === 0) {
          alert('Please select songs and enter a compilation name');
          return;
        }
        
        try {
          const res = await fetch('/api/compilations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: compilationName,
              artist: compilationArtist || 'Various Artists',
              songIds: selectedSongs,
              artworkId: selectedArtwork
            })
          });
          
          if (res.ok) {
            setCompilationName('');
            setCompilationArtist('');
            setSelectedSongs([]);
            setSelectedArtwork(null);
            fetchCompilations();
            alert('Compilation created successfully!');
          }
        } catch (error) {
          alert('Error: ' + error.message);
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
        }
      };
      
      const togglePlay = (songId, songUrl) => {
        if (playingSongId === songId) {
          // Stop playing
          if (audioRef.current) {
            audioRef.current.pause();
          }
          setPlayingSongId(null);
        } else {
          // Start playing new song
          if (audioRef.current) {
            audioRef.current.pause();
          }
          audioRef.current = new Audio(songUrl);
          audioRef.current.play();
          audioRef.current.onended = () => setPlayingSongId(null);
          setPlayingSongId(songId);
        }
      };
      
      return (
        <div className="min-h-screen bg-gray-900">
          <div className="container mx-auto px-4 py-8 max-w-7xl">
            <div className="text-center mb-8">
              <h1 className="text-5xl font-bold text-purple-500 mb-2">🎵 Lofi Studio</h1>
              <p className="text-gray-400">Create AI-powered lofi music compilations</p>
            </div>
            
            <div className="flex flex-wrap gap-2 mb-8 border-b border-gray-700 pb-4">
              {['music', 'artwork', 'compile', 'publish'].map((tab, idx) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={\`px-6 py-3 rounded-lg font-medium transition-all \${
                    activeTab === tab 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }\`}
                >
                  {idx + 1}. {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
            
            {activeTab === 'music' && (
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                    <span className="text-3xl">🎹</span> Generate Music
                  </h2>
                  <p className="text-gray-400 mb-6">
                    Create unique lofi beats using AI. Each track takes 1-3 minutes to generate.
                  </p>
                  
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={customMode}
                          onChange={(e) => setCustomMode(e.target.checked)}
                          className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm font-medium">Use Custom Mode (specify title and tags)</span>
                      </label>
                    </div>
                    
                    {!customMode ? (
                      <div>
                        <label className="block text-sm font-medium mb-2">Music Description (GPT Mode)</label>
                        <textarea
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          placeholder="e.g., lofi, jazzy, relaxing, calm, 90s hip hop, soft piano, rain sounds"
                          className="w-full px-4 py-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none resize-none"
                          rows="3"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Describe the vibe and instruments. AI will interpret this creatively. Works best with genre keywords.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-sm font-medium mb-2">Song Title</label>
                          <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g., Midnight Rain"
                            className="w-full px-4 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            The name of your track. This will appear in your library.
                          </p>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium mb-2">Music Description</label>
                          <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="e.g., chill lofi beat with soft piano and rain sounds"
                            className="w-full px-4 py-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none resize-none"
                            rows="3"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Detailed description of what you want. Be specific about mood, tempo, and instruments.
                          </p>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium mb-2">Tags</label>
                          <input
                            type="text"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            placeholder="e.g., lofi, chill, relax, study"
                            className="w-full px-4 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Style tags to guide the generation. Comma-separated.
                          </p>
                        </div>
                      </>
                    )}
                    
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={makeInstrumental}
                        onChange={(e) => setMakeInstrumental(e.target.checked)}
                        className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm">Make instrumental (no vocals)</span>
                    </label>
                    
                    <button
                      onClick={generateMusic}
                      disabled={isGenerating || (!prompt.trim() && !customMode) || (customMode && !title.trim())}
                      className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors"
                    >
                      {isGenerating ? '🎵 Generating...' : '✨ Generate Music'}
                    </button>
                  </div>
                </div>
                
                <div className="bg-gray-800 rounded-lg p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                      <span className="text-3xl">📚</span> Music Library
                    </h2>
                    <button
                      onClick={refreshStuckSongs}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
                    >
                      🔄 Refresh Stuck
                    </button>
                  </div>
                  <p className="text-gray-400 mb-4">
                    Check the boxes to select tracks for compilation. Click play to preview.
                  </p>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Upload your own track:</label>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(e) => e.target.files[0] && uploadFile(e.target.files[0])}
                      className="w-full px-4 py-2 bg-gray-700 rounded-lg border border-gray-600 text-sm"
                    />
                  </div>
                  
                  {songs.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No songs yet. Generate or upload some music!
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {songs.map(song => {
                        const metadata = typeof song.metadata === 'string' 
                          ? JSON.parse(song.metadata) 
                          : song.metadata || {};
                        const isGenerating = song.status === 'generating';
                        const isSelected = selectedSongs.includes(song.id);
                        const isPlaying = playingSongId === song.id;
                        
                        return (
                          <div key={song.id} className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSong(song.id)}
                              disabled={isGenerating}
                              className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-purple-600 focus:ring-purple-500"
                            />
                            
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate">{song.name}</h4>
                              {metadata.prompt && (
                                <p className="text-xs text-gray-400 truncate">{metadata.prompt}</p>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {isGenerating ? (
                                <span className="px-3 py-1 bg-yellow-600 text-yellow-100 text-xs rounded-full">
                                  ⏳ Generating
                                </span>
                              ) : (
                                <>
                                  <button
                                    onClick={() => togglePlay(song.id, song.url)}
                                    className="p-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
                                  >
                                    {isPlaying ? '⏸️' : '▶️'}
                                  </button>
                                  <a 
                                    href={song.url} 
                                    download 
                                    className="p-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
                                  >
                                    ⬇️
                                  </a>
                                </>
                              )}
                              {isGenerating && metadata.workId && (
                                <button
                                  onClick={() => debugWorkId(metadata.workId)}
                                  className="p-1 bg-gray-600 hover:bg-gray-500 rounded text-xs"
                                  title="Debug this workId"
                                >
                                  🐛
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {selectedSongs.length > 0 && (
                    <div className="mt-4 p-3 bg-green-900/30 text-green-400 rounded-lg text-sm">
                      ✅ {selectedSongs.length} tracks selected
                    </div>
                  )}
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