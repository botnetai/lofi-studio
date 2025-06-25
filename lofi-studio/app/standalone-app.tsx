import React, { useState, useEffect, useCallback } from 'react'
import ReactDOM from 'react-dom/client'
import './styles/globals.css'

// Import tab components
import { ArtworkTabSimple } from './components/ArtworkTabSimple'
import { CompileTab } from './components/CompileTab'

// Import Base UI components
import { Tabs } from './components/ui/Tabs'
import { Button } from './components/ui/Button'

// Theme Provider implementation
type Theme = "dark" | "light" | "system"

const ThemeContext = React.createContext<{
  theme: Theme
  setTheme: (theme: Theme) => void
}>({
  theme: "system",
  setTheme: () => null,
})

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem("lofi-studio-theme")
    return (stored as Theme) || "system"
  })

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove("light", "dark")

    const applyTheme = () => {
      if (theme === "system") {
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        root.classList.add(systemTheme)
      } else {
        root.classList.add(theme)
      }
    }

    applyTheme()

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
      const handleChange = () => {
        root.classList.remove("light", "dark")
        applyTheme()
      }
      
      mediaQuery.addEventListener("change", handleChange)
      return () => {
        mediaQuery.removeEventListener("change", handleChange)
      }
    }
  }, [theme])

  const updateTheme = (newTheme: Theme) => {
    localStorage.setItem("lofi-studio-theme", newTheme)
    setTheme(newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme: updateTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

// Header Component with Base UI Tabs
function Header({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) {
  const { theme, setTheme } = React.useContext(ThemeContext)
  
  const navigation = [
    { id: 'music', name: 'Music', icon: '🎵' },
    { id: 'artwork', name: 'Artwork', icon: '🎨' },
    { id: 'compile', name: 'Compile', icon: '📦' },
    { id: 'publish', name: 'Publish', icon: '📤' },
  ]
  
  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-800 bg-gray-950/95 backdrop-blur supports-[backdrop-filter]:bg-gray-950/60">
      <div className="container flex h-16 items-center">
        <div className="mr-4 flex">
          <a 
            href="/" 
            className="mr-6 flex items-center space-x-2"
            onClick={(e) => {
              e.preventDefault()
              onTabChange('music')
            }}
          >
            <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Lofi Studio
            </span>
          </a>
          
          <Tabs.List className="flex items-center gap-1 bg-transparent border-0 p-0">
            {navigation.map((item) => (
              <Tabs.Trigger
                key={item.id}
                value={item.id}
                className="relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:bg-gray-800/50 data-[selected]:bg-gray-800 data-[selected]:text-white"
              >
                <span className="flex items-center gap-2">
                  <span>{item.icon}</span>
                  <span className="hidden lg:inline">{item.name}</span>
                </span>
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </div>
        
        <div className="flex flex-1 items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (theme === "light") setTheme("dark")
              else if (theme === "dark") setTheme("system")
              else setTheme("light")
            }}
            title={`Current theme: ${theme}. Click to change.`}
          >
            {theme === "light" && <span>☀️</span>}
            {theme === "dark" && <span>🌙</span>}
            {theme === "system" && <span>💻</span>}
            <span className="sr-only">Toggle theme</span>
          </Button>
          
          <Button variant="outline" size="sm">
            Log in
          </Button>
          
          <Button variant="primary" size="sm">
            Sign up
          </Button>
        </div>
      </div>
    </header>
  )
}

// Music Tab Components
function GenerateMusic() {
  const [prompt, setPrompt] = useState("")
  const [customMode, setCustomMode] = useState(false)
  const [lyrics, setLyrics] = useState("")
  const [title, setTitle] = useState("")
  const [tags, setTags] = useState("")
  const [makeInstrumental, setMakeInstrumental] = useState(true)
  const [model, setModel] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [workId, setWorkId] = useState("")
  const [status, setStatus] = useState("")
  
  const handleGenerate = async () => {
    if (!prompt.trim()) return
    
    setIsGenerating(true)
    setStatus("Starting generation...")
    
    try {
      const response = await fetch('/api/generate-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt,
          customMode,
          title: customMode && title ? title : undefined,
          tags: customMode && tags ? tags : undefined,
          lyrics: customMode && lyrics ? lyrics : undefined,
          make_instrumental: makeInstrumental,
          model: model || undefined
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate music')
      }
      
      if (data.workId) {
        setWorkId(data.workId)
        setStatus("Generating your music... (1-3 minutes)")
        pollStatus(data.workId)
      }
      
      // Clear form
      setPrompt("")
      setLyrics("")
      setTitle("")
      setTags("")
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to generate music: ' + error.message)
      setIsGenerating(false)
      setStatus("")
    }
  }
  
  const pollStatus = async (id: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/generate-music-status?workId=${id}`)
        const data = await response.json()
        
        if (data.status === 'completed') {
          clearInterval(interval)
          setIsGenerating(false)
          setStatus("Generation complete! Check your library below.")
          setWorkId("")
          // Refresh library will happen automatically
        }
      } catch (error) {
        console.error('Polling error:', error)
      }
    }, 3000)
  }
  
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
      <div className="space-y-1.5 mb-6">
        <h3 className="text-2xl font-semibold leading-none tracking-tight">Generate Music</h3>
        <p className="text-sm text-muted-foreground">Create AI-powered lofi beats</p>
      </div>
      
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Music Prompt
            </label>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the lofi beat you want..."
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isGenerating}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">
              AI Model (optional)
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isGenerating}
            >
              <option value="">Latest (default)</option>
              <option value="chirp-v3-5">chirp-v3-5</option>
              <option value="chirp-v3-0">chirp-v3-0</option>
              <option value="chirp-v2-xxl-alpha">chirp-v2-xxl-alpha</option>
            </select>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="custom-mode"
            checked={customMode}
            onChange={(e) => setCustomMode(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
            disabled={isGenerating}
          />
          <label htmlFor="custom-mode" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Add custom lyrics
          </label>
        </div>
        
        {customMode && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">
                  Title (optional)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Custom track title..."
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  disabled={isGenerating}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">
                  Tags (optional)
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="lofi, chill, study..."
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  disabled={isGenerating}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">
                Lyrics (optional)
              </label>
              <textarea
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                placeholder="Enter your lyrics here..."
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isGenerating}
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="make-instrumental"
                checked={makeInstrumental}
                onChange={(e) => setMakeInstrumental(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
                disabled={isGenerating}
              />
              <label htmlFor="make-instrumental" className="text-sm font-medium leading-none">
                Make instrumental (no vocals)
              </label>
            </div>
          </div>
        )}
        
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
        >
          <span className="flex items-center gap-2">
            {isGenerating ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Generating...
              </>
            ) : (
              <>
                <span>🎵</span>
                Generate Music
              </>
            )}
          </span>
        </button>
        
        {status && (
          <div className="text-sm text-muted-foreground">
            {status}
            {workId && <span className="block text-xs mt-1">ID: {workId}</span>}
          </div>
        )}
      </div>
      
      <div className="mt-6 pt-6 border-t text-sm text-muted-foreground">
        <p>Powered by Udio AI • Generation takes 1-3 minutes</p>
      </div>
    </div>
  )
}

function MusicLibrary({ onNavigateToCompile }: { onNavigateToCompile: (selectedSongs: string[]) => void }) {
  const [songs, setSongs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSongs, setSelectedSongs] = useState<string[]>([])
  
  useEffect(() => {
    fetchSongs()
    const interval = setInterval(fetchSongs, 5000)
    return () => clearInterval(interval)
  }, [])
  
  const fetchSongs = async () => {
    try {
      const response = await fetch('/api/songs')
      const data = await response.json()
      setSongs(data)
    } catch (error) {
      console.error('Error fetching songs:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this song?')) return
    
    try {
      const response = await fetch(`/api/songs/${id}`, { method: 'DELETE' })
      if (response.ok) {
        fetchSongs()
      }
    } catch (error) {
      console.error('Error deleting song:', error)
    }
  }
  
  const toggleSelection = (id: string) => {
    setSelectedSongs(prev => 
      prev.includes(id) 
        ? prev.filter(songId => songId !== id)
        : [...prev, id]
    )
  }
  
  if (loading) return (
    <div className="rounded-lg border bg-card p-6">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="space-y-3">
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  )
  
  const generatingCount = songs.filter(s => s.status === 'generating' || s.status === 'pending').length
  const completedCount = songs.filter(s => s.status === 'completed').length
  
  const handleRefreshStuck = async () => {
    // Refresh songs stuck in generating state
    const stuckSongs = songs.filter(s => s.status === 'generating')
    for (const song of stuckSongs) {
      const metadata = song.metadata ? JSON.parse(song.metadata) : {}
      if (metadata.workId) {
        // This will trigger a status check
        await fetch(`/api/generate-music-status?workId=${metadata.workId}`)
      }
    }
    fetchSongs()
  }
  
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="p-6">
        <div className="space-y-1.5 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-semibold leading-none tracking-tight">Music Library</h3>
              <p className="text-sm text-muted-foreground">Your generated lofi tracks</p>
            </div>
            {generatingCount > 0 && (
              <button
                onClick={handleRefreshStuck}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
              >
                🔄 Refresh Stuck Songs
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>🎵 {songs.length} total</span>
            <span>✅ {completedCount} completed</span>
            {generatingCount > 0 && <span>⏳ {generatingCount} generating</span>}
          </div>
        </div>
        
        {selectedSongs.length > 0 && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-muted/50 rounded-lg">
            <span className="text-sm">{selectedSongs.length} selected</span>
            <button
              onClick={() => onNavigateToCompile(selectedSongs)}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3"
            >
              Create Album
            </button>
            <button
              onClick={async () => {
                const selectedCompletedSongs = songs.filter(s => selectedSongs.includes(s.id) && s.status === 'completed')
                for (const song of selectedCompletedSongs) {
                  const url = song.url || (song.metadata ? JSON.parse(song.metadata).audio_url : null)
                  if (url) {
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `${song.name || 'lofi-track'}.mp3`
                    a.click()
                    await new Promise(resolve => setTimeout(resolve, 100)) // Small delay between downloads
                  }
                }
              }}
              className="text-sm text-primary hover:underline"
            >
              Download Selected
            </button>
            <button
              onClick={async () => {
                if (confirm(`Delete ${selectedSongs.length} songs?`)) {
                  for (const id of selectedSongs) {
                    await handleDelete(id)
                  }
                  setSelectedSongs([])
                }
              }}
              className="text-sm text-red-600 hover:underline"
            >
              Delete Selected
            </button>
          </div>
        )}
        
        {songs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No songs yet. Generate some music to get started!</p>
            <span className="text-6xl">🎵</span>
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-muted/50">
                <tr>
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedSongs(songs.map(s => s.id))
                        } else {
                          setSelectedSongs([])
                        }
                      }}
                      checked={selectedSongs.length === songs.length && songs.length > 0}
                    />
                  </th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {songs.map((song) => {
                  const metadata = song.metadata ? JSON.parse(song.metadata) : {}
                  return (
                    <tr key={song.id} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedSongs.includes(song.id)}
                          onChange={() => toggleSelection(song.id)}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium">
                        <div>
                          <div className="font-medium">{song.name || metadata.title || 'Untitled'}</div>
                          <div className="text-xs text-muted-foreground">{metadata.prompt || song.prompt || 'No description'}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          song.status === 'completed' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                            : song.status === 'failed'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        }`}>
                          {song.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {metadata.duration ? `${Math.floor(metadata.duration / 60)}:${Math.floor(metadata.duration % 60).toString().padStart(2, '0')}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {new Date(song.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {(song.url || metadata.audio_url) && song.status === 'completed' && (
                            <>
                              <audio 
                                controls 
                                className="h-8"
                                src={song.url || metadata.audio_url}
                                preload="none"
                              />
                              <a
                                href={song.url || metadata.audio_url}
                                download={`${song.name || metadata.title || 'lofi-track'}.mp3`}
                                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3"
                              >
                                Download
                              </a>
                            </>
                          )}
                          <button
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8"
                            onClick={() => handleDelete(song.id)}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// Music Tab Component
function MusicTab({ onNavigateToCompile }: { onNavigateToCompile: (selectedSongs: string[]) => void }) {
  return (
    <div className="space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">Generate Lofi Music</h1>
        <p className="text-muted-foreground">
          Create AI-powered lofi beats with custom prompts
        </p>
      </div>
      
      <GenerateMusic />
      
      <div className="mt-12">
        <MusicLibrary onNavigateToCompile={onNavigateToCompile} />
      </div>
    </div>
  )
}

// Publish Tab Component (Placeholder)
function PublishTab() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
        <h2 className="text-2xl font-bold mb-4">Publish Your Music</h2>
        <p className="text-muted-foreground mb-6">
          Share your lofi creations with the world. Publishing features coming soon!
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 border rounded-lg text-center">
            <span className="text-4xl mb-4 block">🎵</span>
            <h3 className="font-semibold mb-2">Streaming Platforms</h3>
            <p className="text-sm text-muted-foreground">
              Distribute to Spotify, Apple Music, and more
            </p>
          </div>
          
          <div className="p-6 border rounded-lg text-center">
            <span className="text-4xl mb-4 block">🌐</span>
            <h3 className="font-semibold mb-2">Social Media</h3>
            <p className="text-sm text-muted-foreground">
              Share directly to TikTok, Instagram, and YouTube
            </p>
          </div>
          
          <div className="p-6 border rounded-lg text-center">
            <span className="text-4xl mb-4 block">💰</span>
            <h3 className="font-semibold mb-2">Monetization</h3>
            <p className="text-sm text-muted-foreground">
              Earn royalties from your music
            </p>
          </div>
        </div>
        
        <div className="mt-8 p-4 bg-muted/50 rounded-lg">
          <p className="text-center text-sm text-muted-foreground">
            Publishing features are currently in development. Stay tuned!
          </p>
        </div>
      </div>
    </div>
  )
}

// Main App Component
function App() {
  // Get initial tab from URL
  const getTabFromPath = (pathname: string) => {
    const path = pathname.replace(/^\//, '') // Remove leading slash
    if (!path || path === '') return 'music'
    if (['music', 'artwork', 'compile', 'publish'].includes(path)) {
      return path
    }
    return 'music' // Default to music for unknown paths
  }
  
  const [activeTab, setActiveTab] = useState(() => getTabFromPath(window.location.pathname))
  const [preselectedSongs, setPreselectedSongs] = useState<string[]>([])
  
  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const tab = event.state?.tab || getTabFromPath(window.location.pathname)
      setActiveTab(tab)
    }
    
    window.addEventListener('popstate', handlePopState)
    
    // Set initial state
    const initialTab = getTabFromPath(window.location.pathname)
    window.history.replaceState({ tab: initialTab }, '', window.location.pathname)
    
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])
  
  const handleNavigateToCompile = (selectedSongs: string[]) => {
    setPreselectedSongs(selectedSongs)
    setActiveTab('compile')
    // Update URL when navigating programmatically
    window.history.pushState({ tab: 'compile' }, '', '/compile')
  }
  
  const handleTabChange = (value: string | null) => {
    if (value) {
      setActiveTab(value)
      // Update URL when tab changes
      window.history.pushState({ tab: value }, '', `/${value === 'music' ? '' : value}`)
    }
  }
  
  return (
    <ThemeProvider>
      <div className="relative min-h-screen bg-background text-foreground">
        <Tabs.Root value={activeTab} onValueChange={handleTabChange}>
          <Header activeTab={activeTab} onTabChange={handleTabChange} />
          <main className="container py-6">
            <Tabs.Content value="music" className="focus:outline-none">
              <MusicTab onNavigateToCompile={handleNavigateToCompile} />
            </Tabs.Content>
            <Tabs.Content value="artwork" className="focus:outline-none">
              <ArtworkTabSimple />
            </Tabs.Content>
            <Tabs.Content value="compile" className="focus:outline-none">
              <CompileTab preselectedSongs={preselectedSongs} />
            </Tabs.Content>
            <Tabs.Content value="publish" className="focus:outline-none">
              <PublishTab />
            </Tabs.Content>
          </main>
        </Tabs.Root>
      </div>
    </ThemeProvider>
  )
}

// Mount the app
const root = ReactDOM.createRoot(document.getElementById('root')!)
root.render(<App />)