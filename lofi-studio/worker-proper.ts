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

// API Routes
app.get('/api/songs', async (c) => {
  const songs = await c.env.DB.prepare('SELECT * FROM songs ORDER BY created_at DESC').all()
  return c.json(songs.results || [])
})

app.post('/api/generate-music', async (c) => {
  const body = await c.req.json()
  const { prompt = 'lofi beat', customMode = false, title, tags, make_instrumental = true } = body
  
  const workId = crypto.randomUUID()
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
    JSON.stringify({ workId, prompt, customMode, title, tags, status: 'generating' }),
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
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('AI Music API error:', errorText)
      return c.json({ 
        error: 'Failed to start generation',
        details: errorText 
      }, 500)
    }
    
    const data = await response.json()
    console.log('Generate response:', data)
    
    // Get the actual work ID from the response
    const actualWorkId = data.generation_id || data.id || data.workId || workId
    
    // Update with actual workId
    if (actualWorkId !== workId) {
      await c.env.DB.prepare(`
        UPDATE songs 
        SET metadata = json_set(metadata, '$.workId', ?)
        WHERE id = ?
      `).bind(actualWorkId, songId).run()
    }
    
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
  
  const response = await fetch(`https://udioapi.pro/api/v2/get-generation/${workId}`, {
    headers: {
      'Authorization': `Bearer ${c.env.UDIOAPI_KEY}`
    }
  })
  const data = await response.json()
  
  console.log('Status check response:', data)
  
  // Check if generation is complete
  if (data.generations && data.generations.length > 0) {
    const generation = data.generations[0]
    
    if (generation.status === 'complete' && generation.audio_url) {
      const result = await c.env.DB.prepare(
        "SELECT * FROM songs WHERE json_extract(metadata, '$.workId') = ?"
      ).bind(workId).first()
      
      if (result) {
        try {
          const audioResponse = await fetch(generation.audio_url)
          const audioBlob = await audioResponse.blob()
          const audioKey = `songs/${result.id}.mp3`
          
          await c.env.R2.put(audioKey, audioBlob.stream(), {
            httpMetadata: { contentType: 'audio/mpeg' }
          })
          
          const metadata = JSON.parse(result.metadata as string || '{}')
          metadata.title = generation.title || metadata.prompt
          metadata.duration = generation.duration
          metadata.status = 'completed'
          metadata.audio_url = generation.audio_url
          
          await c.env.DB.prepare(`
            UPDATE songs 
            SET name = ?, url = ?, metadata = ?, status = 'completed'
            WHERE id = ?
          `).bind(
            generation.title || metadata.prompt || 'Untitled',
            `/files/${audioKey}`,
            JSON.stringify(metadata),
            result.id
          ).run()
          
          return c.json({ 
            status: 'completed',
            generation,
            songId: result.id 
          })
        } catch (error) {
          console.error('Error downloading audio:', error)
        }
      }
    }
    
    return c.json({ 
      status: generation.status || 'processing',
      generation 
    })
  }
  
  return c.json({ 
    status: 'processing',
    data 
  })
})

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

// Debug endpoint to check work status
app.get('/api/debug-work/:workId', async (c) => {
  const workId = c.req.param('workId')
  
  // Check DB
  const dbResult = await c.env.DB.prepare(
    "SELECT * FROM songs WHERE json_extract(metadata, '$.workId') = ?"
  ).bind(workId).first()
  
  // Check API status
  let apiStatus = null
  try {
    const response = await fetch(`https://udioapi.pro/api/v2/get-generation/${workId}`, {
      headers: {
        'Authorization': `Bearer ${c.env.UDIOAPI_KEY}`
      }
    })
    apiStatus = await response.json()
  } catch (error) {
    apiStatus = { error: error.message }
  }
  
  return c.json({
    workId,
    dbRecord: dbResult,
    apiStatus
  })
})

// Manual refresh endpoint
app.post('/api/refresh-stuck-songs', async (c) => {
  // Find all songs stuck in generating status
  const stuckSongs = await c.env.DB.prepare(
    "SELECT * FROM songs WHERE status = 'generating'"
  ).all()
  
  let updated = 0
  
  for (const song of stuckSongs.results || []) {
    const metadata = JSON.parse(song.metadata as string || '{}')
    if (metadata.workId) {
      try {
        const response = await fetch(`https://udioapi.pro/api/v2/get-generation/${metadata.workId}`, {
          headers: {
            'Authorization': `Bearer ${c.env.UDIOAPI_KEY}`
          }
        })
        const data = await response.json()
        
        if (data.generations && data.generations.length > 0) {
          const generation = data.generations[0]
          if (generation.status === 'complete' && generation.audio_url) {
            // Download and update
            const audioResponse = await fetch(generation.audio_url)
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
              generation.title || metadata.prompt || 'Untitled',
              `/files/${audioKey}`,
              song.id
            ).run()
            
            updated++
          }
        }
      } catch (error) {
        console.error(`Error updating song ${song.id}:`, error)
      }
    }
  }
  
  return c.json({ 
    stuckSongs: stuckSongs.results?.length || 0,
    updated 
  })
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

// Serve React app with proper styling
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
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            gray: {
              900: '#0a0a0a',
              800: '#171717',
              700: '#262626',
              600: '#404040',
              500: '#737373',
              400: '#a3a3a3',
              300: '#d4d4d4',
              200: '#e5e5e5',
              100: '#f5f5f5',
            }
          }
        }
      }
    }
  </script>
</head>
<body class="bg-gray-900 text-gray-100">
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useEffect, useRef } = React;
    
    function App() {
      const [activeTab, setActiveTab] = useState('music');
      const [songs, setSongs] = useState([]);
      const [selectedSongs, setSelectedSongs] = useState([]);
      const [artwork, setArtwork] = useState([]);
      const [compilations, setCompilations] = useState([]);
      
      // Music generation state
      const [prompt, setPrompt] = useState('');
      const [customMode, setCustomMode] = useState(false);
      const [title, setTitle] = useState('');
      const [tags, setTags] = useState('');
      const [makeInstrumental, setMakeInstrumental] = useState(true);
      const [isGenerating, setIsGenerating] = useState(false);
      
      // Artwork state
      const [artworkPrompt, setArtworkPrompt] = useState('');
      const [artworkModel, setArtworkModel] = useState('flux-pro');
      const [isGeneratingArt, setIsGeneratingArt] = useState(false);
      const [selectedArtwork, setSelectedArtwork] = useState(null);
      
      // Compilation state
      const [compilationName, setCompilationName] = useState('');
      const [compilationArtist, setCompilationArtist] = useState('');
      
      // Audio playback
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
        
        // Check for updates every 10 seconds
        const interval = setInterval(() => {
          fetchSongs();
          if (activeTab === 'artwork') fetchArtwork();
          if (activeTab === 'compile') fetchCompilations();
        }, 10000);
        
        return () => clearInterval(interval);
      }, [activeTab]);
      
      const generateMusic = async () => {
        if (!prompt.trim() && !customMode) return;
        if (customMode && !title.trim()) return;
        
        setIsGenerating(true);
        try {
          const params = {
            prompt,
            customMode,
            make_instrumental: makeInstrumental
          };
          
          if (customMode) {
            params.title = title;
            params.tags = tags;
          }
          
          const res = await fetch('/api/generate-music', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
          });
          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Failed to generate music');
          }
          
          const data = await res.json();
          
          if (data.workId) {
            pollStatus(data.workId);
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
        // Just check once after 30 seconds
        setTimeout(async () => {
          try {
            const res = await fetch(\`/api/generate-music-status?workId=\${workId}\`);
            const data = await res.json();
            fetchSongs(); // Just refresh the list regardless
          } catch (error) {
            console.error('Status check error:', error);
          }
        }, 30000); // 30 seconds
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
                      disabled={isGenerating || (!customMode && !prompt.trim()) || (customMode && !title.trim())}
                      className={\`w-full py-3 rounded-lg font-medium transition-all \${
                        isGenerating || (!customMode && !prompt.trim()) || (customMode && !title.trim())
                          ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                          : 'bg-purple-600 hover:bg-purple-700 text-white'
                      }\`}
                    >
                      {isGenerating ? '🎵 Generating...' : '✨ Generate Music'}
                    </button>
                    
                  </div>
                </div>
                
                <div className="bg-gray-800 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                        <span className="text-3xl">📚</span> Music Library
                      </h2>
                      <p className="text-gray-400">
                        Your generated and uploaded tracks. Check the boxes to select tracks for your compilation.
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        const res = await fetch('/api/refresh-stuck-songs', { method: 'POST' });
                        const data = await res.json();
                        if (data.updated > 0) {
                          alert(\`Updated \${data.updated} stuck songs\`);
                        }
                        fetchSongs();
                      }}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
                    >
                      🔄 Refresh Stuck
                    </button>
                  </div>
                  
                  <div className="mb-4 p-4 bg-gray-700/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Upload Your Own Track</span>
                    </div>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(e) => e.target.files[0] && uploadFile(e.target.files[0])}
                      className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-600 file:text-gray-300 hover:file:bg-gray-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Upload MP3 files to include in your library
                    </p>
                  </div>
                  
                  {songs.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <p className="text-6xl mb-4">🎵</p>
                      <p>No songs yet. Generate or upload some music to get started!</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[600px] overflow-y-auto">
                      {songs.map(song => {
                        const metadata = typeof song.metadata === 'string' 
                          ? JSON.parse(song.metadata) 
                          : song.metadata || {};
                        const isGenerating = song.status === 'generating';
                        const isSelected = selectedSongs.includes(song.id);
                        
                        return (
                          <div 
                            key={song.id} 
                            className={\`p-4 rounded-lg border transition-all cursor-pointer \${
                              isSelected 
                                ? 'bg-purple-600/20 border-purple-600' 
                                : 'bg-gray-700/50 border-gray-700 hover:border-gray-600'
                            }\`}
                            onClick={() => !isGenerating && toggleSong(song.id)}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                disabled={isGenerating}
                                className="mt-1 w-5 h-5 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div className="flex-1">
                                <h3 className="font-medium">{song.name}</h3>
                                {metadata.prompt && (
                                  <p className="text-sm text-gray-500 mt-1">{metadata.prompt}</p>
                                )}
                                {isGenerating && metadata.workId && (
                                  <p className="text-xs text-gray-600 mt-1">Work ID: {metadata.workId}</p>
                                )}
                                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                  <span className={\`px-2 py-1 rounded-full \${
                                    isGenerating 
                                      ? 'bg-yellow-500/20 text-yellow-400' 
                                      : 'bg-green-500/20 text-green-400'
                                  }\`}>
                                    {isGenerating ? '⏳ Generating' : '✅ Ready'}
                                  </span>
                                  {metadata.duration && (
                                    <span>{Math.floor(metadata.duration / 60)}:{(metadata.duration % 60).toString().padStart(2, '0')}</span>
                                  )}
                                  <span>{new Date(song.created_at).toLocaleDateString()}</span>
                                </div>
                              </div>
                              {!isGenerating && song.url && (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      togglePlay(song.id, song.url);
                                    }}
                                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
                                  >
                                    {playingSongId === song.id ? '⏸️' : '▶️'}
                                  </button>
                                  <a 
                                    href={song.url} 
                                    download 
                                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    ⬇️
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {selectedSongs.length > 0 && (
                    <div className="mt-4 p-3 bg-purple-600/20 rounded-lg text-purple-400 text-sm">
                      <p className="font-medium">✅ {selectedSongs.length} tracks selected for compilation</p>
                      <p className="text-xs mt-1 opacity-80">
                        Selected tracks will be included when you create a release in the Compile tab
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {activeTab === 'artwork' && (
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                    <span className="text-3xl">🎨</span> Generate Artwork
                  </h2>
                  <p className="text-gray-400 mb-6">
                    Create album artwork in all aspect ratios automatically. Perfect for streaming platforms and social media.
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Artwork Description</label>
                      <textarea
                        value={artworkPrompt}
                        onChange={(e) => setArtworkPrompt(e.target.value)}
                        placeholder="e.g., cozy bedroom at night, warm lamp lighting, plants on windowsill, vintage record player, rain on window"
                        className="w-full px-4 py-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none resize-none"
                        rows="4"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Include details about mood, colors, lighting, and specific objects
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Model</label>
                      <select 
                        value={artworkModel}
                        onChange={(e) => setArtworkModel(e.target.value)}
                        className="w-full px-4 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                      >
                        <option value="flux-pro">Flux Pro (Best quality)</option>
                        <option value="flux-dev">Flux Dev (Faster)</option>
                        <option value="flux-schnell">Flux Schnell (Fastest)</option>
                      </select>
                    </div>
                    
                    <div className="p-4 bg-gray-700/50 rounded-lg">
                      <h4 className="font-medium mb-2">Automatically generates:</h4>
                      <div className="grid grid-cols-3 gap-2 text-sm text-gray-400">
                        <div className="text-center">
                          <div className="w-full aspect-square bg-gray-600 rounded mb-1"></div>
                          <span>1:1 Album</span>
                        </div>
                        <div className="text-center">
                          <div className="w-full aspect-video bg-gray-600 rounded mb-1"></div>
                          <span>16:9 YouTube</span>
                        </div>
                        <div className="text-center">
                          <div className="w-full aspect-[9/16] bg-gray-600 rounded mb-1"></div>
                          <span>9:16 TikTok</span>
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={generateArtwork}
                      disabled={isGeneratingArt || !artworkPrompt.trim()}
                      className={\`w-full py-3 rounded-lg font-medium transition-all \${
                        isGeneratingArt || !artworkPrompt.trim()
                          ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                          : 'bg-purple-600 hover:bg-purple-700 text-white'
                      }\`}
                    >
                      {isGeneratingArt ? '🎨 Creating...' : '✨ Generate Artwork'}
                    </button>
                    
                    <div className="p-4 bg-blue-600/20 rounded-lg text-blue-400 text-sm">
                      💡 <strong>Pro tip:</strong> Mention "lofi aesthetic", "anime style", or "Studio Ghibli inspired" for authentic vibes
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                    <span className="text-3xl">🖼️</span> Artwork Gallery
                  </h2>
                  <p className="text-gray-400 mb-6">
                    Click to select artwork for your compilation
                  </p>
                  
                  {artwork.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <p className="text-6xl mb-4">🎨</p>
                      <p>No artwork yet. Generate some visuals to get started!</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 max-h-[600px] overflow-y-auto">
                      {artwork.map(art => (
                        <div 
                          key={art.id}
                          onClick={() => setSelectedArtwork(art.id)}
                          className={\`rounded-lg overflow-hidden border-2 transition-all cursor-pointer \${
                            selectedArtwork === art.id 
                              ? 'border-purple-600 ring-4 ring-purple-600/30' 
                              : 'border-gray-700 hover:border-gray-600'
                          }\`}
                        >
                          <img 
                            src={\`/files/\${art.file_key}\`} 
                            alt={art.prompt}
                            className="w-full h-48 object-cover"
                          />
                          <div className="p-3 bg-gray-700/50">
                            <p className="text-xs text-gray-400 line-clamp-2">{art.prompt}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {selectedArtwork && (
                    <div className="mt-4 p-3 bg-purple-600/20 rounded-lg text-purple-400 text-sm">
                      ✅ Artwork selected
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {activeTab === 'compile' && (
              <div className="max-w-4xl mx-auto">
                <div className="bg-gray-800 rounded-lg p-6 mb-6">
                  <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                    <span className="text-3xl">📀</span> Create Release
                  </h2>
                  <p className="text-gray-400 mb-6">
                    Combine your selected tracks and artwork into a release ready for distribution
                  </p>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Release Name</label>
                        <input
                          type="text"
                          value={compilationName}
                          onChange={(e) => setCompilationName(e.target.value)}
                          placeholder="e.g., Late Night Lofi Vol. 1"
                          className="w-full px-4 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-2">Artist Name</label>
                        <input
                          type="text"
                          value={compilationArtist}
                          onChange={(e) => setCompilationArtist(e.target.value)}
                          placeholder="e.g., Your Artist Name (optional)"
                          className="w-full px-4 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="p-4 bg-gray-700/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">🎵 Selected Tracks</span>
                          <span className="text-2xl font-bold text-purple-500">{selectedSongs.length}</span>
                        </div>
                        {selectedSongs.length === 0 && (
                          <p className="text-sm text-gray-500">Go to Music tab to select tracks</p>
                        )}
                      </div>
                      
                      <div className="p-4 bg-gray-700/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">🎨 Artwork</span>
                          <span className="text-sm text-purple-500">{selectedArtwork ? 'Selected' : 'None'}</span>
                        </div>
                        {!selectedArtwork && (
                          <p className="text-sm text-gray-500">Go to Artwork tab to select artwork</p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={createCompilation}
                    disabled={!compilationName.trim() || selectedSongs.length === 0}
                    className={\`w-full mt-6 py-3 rounded-lg font-medium transition-all \${
                      !compilationName.trim() || selectedSongs.length === 0
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : 'bg-purple-600 hover:bg-purple-700 text-white'
                    }\`}
                  >
                    📦 Create Release
                  </button>
                </div>
                
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-xl font-bold mb-4">Your Releases</h3>
                  {compilations.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No releases yet. Create your first one!</p>
                  ) : (
                    <div className="space-y-3">
                      {compilations.map(comp => (
                        <div key={comp.id} className="p-4 bg-gray-700/50 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium text-lg">{comp.name}</h4>
                              <p className="text-sm text-gray-400">
                                {JSON.parse(comp.songs).length} tracks • 
                                Created {new Date(comp.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <span className="px-3 py-1 bg-green-600/20 text-green-400 rounded-full text-sm">
                              Ready
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {activeTab === 'publish' && (
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                    <span className="text-3xl">🚀</span> Publishing Options
                  </h2>
                  <p className="text-gray-400">
                    Distribute your lofi compilation to major platforms
                  </p>
                </div>
                
                <div className="bg-gray-800 rounded-lg p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <span className="text-4xl">🎵</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xl font-bold">DistroKid</h3>
                        <span className="px-2 py-1 bg-green-600/20 text-green-400 rounded text-xs">Recommended</span>
                      </div>
                      <p className="text-gray-400 mb-4">
                        Distribute to Spotify, Apple Music, YouTube Music, and 150+ streaming services. 
                        Keep 100% of your royalties.
                      </p>
                      <div className="grid md:grid-cols-2 gap-3 mb-4 text-sm">
                        <div className="flex items-start gap-2">
                          <span className="text-green-400">✓</span>
                          <span>One-time upload to all platforms</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-green-400">✓</span>
                          <span>Spotify verified artist profile</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-green-400">✓</span>
                          <span>Collect streaming royalties</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-green-400">✓</span>
                          <span>YouTube Content ID monetization</span>
                        </div>
                      </div>
                      <button className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium">
                        📤 Export for DistroKid
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-800 rounded-lg p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <span className="text-4xl">📺</span>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold mb-2">YouTube</h3>
                      <p className="text-gray-400 mb-4">
                        Create a visualizer video with your artwork and upload directly to YouTube.
                      </p>
                      <div className="p-4 bg-yellow-600/20 rounded-lg text-yellow-400 mb-4">
                        <strong>💰 Monetization tip:</strong> Individual video uploads generate more revenue than streaming. 
                        Upload as separate videos (not live streams) to enable ads and get higher CPM rates.
                      </div>
                      <button className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium">
                        🎬 Generate YouTube Video
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-800 rounded-lg p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <span className="text-4xl">📱</span>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold mb-2">TikTok / Reels / Shorts</h3>
                      <p className="text-gray-400 mb-4">
                        Create short preview clips perfect for viral social media content.
                      </p>
                      <div className="grid md:grid-cols-3 gap-3 mb-4 text-sm">
                        <div className="p-3 bg-gray-700/50 rounded text-center">
                          <div className="text-2xl mb-1">15s</div>
                          <div className="text-gray-400">Quick preview</div>
                        </div>
                        <div className="p-3 bg-gray-700/50 rounded text-center">
                          <div className="text-2xl mb-1">30s</div>
                          <div className="text-gray-400">Standard clip</div>
                        </div>
                        <div className="p-3 bg-gray-700/50 rounded text-center">
                          <div className="text-2xl mb-1">60s</div>
                          <div className="text-gray-400">Full preview</div>
                        </div>
                      </div>
                      <button className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium">
                        ✂️ Generate Short Clips
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