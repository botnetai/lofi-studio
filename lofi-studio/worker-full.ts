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
  const { prompt = 'lofi beat', custom_mode = false, ...params } = body
  
  const workId = crypto.randomUUID()
  const songId = crypto.randomUUID()
  
  // Create placeholder in DB immediately
  await c.env.DB.prepare(`
    INSERT INTO songs (id, name, url, metadata, created_at, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    songId,
    `Generating: ${prompt.substring(0, 50)}...`,
    '',
    JSON.stringify({ workId, prompt, status: 'generating' }),
    new Date().toISOString(),
    'generating'
  ).run()
  
  // Start generation with AI Music API
  const response = await fetch('https://api.aimusicapi.com/v1/api/sendRequest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api_key': c.env.UDIOAPI_KEY
    },
    body: JSON.stringify({
      api_key: c.env.UDIOAPI_KEY,
      custom_mode,
      prompt,
      make_instrumental: params.make_instrumental ?? false,
      model: params.model || "chirp-v3.5",
      wait_audio: false,
      ...params
    })
  })
  
  const data = await response.json()
  
  return c.json({ 
    success: true, 
    workId: data.workId || workId,
    songId
  })
})

app.get('/api/generate-music-status', async (c) => {
  const workId = c.req.query('workId')
  if (!workId) {
    return c.json({ error: 'Work ID required' }, 400)
  }
  
  const response = await fetch(`https://api.aimusicapi.com/v1/api/getRequest?api_key=${c.env.UDIOAPI_KEY}&workId=${workId}`)
  const data = await response.json()
  
  if (data.status === 'completed' && data.audio_url) {
    const result = await c.env.DB.prepare(
      "SELECT * FROM songs WHERE json_extract(metadata, '$.workId') = ?"
    ).bind(workId).first()
    
    if (result) {
      const audioResponse = await fetch(data.audio_url)
      const audioBlob = await audioResponse.blob()
      const audioKey = `songs/${result.id}.mp3`
      
      await c.env.R2.put(audioKey, audioBlob.stream(), {
        httpMetadata: { contentType: 'audio/mpeg' }
      })
      
      const metadata = JSON.parse(result.metadata as string || '{}')
      metadata.title = data.title || metadata.prompt
      metadata.duration = data.duration
      metadata.status = 'completed'
      
      await c.env.DB.prepare(`
        UPDATE songs 
        SET name = ?, url = ?, metadata = ?, status = 'completed'
        WHERE id = ?
      `).bind(
        data.title || 'Untitled',
        `/files/${audioKey}`,
        JSON.stringify(metadata),
        result.id
      ).run()
    }
  }
  
  return c.json(data)
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

// Serve React app with full functionality
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
            background: '#0a0a0a',
            foreground: '#fafafa',
            primary: '#8b5cf6',
            secondary: '#262626',
            border: '#262626',
            muted: '#737373'
          }
        }
      }
    }
  </script>
  <style>
    .tab-active { border-bottom-color: #8b5cf6; color: #8b5cf6; }
  </style>
</head>
<body class="bg-background text-foreground">
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useEffect } = React;
    
    function App() {
      const [activeTab, setActiveTab] = useState('music');
      const [songs, setSongs] = useState([]);
      const [selectedSongs, setSelectedSongs] = useState([]);
      const [artwork, setArtwork] = useState([]);
      const [compilations, setCompilations] = useState([]);
      const [prompt, setPrompt] = useState('');
      const [customMode, setCustomMode] = useState(false);
      const [lyrics, setLyrics] = useState('');
      const [isGenerating, setIsGenerating] = useState(false);
      const [artworkPrompt, setArtworkPrompt] = useState('');
      const [isGeneratingArt, setIsGeneratingArt] = useState(false);
      const [selectedArtwork, setSelectedArtwork] = useState(null);
      const [compilationName, setCompilationName] = useState('');
      
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
        if (!prompt.trim()) return;
        
        setIsGenerating(true);
        try {
          const res = await fetch('/api/generate-music', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              prompt,
              custom_mode: customMode,
              lyrics: customMode ? lyrics : undefined,
              make_instrumental: !customMode || !lyrics
            })
          });
          const data = await res.json();
          
          if (data.workId) {
            pollStatus(data.workId);
          }
          
          setPrompt('');
          setLyrics('');
        } catch (error) {
          alert('Error: ' + error.message);
        } finally {
          setIsGenerating(false);
        }
      };
      
      const pollStatus = async (workId) => {
        const checkStatus = async () => {
          const res = await fetch(\`/api/generate-music-status?workId=\${workId}\`);
          const data = await res.json();
          
          if (data.status === 'completed') {
            fetchSongs();
          } else if (data.status !== 'failed') {
            setTimeout(checkStatus, 3000);
          }
        };
        
        setTimeout(checkStatus, 3000);
      };
      
      const generateArtwork = async () => {
        if (!artworkPrompt.trim()) return;
        
        setIsGeneratingArt(true);
        try {
          const res = await fetch('/api/generate-artwork', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: artworkPrompt })
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
              songIds: selectedSongs,
              artworkId: selectedArtwork
            })
          });
          
          if (res.ok) {
            setCompilationName('');
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
      
      return (
        <div className="min-h-screen p-8">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-4xl font-bold mb-8 text-center">Lofi Studio</h1>
            
            <div className="flex gap-4 mb-8 border-b border-border">
              <button 
                onClick={() => setActiveTab('music')}
                className={\`px-4 py-2 border-b-2 \${activeTab === 'music' ? 'tab-active' : 'border-transparent'}\`}
              >
                Music
              </button>
              <button 
                onClick={() => setActiveTab('artwork')}
                className={\`px-4 py-2 border-b-2 \${activeTab === 'artwork' ? 'tab-active' : 'border-transparent'}\`}
              >
                Artwork
              </button>
              <button 
                onClick={() => setActiveTab('compile')}
                className={\`px-4 py-2 border-b-2 \${activeTab === 'compile' ? 'tab-active' : 'border-transparent'}\`}
              >
                Compile
              </button>
              <button 
                onClick={() => setActiveTab('publish')}
                className={\`px-4 py-2 border-b-2 \${activeTab === 'publish' ? 'tab-active' : 'border-transparent'}\`}
              >
                Publish
              </button>
            </div>
            
            {activeTab === 'music' && (
              <div className="space-y-8">
                <div className="bg-secondary rounded-lg p-6">
                  <h2 className="text-2xl font-bold mb-4">Generate Music</h2>
                  <div className="space-y-4">
                    <input
                      type="text"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="e.g., chill lofi beat with soft piano"
                      className="w-full px-4 py-2 rounded bg-background border border-border"
                    />
                    
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={customMode}
                        onChange={(e) => setCustomMode(e.target.checked)}
                        className="w-4 h-4"
                      />
                      <label>Add custom lyrics</label>
                    </div>
                    
                    {customMode && (
                      <textarea
                        value={lyrics}
                        onChange={(e) => setLyrics(e.target.value)}
                        placeholder="Enter your lyrics..."
                        className="w-full h-32 px-4 py-2 rounded bg-background border border-border"
                      />
                    )}
                    
                    <button
                      onClick={generateMusic}
                      disabled={isGenerating || !prompt.trim()}
                      className="w-full px-6 py-2 bg-primary text-white rounded hover:bg-purple-700 disabled:opacity-50"
                    >
                      {isGenerating ? 'Generating...' : 'Generate Music'}
                    </button>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-border">
                    <label className="block mb-2">Or upload a file:</label>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(e) => e.target.files[0] && uploadFile(e.target.files[0])}
                      className="text-sm"
                    />
                  </div>
                </div>
                
                <div className="bg-secondary rounded-lg p-6">
                  <h2 className="text-2xl font-bold mb-4">Music Library</h2>
                  {songs.length === 0 ? (
                    <p className="text-muted">No songs yet. Generate or upload some music!</p>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left pb-2 w-10"></th>
                          <th className="text-left pb-2">Title</th>
                          <th className="text-left pb-2">Status</th>
                          <th className="text-left pb-2">Created</th>
                          <th className="text-left pb-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {songs.map(song => {
                          const metadata = typeof song.metadata === 'string' 
                            ? JSON.parse(song.metadata) 
                            : song.metadata || {};
                          const isGenerating = song.status === 'generating';
                          const isSelected = selectedSongs.includes(song.id);
                          
                          return (
                            <tr key={song.id} className="border-b border-border/50">
                              <td className="py-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSong(song.id)}
                                  disabled={isGenerating}
                                />
                              </td>
                              <td className="py-3">
                                <div>
                                  <p className="font-medium">{song.name}</p>
                                  {metadata.prompt && (
                                    <p className="text-sm text-muted">{metadata.prompt}</p>
                                  )}
                                </div>
                              </td>
                              <td className="py-3">
                                <span className={\`px-2 py-1 rounded-full text-xs \${
                                  isGenerating ? 'bg-yellow-500/20 text-yellow-500' : 'bg-green-500/20 text-green-500'
                                }\`}>
                                  {isGenerating ? 'Generating...' : 'Complete'}
                                </span>
                              </td>
                              <td className="py-3 text-sm text-muted">
                                {new Date(song.created_at).toLocaleString()}
                              </td>
                              <td className="py-3">
                                {!isGenerating && song.url && (
                                  <a href={song.url} download className="text-primary hover:underline">
                                    Download
                                  </a>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
            
            {activeTab === 'artwork' && (
              <div className="space-y-8">
                <div className="bg-secondary rounded-lg p-6">
                  <h2 className="text-2xl font-bold mb-4">Generate Artwork</h2>
                  <div className="flex gap-4">
                    <input
                      type="text"
                      value={artworkPrompt}
                      onChange={(e) => setArtworkPrompt(e.target.value)}
                      placeholder="e.g., cozy bedroom with warm lighting and plants"
                      className="flex-1 px-4 py-2 rounded bg-background border border-border"
                    />
                    <button
                      onClick={generateArtwork}
                      disabled={isGeneratingArt || !artworkPrompt.trim()}
                      className="px-6 py-2 bg-primary text-white rounded hover:bg-purple-700 disabled:opacity-50"
                    >
                      {isGeneratingArt ? 'Generating...' : 'Generate Artwork'}
                    </button>
                  </div>
                  <p className="text-sm text-muted mt-2">Generates all 3 aspect ratios automatically</p>
                </div>
                
                <div className="bg-secondary rounded-lg p-6">
                  <h2 className="text-2xl font-bold mb-4">Artwork Gallery</h2>
                  {artwork.length === 0 ? (
                    <p className="text-muted">No artwork yet. Generate some!</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-4">
                      {artwork.map(art => (
                        <div 
                          key={art.id}
                          onClick={() => setSelectedArtwork(art.id)}
                          className={\`cursor-pointer rounded overflow-hidden border-2 \${
                            selectedArtwork === art.id ? 'border-primary' : 'border-transparent'
                          }\`}
                        >
                          <img 
                            src={\`/files/\${art.file_key}\`} 
                            alt={art.prompt}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {activeTab === 'compile' && (
              <div className="space-y-8">
                <div className="bg-secondary rounded-lg p-6">
                  <h2 className="text-2xl font-bold mb-4">Create Release</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block mb-2">Release Name</label>
                      <input
                        type="text"
                        value={compilationName}
                        onChange={(e) => setCompilationName(e.target.value)}
                        placeholder="e.g., Late Night Lofi Vol. 1"
                        className="w-full px-4 py-2 rounded bg-background border border-border"
                      />
                    </div>
                    
                    <div>
                      <label className="block mb-2">Selected Songs: {selectedSongs.length}</label>
                      {selectedSongs.length === 0 && (
                        <p className="text-sm text-muted">Go to Music tab to select songs</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block mb-2">Selected Artwork: {selectedArtwork ? '✓' : 'None'}</label>
                      {!selectedArtwork && (
                        <p className="text-sm text-muted">Go to Artwork tab to select artwork</p>
                      )}
                    </div>
                    
                    <button
                      onClick={createCompilation}
                      disabled={!compilationName.trim() || selectedSongs.length === 0}
                      className="w-full px-6 py-2 bg-primary text-white rounded hover:bg-purple-700 disabled:opacity-50"
                    >
                      Create Release
                    </button>
                  </div>
                </div>
                
                <div className="bg-secondary rounded-lg p-6">
                  <h2 className="text-2xl font-bold mb-4">Releases</h2>
                  {compilations.length === 0 ? (
                    <p className="text-muted">No releases yet. Create one!</p>
                  ) : (
                    <div className="space-y-4">
                      {compilations.map(comp => (
                        <div key={comp.id} className="border border-border rounded p-4">
                          <h3 className="font-bold">{comp.name}</h3>
                          <p className="text-sm text-muted">
                            {JSON.parse(comp.songs).length} songs • 
                            Created {new Date(comp.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {activeTab === 'publish' && (
              <div className="bg-secondary rounded-lg p-6">
                <h2 className="text-2xl font-bold mb-4">Publishing Options</h2>
                <div className="space-y-4">
                  <div className="border border-border rounded p-4">
                    <h3 className="font-bold mb-2">DistroKid</h3>
                    <p className="text-sm text-muted mb-3">Distribute to Spotify, Apple Music, and more</p>
                    <button className="px-4 py-2 bg-primary text-white rounded hover:bg-purple-700">
                      Export for DistroKid
                    </button>
                  </div>
                  
                  <div className="border border-border rounded p-4">
                    <h3 className="font-bold mb-2">YouTube</h3>
                    <p className="text-sm text-muted mb-3">Create visualizer video and upload</p>
                    <button className="px-4 py-2 bg-primary text-white rounded hover:bg-purple-700">
                      Generate YouTube Video
                    </button>
                  </div>
                  
                  <div className="border border-border rounded p-4">
                    <h3 className="font-bold mb-2">TikTok</h3>
                    <p className="text-sm text-muted mb-3">Create short preview clips</p>
                    <button className="px-4 py-2 bg-primary text-white rounded hover:bg-purple-700">
                      Generate TikTok Clips
                    </button>
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