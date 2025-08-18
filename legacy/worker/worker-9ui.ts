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

// Serve React app with 9ui
app.get('*', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lofi Studio</title>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    /* Custom properties for theming */
    :root {
      --primary-color: #8b5cf6;
    }
    
    /* Dark mode is 9ui default, light mode needs overrides */
    body.light-mode {
      background-color: #ffffff;
      color: #000000;
    }
    
    body.light-mode .navbar {
      background-color: #f8f9fa !important;
      border-bottom: 1px solid #dee2e6;
    }
    
    body.light-mode .navbar-dark {
      background-color: #f8f9fa !important;
    }
    
    body.light-mode .navbar-dark .navbar-brand,
    body.light-mode .navbar-dark .nav-link {
      color: #333 !important;
    }
    
    body.light-mode .navbar-dark .nav-link:hover {
      color: var(--primary-color) !important;
    }
    
    body.light-mode .card {
      background-color: #ffffff;
      border-color: #dee2e6;
    }
    
    body.light-mode .btn-outline-light {
      color: #212529;
      border-color: #212529;
    }
    
    body.light-mode .btn-outline-light:hover {
      background-color: #212529;
      color: #ffffff;
    }
    
    body.light-mode .table {
      color: #000000;
    }
    
    body.light-mode .badge-warning {
      background-color: #ffc107;
      color: #000;
    }
    
    body.light-mode .badge-success {
      background-color: #28a745;
      color: #fff;
    }
    
    /* Additional utility classes */
    .navbar-brand {
      color: var(--primary-color) !important;
      font-weight: bold;
    }
    
    .nav-tabs .nav-link.active {
      color: var(--primary-color);
      border-bottom: 3px solid var(--primary-color);
    }
    
    .auth-buttons {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }
    
    .theme-toggle {
      font-size: 1.2rem;
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 0.25rem 0.5rem;
    }
    
    .aspect-ratio-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 1rem;
    }
    
    .song-row:hover {
      background: rgba(139, 92, 246, 0.1);
    }
    
    .selected-artwork {
      border: 3px solid var(--primary-color);
      transform: scale(1.05);
    }
    
    @media (max-width: 768px) {
      .aspect-ratio-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
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
      const [isDarkMode, setIsDarkMode] = useState(true);
      
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
      
      useEffect(() => {
        if (isDarkMode) {
          document.body.classList.remove('light-mode');
        } else {
          document.body.classList.add('light-mode');
        }
      }, [isDarkMode]);
      
      const toggleTheme = () => {
        setIsDarkMode(!isDarkMode);
      };
      
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
        <>
          <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
            <div className="container-fluid">
              <a className="navbar-brand" href="/">🎵 Lofi Studio</a>
              <div className="navbar-nav me-auto">
                <ul className="nav nav-tabs">
                  <li className="nav-item">
                    <a 
                      className={\`nav-link \${activeTab === 'music' ? 'active' : ''}\`}
                      href="#"
                      onClick={(e) => { e.preventDefault(); setActiveTab('music'); }}
                    >
                      Music
                    </a>
                  </li>
                  <li className="nav-item">
                    <a 
                      className={\`nav-link \${activeTab === 'artwork' ? 'active' : ''}\`}
                      href="#"
                      onClick={(e) => { e.preventDefault(); setActiveTab('artwork'); }}
                    >
                      Artwork
                    </a>
                  </li>
                  <li className="nav-item">
                    <a 
                      className={\`nav-link \${activeTab === 'compile' ? 'active' : ''}\`}
                      href="#"
                      onClick={(e) => { e.preventDefault(); setActiveTab('compile'); }}
                    >
                      Compile
                    </a>
                  </li>
                  <li className="nav-item">
                    <a 
                      className={\`nav-link \${activeTab === 'publish' ? 'active' : ''}\`}
                      href="#"
                      onClick={(e) => { e.preventDefault(); setActiveTab('publish'); }}
                    >
                      Publish
                    </a>
                  </li>
                </ul>
              </div>
              <div className="auth-buttons">
                <button 
                  className="theme-toggle"
                  onClick={toggleTheme}
                  title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
                >
                  {isDarkMode ? '☀️' : '🌙'}
                </button>
                <button className="btn btn-outline-light btn-sm">Log In</button>
                <button className="btn btn-primary btn-sm">Sign Up</button>
              </div>
            </div>
          </nav>
          
          <div className="container-fluid mt-4">
          
          {activeTab === 'music' && (
            <div className="row">
              <div className="col-lg-6 mb-4">
                <div className="card">
                  <div className="card-body">
                    <h2 className="card-title mb-4">🎹 Generate Music</h2>
                    <p className="text-muted mb-4">
                      Create unique lofi beats using AI. Each track takes 1-3 minutes to generate.
                    </p>
                    
                    <div className="form-group mb-3">
                      <label htmlFor="prompt">Music Description</label>
                      <input
                        id="prompt"
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., chill lofi beat with soft piano and rain sounds"
                        className="form-control"
                      />
                      <small className="form-text text-muted">
                        Describe the mood, instruments, and style you want
                      </small>
                    </div>
                    
                    <div className="form-check mb-3">
                      <input
                        type="checkbox"
                        id="customMode"
                        checked={customMode}
                        onChange={(e) => setCustomMode(e.target.checked)}
                        className="form-check-input"
                      />
                      <label htmlFor="customMode" className="form-check-label">
                        Add custom lyrics (vocals)
                      </label>
                    </div>
                    
                    {customMode && (
                      <div className="form-group mb-3">
                        <label htmlFor="lyrics">Lyrics</label>
                        <textarea
                          id="lyrics"
                          value={lyrics}
                          onChange={(e) => setLyrics(e.target.value)}
                          placeholder="Enter your lyrics here..."
                          className="form-control"
                          rows="4"
                        />
                      </div>
                    )}
                    
                    <button
                      onClick={generateMusic}
                      disabled={isGenerating || !prompt.trim()}
                      className="btn btn-primary btn-block w-100"
                    >
                      {isGenerating ? '🎵 Generating...' : '✨ Generate Music'}
                    </button>
                    
                    <hr className="my-4" />
                    
                    <div className="form-group">
                      <label>Or upload your own track:</label>
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={(e) => e.target.files[0] && uploadFile(e.target.files[0])}
                        className="form-control-file"
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="col-lg-6 mb-4">
                <div className="card">
                  <div className="card-body">
                    <h2 className="card-title mb-4">📚 Music Library</h2>
                    <p className="text-muted mb-4">
                      Select tracks to include in your compilation. Check the boxes to select multiple tracks.
                    </p>
                    
                    {songs.length === 0 ? (
                      <div className="alert alert-info">
                        No songs yet. Generate or upload some music to get started!
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <table className="table">
                          <thead>
                            <tr>
                              <th width="40"></th>
                              <th>Title</th>
                              <th>Status</th>
                              <th>Actions</th>
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
                                <tr key={song.id} className="song-row">
                                  <td>
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleSong(song.id)}
                                      disabled={isGenerating}
                                      className="form-check-input"
                                    />
                                  </td>
                                  <td>
                                    <div>
                                      <strong>{song.name}</strong>
                                      {metadata.prompt && (
                                        <div className="small text-muted">{metadata.prompt}</div>
                                      )}
                                    </div>
                                  </td>
                                  <td>
                                    <span className={\`badge \${
                                      isGenerating ? 'badge-warning' : 'badge-success'
                                    }\`}>
                                      {isGenerating ? '⏳ Generating' : '✅ Ready'}
                                    </span>
                                  </td>
                                  <td>
                                    {!isGenerating && song.url && (
                                      <a href={song.url} download className="btn btn-sm btn-outline-primary">
                                        ⬇️ Download
                                      </a>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                    
                    {selectedSongs.length > 0 && (
                      <div className="alert alert-success mt-3">
                        ✅ {selectedSongs.length} tracks selected
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'artwork' && (
            <div className="row">
              <div className="col-lg-6 mb-4">
                <div className="card">
                  <div className="card-body">
                    <h2 className="card-title mb-4">🎨 Generate Artwork</h2>
                    <p className="text-muted mb-4">
                      Create album artwork in all aspect ratios automatically. Perfect for streaming platforms and social media.
                    </p>
                    
                    <div className="form-group mb-3">
                      <label htmlFor="artworkPrompt">Artwork Description</label>
                      <input
                        id="artworkPrompt"
                        type="text"
                        value={artworkPrompt}
                        onChange={(e) => setArtworkPrompt(e.target.value)}
                        placeholder="e.g., cozy bedroom with warm lighting, plants, and vintage record player"
                        className="form-control"
                      />
                      <small className="form-text text-muted">
                        Generates 1:1 (album), 16:9 (YouTube), and 9:16 (TikTok/Shorts) automatically
                      </small>
                    </div>
                    
                    <button
                      onClick={generateArtwork}
                      disabled={isGeneratingArt || !artworkPrompt.trim()}
                      className="btn btn-primary btn-block w-100"
                    >
                      {isGeneratingArt ? '🎨 Creating...' : '✨ Generate Artwork'}
                    </button>
                    
                    <div className="alert alert-info mt-3">
                      <strong>💡 Pro tip:</strong> Include details about mood, colors, and specific objects for best results
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="col-lg-6 mb-4">
                <div className="card">
                  <div className="card-body">
                    <h2 className="card-title mb-4">🖼️ Artwork Gallery</h2>
                    <p className="text-muted mb-4">
                      Click to select artwork for your compilation
                    </p>
                    
                    {artwork.length === 0 ? (
                      <div className="alert alert-info">
                        No artwork yet. Generate some visuals to get started!
                      </div>
                    ) : (
                      <div className="aspect-ratio-grid">
                        {artwork.map(art => (
                          <div 
                            key={art.id}
                            onClick={() => setSelectedArtwork(art.id)}
                            className={\`card cursor-pointer \${
                              selectedArtwork === art.id ? 'selected-artwork' : ''
                            }\`}
                            style={{ cursor: 'pointer', transition: 'all 0.3s' }}
                          >
                            <img 
                              src={\`/files/\${art.file_key}\`} 
                              alt={art.prompt}
                              className="card-img-top"
                              style={{ height: '200px', objectFit: 'cover' }}
                            />
                            <div className="card-body p-2">
                              <small className="text-muted">{art.prompt}</small>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {selectedArtwork && (
                      <div className="alert alert-success mt-3">
                        ✅ Artwork selected
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'compile' && (
            <div className="row">
              <div className="col-lg-8 mx-auto">
                <div className="card">
                  <div className="card-body">
                    <h2 className="card-title mb-4">📀 Create Release</h2>
                    <p className="text-muted mb-4">
                      Combine your selected tracks and artwork into a release ready for distribution
                    </p>
                    
                    <div className="form-group mb-3">
                      <label htmlFor="compilationName">Release Name</label>
                      <input
                        id="compilationName"
                        type="text"
                        value={compilationName}
                        onChange={(e) => setCompilationName(e.target.value)}
                        placeholder="e.g., Late Night Lofi Vol. 1"
                        className="form-control"
                      />
                    </div>
                    
                    <div className="row mb-3">
                      <div className="col-md-6">
                        <div className="alert alert-light">
                          <strong>🎵 Selected Tracks:</strong> {selectedSongs.length}
                          {selectedSongs.length === 0 && (
                            <div className="small text-muted mt-1">Go to Music tab to select tracks</div>
                          )}
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="alert alert-light">
                          <strong>🎨 Selected Artwork:</strong> {selectedArtwork ? '✓' : 'None'}
                          {!selectedArtwork && (
                            <div className="small text-muted mt-1">Go to Artwork tab to select artwork</div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={createCompilation}
                      disabled={!compilationName.trim() || selectedSongs.length === 0}
                      className="btn btn-primary btn-block w-100"
                    >
                      📦 Create Release
                    </button>
                    
                    <hr className="my-4" />
                    
                    <h3>Your Releases</h3>
                    {compilations.length === 0 ? (
                      <p className="text-muted">No releases yet. Create your first one!</p>
                    ) : (
                      <div className="list-group">
                        {compilations.map(comp => (
                          <div key={comp.id} className="list-group-item">
                            <div className="d-flex justify-content-between align-items-center">
                              <div>
                                <h5 className="mb-1">{comp.name}</h5>
                                <p className="mb-0 text-muted">
                                  {JSON.parse(comp.songs).length} tracks • 
                                  Created {new Date(comp.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <span className="badge badge-primary badge-pill">Ready</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'publish' && (
            <div className="row">
              <div className="col-lg-8 mx-auto">
                <div className="card mb-4">
                  <div className="card-body">
                    <h2 className="card-title mb-4">🚀 Publishing Options</h2>
                    <p className="text-muted">
                      Distribute your lofi compilation to major platforms
                    </p>
                  </div>
                </div>
                
                <div className="card mb-3">
                  <div className="card-body">
                    <div className="d-flex align-items-center mb-3">
                      <h3 className="mb-0">🎵 DistroKid</h3>
                      <span className="badge badge-success ml-2">Recommended</span>
                    </div>
                    <p className="text-muted mb-3">
                      Distribute to Spotify, Apple Music, YouTube Music, and 150+ streaming services. 
                      Keep 100% of your royalties.
                    </p>
                    <ul className="mb-3">
                      <li>One-time upload to all platforms</li>
                      <li>Spotify verified artist profile</li>
                      <li>Collect streaming royalties</li>
                      <li>YouTube Content ID monetization</li>
                    </ul>
                    <button className="btn btn-primary">
                      📤 Export for DistroKid
                    </button>
                  </div>
                </div>
                
                <div className="card mb-3">
                  <div className="card-body">
                    <h3 className="mb-3">📺 YouTube</h3>
                    <p className="text-muted mb-3">
                      Create a visualizer video with your artwork and upload directly to YouTube.
                    </p>
                    <div className="alert alert-info">
                      <strong>💰 Monetization:</strong> Streaming generates less revenue than uploads. 
                      Individual video uploads allow for ads and higher CPM rates.
                    </div>
                    <button className="btn btn-primary">
                      🎬 Generate YouTube Video
                    </button>
                  </div>
                </div>
                
                <div className="card">
                  <div className="card-body">
                    <h3 className="mb-3">📱 TikTok / Reels</h3>
                    <p className="text-muted mb-3">
                      Create short preview clips perfect for TikTok, Instagram Reels, and YouTube Shorts.
                    </p>
                    <ul className="mb-3">
                      <li>15, 30, and 60-second clips</li>
                      <li>Vertical 9:16 format</li>
                      <li>Eye-catching visuals</li>
                    </ul>
                    <button className="btn btn-primary">
                      ✂️ Generate Short Clips
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>
        </>
      );
    }
    
    ReactDOM.render(<App />, document.getElementById('root'));
  </script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
</body>
</html>`)
})

export default app