export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Handle API routes
    if (url.pathname.startsWith('/api/')) {
      return handleAPI(request, env, url.pathname);
    }
    
    // Handle R2 file serving
    if (url.pathname.startsWith('/r2/')) {
      const key = url.pathname.slice(4);
      const object = await env.R2.get(key);
      
      if (!object) {
        return new Response('Not Found', { status: 404 });
      }
      
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('Cache-Control', 'public, max-age=3600');
      
      return new Response(object.body, { headers });
    }
    
    // For all other routes, return the HTML
    return new Response(HTML_CONTENT, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  },
};

async function handleAPI(request, env, pathname) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    // R2 Upload
    if (pathname === '/api/upload' && request.method === 'POST') {
      const formData = await request.formData();
      const file = formData.get('file');
      const type = formData.get('type') || 'file';
      
      if (!file) {
        return new Response(JSON.stringify({ error: 'No file provided' }), { 
          status: 400, 
          headers 
        });
      }
      
      const key = `${type}/${Date.now()}-${file.name}`;
      await env.R2.put(key, file.stream(), {
        httpMetadata: {
          contentType: file.type,
        },
      });
      
      return new Response(JSON.stringify({ 
        success: true, 
        url: `/r2/${key}` 
      }), { headers });
    }
    
    // Music generation
    if (pathname === '/api/generate-music' && request.method === 'POST') {
      const body = await request.json();
      
      if (body.service === 'goapi') {
        const response = await fetch('https://api.goapi.ai/api/v1/task', {
          method: 'POST',
          headers: {
            'X-API-Key': env.GOAPI_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'music-u',
            task_type: 'generate_music',
            input: {
              prompt: body.prompt,
              title: body.title,
              lyrics_type: 'instrumental',
              gpt_description_prompt: body.prompt
            }
          })
        });
        
        const data = await response.json();
        console.log('GoAPI Response:', data);
        return new Response(JSON.stringify({ 
          success: true, 
          taskId: data.data?.task_id || data.task_id 
        }), { headers });
      }
    }
    
    // Check music status
    if (pathname === '/api/check-music-status' && request.method === 'GET') {
      const url = new URL(request.url);
      const taskId = url.searchParams.get('taskId');
      const service = url.searchParams.get('service');
      
      if (service === 'goapi') {
        const response = await fetch(`https://api.goapi.ai/api/v1/task/${taskId}`, {
          headers: { 'X-API-Key': env.GOAPI_KEY }
        });
        
        const data = await response.json();
        return new Response(JSON.stringify(data), { headers });
      }
    }
    
    // Generate artwork using Cloudflare AI
    if (pathname === '/api/generate-artwork' && request.method === 'POST') {
      const body = await request.json();
      
      const response = await env.AI.run('@cf/stabilityai/stable-diffusion-xl-base-1.0', {
        prompt: body.prompt
      });
      
      const key = `artwork/${Date.now()}.png`;
      await env.R2.put(key, response, {
        httpMetadata: {
          contentType: 'image/png',
        },
      });
      
      return new Response(JSON.stringify({ 
        success: true, 
        imageUrl: `/r2/${key}` 
      }), { headers });
    }
    
    // Publish to DistroKid (placeholder - requires actual DistroKid API integration)
    if (pathname === '/api/publish-distrokid' && request.method === 'POST') {
      const body = await request.json();
      
      // TODO: Implement actual DistroKid API integration
      // For now, just store the release data in R2
      const releaseKey = `releases/${Date.now()}-${body.albumName.replace(/\s+/g, '-').toLowerCase()}.json`;
      await env.R2.put(releaseKey, JSON.stringify(body), {
        httpMetadata: {
          contentType: 'application/json',
        },
      });
      
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Release data saved. DistroKid integration coming soon!',
        releaseId: releaseKey
      }), { headers });
    }
    
    return new Response(JSON.stringify({ error: 'Not found' }), { 
      status: 404, 
      headers 
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: error.message 
    }), { 
      status: 500, 
      headers 
    });
  }
}

const APP_JS = `
const { useState, useEffect, useRef } = React;
const { createElement: h } = React;

// Simple state management
const useLocalStorage = (key, defaultValue) => {
  const [value, setValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
};

// API functions
const api = {
  async uploadFile(file, type) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.url;
  },

  async generateMusic(params) {
    const response = await fetch('/api/generate-music', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.taskId;
  },

  async checkMusicStatus(taskId, service) {
    const response = await fetch(\`/api/check-music-status?taskId=\${taskId}&service=\${service}\`);
    return response.json();
  },

  async generateArtwork(params) {
    const response = await fetch('/api/generate-artwork', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.imageUrl;
  },

  async publishToDistroKid(params) {
    const response = await fetch('/api/publish-distrokid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data;
  }
};

// Components
function Button({ onClick, disabled, children, variant = 'primary', className = '' }) {
  const baseClass = 'px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed';
  const variantClass = variant === 'primary' 
    ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white'
    : 'bg-gray-800 hover:bg-gray-700 text-gray-300';
  
  return h('button', {
    onClick,
    disabled,
    className: \`\${baseClass} \${variantClass} \${className}\`
  }, children);
}

function Card({ children, className = '' }) {
  return h('div', {
    className: \`bg-gray-800 border border-gray-700 rounded-xl p-6 \${className}\`
  }, children);
}

function MusicSection({ onTrackAdded }) {
  const [activeTab, setActiveTab] = useState('upload');
  const [isLoading, setIsLoading] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [title, setTitle] = useState('');
  const [service, setService] = useState('goapi');
  const fileInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    setIsLoading(true);
    const total = files.filter(f => f.type.startsWith('audio/')).length;
    let uploaded = 0;
    
    try {
      for (const file of files) {
        if (!file.type.startsWith('audio/')) continue;
        
        uploaded++;
        console.log(\`Uploading \${uploaded}/\${total}: \${file.name}\`);
        
        const url = await api.uploadFile(file, 'audio');
        onTrackAdded({
          id: Date.now() + Math.random(),
          name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
          url,
          type: 'upload'
        });
      }
      
      if (uploaded > 0) {
        alert(\`Successfully uploaded \${uploaded} track(s)!\`);
      }
    } catch (error) {
      alert(\`Upload failed after \${uploaded}/\${total} tracks: \${error.message}\`);
    }
    setIsLoading(false);
  };

  const handleGenerate = async () => {
    if (!prompt) return;
    
    setIsLoading(true);
    try {
      const taskId = await api.generateMusic({
        service,
        prompt,
        title: title || 'Untitled',
        tags: 'lofi, instrumental'
      });
      
      // Poll for completion
      const checkStatus = async () => {
        const status = await api.checkMusicStatus(taskId, service);
        
        if (status.status === 'completed' && status.output?.audio_urls) {
          status.output.audio_urls.forEach(url => {
            onTrackAdded({
              id: Date.now() + Math.random(),
              name: title || 'Generated Track',
              url,
              type: 'generated',
              service
            });
          });
          setIsLoading(false);
        } else if (status.status === 'failed') {
          alert('Generation failed');
          setIsLoading(false);
        } else {
          setTimeout(checkStatus, 5000);
        }
      };
      
      setTimeout(checkStatus, 5000);
    } catch (error) {
      alert('Generation failed: ' + error.message);
      setIsLoading(false);
    }
  };

  return h(Card, {}, [
    h('h2', { className: 'text-2xl font-bold mb-6 text-purple-400' }, '1. Music'),
    
    h('div', { className: 'flex gap-2 mb-6' }, [
      h(Button, {
        variant: activeTab === 'upload' ? 'primary' : 'secondary',
        onClick: () => setActiveTab('upload')
      }, 'Upload'),
      h(Button, {
        variant: activeTab === 'generate' ? 'primary' : 'secondary',
        onClick: () => setActiveTab('generate')
      }, 'Generate')
    ]),
    
    activeTab === 'upload' ? h('div', {}, [
      h('div', {
        className: 'border-2 border-dashed border-gray-700 rounded-lg p-12 text-center hover:border-purple-500 transition-colors cursor-pointer',
        onClick: () => fileInputRef.current?.click()
      }, [
        isLoading ? (
          h('p', { className: 'text-purple-400 animate-pulse' }, 'Uploading tracks...')
        ) : [
          h('p', { className: 'text-gray-400 mb-2' }, 'Drop your music files here or click to browse'),
          h('p', { className: 'text-sm text-gray-500 mb-2' }, 'Supports MP3, WAV, FLAC'),
          h('p', { className: 'text-xs text-gray-600' }, 'You can select multiple files (up to 30 tracks)')
        ]
      ]),
      h('input', {
        ref: fileInputRef,
        type: 'file',
        accept: 'audio/*',
        multiple: true,
        onChange: handleFileUpload,
        className: 'hidden'
      })
    ]) : h('div', { className: 'space-y-4' }, [
      h('select', {
        value: service,
        onChange: (e) => setService(e.target.value),
        className: 'w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2'
      }, [
        h('option', { value: 'goapi' }, 'GoAPI (Udio)')
      ]),
      
      h('textarea', {
        value: prompt,
        onChange: (e) => setPrompt(e.target.value),
        placeholder: 'Describe your lofi beat...',
        className: 'w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 min-h-[100px] resize-none'
      }),
      
      h('input', {
        type: 'text',
        value: title,
        onChange: (e) => setTitle(e.target.value),
        placeholder: 'Track title',
        className: 'w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2'
      }),
      
      h(Button, {
        onClick: handleGenerate,
        disabled: !prompt || isLoading,
        className: 'w-full'
      }, isLoading ? 'Generating...' : 'Generate Music')
    ])
  ]);
}

function PublishingSection({ disabled, tracks, artwork }) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [releaseDate, setReleaseDate] = useState('');
  const [artistName, setArtistName] = useState('');
  const [albumName, setAlbumName] = useState('');
  const [recordLabel, setRecordLabel] = useState('');
  const [copyright, setCopyright] = useState('');
  const [upc, setUPC] = useState('');
  const [platforms, setPlatforms] = useState({
    spotify: true,
    appleMusic: true,
    youtube: true,
    tiktok: true,
    instagram: true
  });

  const handlePublish = async () => {
    if (!artistName || !albumName) {
      alert('Please fill in artist name and album name');
      return;
    }

    setIsPublishing(true);
    try {
      // For now, just log the data - you'll need to implement actual DistroKid API
      const publishData = {
        artistName,
        albumName,
        recordLabel,
        copyright: copyright || \`© \${new Date().getFullYear()} \${artistName}\`,
        upc,
        releaseDate: releaseDate || new Date().toISOString().split('T')[0],
        tracks: tracks.map((t, idx) => ({
          title: t.name,
          url: t.url,
          trackNumber: idx + 1
        })),
        artwork,
        platforms
      };

      console.log('Publishing to DistroKid:', publishData);
      
      const response = await api.publishToDistroKid(publishData);
      alert(\`Success! \${response.message}\`);
      
    } catch (error) {
      alert('Publishing failed: ' + error.message);
    }
    setIsPublishing(false);
  };

  const selectedTrackCount = tracks.filter(t => t.selected).length;

  return h(Card, { className: disabled ? 'opacity-50 pointer-events-none' : '' }, [
    h('h2', { className: 'text-2xl font-bold mb-6 text-green-400' }, '3. Publish & Distribute'),
    
    h('div', { className: 'space-y-4' }, [
      // Basic Info
      h('div', { className: 'grid md:grid-cols-2 gap-4' }, [
        h('div', {}, [
          h('label', { className: 'block text-sm font-medium text-gray-400 mb-1' }, 'Artist Name *'),
          h('input', {
            type: 'text',
            value: artistName,
            onChange: (e) => setArtistName(e.target.value),
            placeholder: 'Your artist name',
            className: 'w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2'
          })
        ]),
        
        h('div', {}, [
          h('label', { className: 'block text-sm font-medium text-gray-400 mb-1' }, 'Album/Single Name *'),
          h('input', {
            type: 'text',
            value: albumName,
            onChange: (e) => setAlbumName(e.target.value),
            placeholder: 'Album or single title',
            className: 'w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2'
          })
        ])
      ]),

      h('div', { className: 'grid md:grid-cols-2 gap-4' }, [
        h('div', {}, [
          h('label', { className: 'block text-sm font-medium text-gray-400 mb-1' }, 'Record Label'),
          h('input', {
            type: 'text',
            value: recordLabel,
            onChange: (e) => setRecordLabel(e.target.value),
            placeholder: 'Your label (optional)',
            className: 'w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2'
          })
        ]),
        
        h('div', {}, [
          h('label', { className: 'block text-sm font-medium text-gray-400 mb-1' }, 'Release Date'),
          h('input', {
            type: 'date',
            value: releaseDate,
            onChange: (e) => setReleaseDate(e.target.value),
            min: new Date().toISOString().split('T')[0],
            className: 'w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2'
          })
        ])
      ]),

      h('div', {}, [
        h('label', { className: 'block text-sm font-medium text-gray-400 mb-1' }, 'Copyright'),
        h('input', {
          type: 'text',
          value: copyright,
          onChange: (e) => setCopyright(e.target.value),
          placeholder: \`© \${new Date().getFullYear()} Your Name\`,
          className: 'w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2'
        })
      ]),

      // Platform Selection
      h('div', {}, [
        h('label', { className: 'block text-sm font-medium text-gray-400 mb-3' }, 'Distribution Platforms'),
        h('div', { className: 'grid grid-cols-2 md:grid-cols-3 gap-3' }, 
          Object.entries(platforms).map(([platform, enabled]) =>
            h('label', { 
              key: platform,
              className: 'flex items-center gap-2 cursor-pointer'
            }, [
              h('input', {
                type: 'checkbox',
                checked: enabled,
                onChange: (e) => setPlatforms({...platforms, [platform]: e.target.checked}),
                className: 'rounded border-gray-600 bg-gray-700 text-purple-500'
              }),
              h('span', { className: 'capitalize' }, platform.replace(/([A-Z])/g, ' $1').trim())
            ])
          )
        )
      ]),

      // Summary
      h('div', { className: 'bg-gray-700/50 rounded-lg p-4' }, [
        h('h4', { className: 'font-medium mb-2' }, 'Release Summary:'),
        h('ul', { className: 'text-sm text-gray-400 space-y-1' }, [
          h('li', {}, \`• \${selectedTrackCount} track(s) selected\`),
          h('li', {}, artwork ? '• Artwork uploaded ✓' : '• No artwork uploaded ✗'),
          h('li', {}, \`• Releasing to \${Object.values(platforms).filter(p => p).length} platforms\`),
          h('li', {}, \`• Release date: \${releaseDate || 'Today'}\`)
        ])
      ]),

      h(Button, {
        onClick: handlePublish,
        disabled: isPublishing || selectedTrackCount === 0 || !artwork,
        className: 'w-full'
      }, isPublishing ? 'Publishing...' : 'Publish to DistroKid')
    ])
  ]);
}

function ArtworkSection({ disabled, onArtworkSet }) {
  const [isLoading, setIsLoading] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [artwork, setArtwork] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    
    setIsLoading(true);
    try {
      const url = await api.uploadFile(file, 'artwork');
      setArtwork(url);
      onArtworkSet(url);
    } catch (error) {
      alert('Upload failed: ' + error.message);
    }
    setIsLoading(false);
  };

  const handleGenerate = async () => {
    if (!prompt) return;
    
    setIsLoading(true);
    try {
      const url = await api.generateArtwork({
        prompt: \`\${prompt}, album cover, square format, high quality\`
      });
      setArtwork(url);
      onArtworkSet(url);
    } catch (error) {
      alert('Generation failed: ' + error.message);
    }
    setIsLoading(false);
  };

  return h(Card, { className: disabled ? 'opacity-50 pointer-events-none' : '' }, [
    h('h2', { className: 'text-2xl font-bold mb-6 text-pink-400' }, '2. Album Artwork'),
    
    h('div', { className: 'grid md:grid-cols-2 gap-6' }, [
      h('div', {}, [
        h('div', {
          className: 'aspect-square bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center'
        }, artwork ? 
          h('img', { src: artwork, className: 'w-full h-full object-cover' }) :
          h('p', { className: 'text-gray-500' }, 'No artwork yet')
        )
      ]),
      
      h('div', { className: 'space-y-4' }, [
        h('textarea', {
          value: prompt,
          onChange: (e) => setPrompt(e.target.value),
          placeholder: 'Describe your album cover...',
          className: 'w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 min-h-[120px] resize-none'
        }),
        
        h(Button, {
          onClick: handleGenerate,
          disabled: !prompt || isLoading,
          className: 'w-full'
        }, isLoading ? 'Generating...' : 'Generate Artwork'),
        
        h('div', { className: 'pt-4 border-t border-gray-700' }, [
          h('p', { className: 'text-sm text-gray-400 mb-2' }, 'Or upload your own:'),
          h('input', {
            ref: fileInputRef,
            type: 'file',
            accept: 'image/*',
            onChange: handleFileUpload,
            className: 'hidden'
          }),
          h(Button, {
            variant: 'secondary',
            onClick: () => fileInputRef.current?.click(),
            className: 'w-full'
          }, 'Upload Image')
        ])
      ])
    ])
  ]);
}

function TrackList({ tracks, onToggleTrack, onRemoveTrack }) {
  if (tracks.length === 0) return null;

  const allSelected = tracks.every(t => t.selected);
  const toggleAll = () => {
    const newState = !allSelected;
    tracks.forEach(track => onToggleTrack(track.id, newState));
  };

  return h('div', { className: 'mt-6 space-y-2' }, [
    h('div', { className: 'flex items-center justify-between mb-3' }, [
      h('h3', { className: 'text-sm font-medium text-gray-400' }, \`Tracks (\${tracks.length})\`),
      h(Button, {
        variant: 'secondary',
        onClick: toggleAll,
        className: 'text-xs'
      }, allSelected ? 'Deselect All' : 'Select All')
    ]),
    ...tracks.map(track => 
      h('div', {
        key: track.id,
        className: \`flex items-center gap-3 p-3 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors \${
          track.selected ? 'ring-2 ring-purple-500' : ''
        }\`
      }, [
        h('div', { className: 'flex-1' }, [
          h('p', { className: 'font-medium' }, track.name),
          h('p', { className: 'text-xs text-gray-500' }, 
            track.type === 'generated' ? \`Generated (\${track.service})\` : 'Uploaded'
          )
        ]),
        h('label', { className: 'flex items-center gap-2' }, [
          h('input', {
            type: 'checkbox',
            checked: track.selected || false,
            onChange: () => onToggleTrack(track.id),
            className: 'rounded border-gray-600 bg-gray-700 text-purple-500'
          }),
          h('span', { className: 'text-sm' }, 'Include')
        ]),
        h(Button, {
          size: 'sm',
          variant: 'secondary',
          onClick: () => onRemoveTrack(track.id),
          className: 'text-red-400'
        }, 'Remove')
      ])
    )
  ]);
}

function App() {
  const [tracks, setTracks] = useLocalStorage('lofi-tracks', []);
  const [artwork, setArtwork] = useState(null);

  const addTrack = (track) => {
    setTracks([...tracks, { ...track, selected: false }]);
  };

  const toggleTrack = (id, forceState) => {
    setTracks(tracks.map(t => 
      t.id === id ? { ...t, selected: forceState !== undefined ? forceState : !t.selected } : t
    ));
  };

  const removeTrack = (id) => {
    setTracks(tracks.filter(t => t.id !== id));
  };

  const hasSelectedTracks = tracks.some(t => t.selected);

  return h('div', { className: 'min-h-screen bg-gray-900 text-white' }, [
    h('header', { className: 'py-8 text-center border-b border-gray-800' }, [
      h('h1', { className: 'text-5xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent' }, 
        '🎵 Lofi Studio'
      ),
      h('p', { className: 'mt-2 text-gray-400' }, 'Create, visualize, and publish your lofi beats')
    ]),

    h('main', { className: 'max-w-7xl mx-auto px-4 py-8 space-y-8' }, [
      h(MusicSection, { onTrackAdded: addTrack }),
      h(TrackList, { 
        tracks, 
        onToggleTrack: toggleTrack,
        onRemoveTrack: removeTrack
      }),
      h(ArtworkSection, { 
        disabled: !hasSelectedTracks,
        onArtworkSet: setArtwork 
      }),
      h(PublishingSection, {
        disabled: !hasSelectedTracks || !artwork,
        tracks: tracks.filter(t => t.selected),
        artwork
      })
    ])
  ]);
}

// Render app
ReactDOM.createRoot(document.getElementById('root')).render(h(App));
`;

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lofi Studio</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
</head>
<body class="bg-gray-900 text-white">
    <div id="root"></div>
    <script>
${APP_JS}
    </script>
</body>
</html>`;