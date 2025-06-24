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
    const response = await fetch(`/api/check-music-status?taskId=${taskId}&service=${service}`);
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
    className: `${baseClass} ${variantClass} ${className}`
  }, children);
}

function Card({ children, className = '' }) {
  return h('div', {
    className: `bg-gray-800 border border-gray-700 rounded-xl p-6 ${className}`
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
    
    for (const file of files) {
      if (!file.type.startsWith('audio/')) continue;
      
      setIsLoading(true);
      try {
        const url = await api.uploadFile(file, 'audio');
        onTrackAdded({
          id: Date.now() + Math.random(),
          name: file.name,
          url,
          type: 'upload'
        });
      } catch (error) {
        alert('Upload failed: ' + error.message);
      }
      setIsLoading(false);
    }
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
        h('p', { className: 'text-gray-400 mb-2' }, 'Drop your music files here or click to browse'),
        h('p', { className: 'text-sm text-gray-500' }, 'Supports MP3, WAV, FLAC')
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
        prompt: `${prompt}, album cover, square format, high quality`
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

function TrackList({ tracks, selectedTrack, onSelectTrack, onRemoveTrack }) {
  if (tracks.length === 0) return null;

  return h('div', { className: 'mt-6 space-y-2' }, [
    h('h3', { className: 'text-sm font-medium text-gray-400 mb-3' }, 'Tracks'),
    ...tracks.map(track => 
      h('div', {
        key: track.id,
        className: `flex items-center gap-3 p-3 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors ${
          selectedTrack === track.id ? 'ring-2 ring-purple-500' : ''
        }`
      }, [
        h('div', { className: 'flex-1' }, [
          h('p', { className: 'font-medium' }, track.name),
          h('p', { className: 'text-xs text-gray-500' }, 
            track.type === 'generated' ? `Generated (${track.service})` : 'Uploaded'
          )
        ]),
        h(Button, {
          size: 'sm',
          variant: selectedTrack === track.id ? 'primary' : 'secondary',
          onClick: () => onSelectTrack(track.id === selectedTrack ? null : track.id)
        }, selectedTrack === track.id ? 'Selected' : 'Select'),
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
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [artwork, setArtwork] = useState(null);

  const addTrack = (track) => {
    setTracks([...tracks, track]);
  };

  const removeTrack = (id) => {
    setTracks(tracks.filter(t => t.id !== id));
    if (selectedTrack === id) setSelectedTrack(null);
  };

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
        selectedTrack, 
        onSelectTrack: setSelectedTrack,
        onRemoveTrack: removeTrack
      }),
      h(ArtworkSection, { 
        disabled: !selectedTrack,
        onArtworkSet: setArtwork 
      })
    ])
  ]);
}

// Render app
ReactDOM.createRoot(document.getElementById('root')).render(h(App));