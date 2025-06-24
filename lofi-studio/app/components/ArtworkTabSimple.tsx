import { useState, useEffect, useCallback } from 'react'
import { Image, Loader2, Check, X, RefreshCw } from 'lucide-react'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { Textarea } from './ui/Textarea'
import { Label } from './ui/Label'

interface Artwork {
  id: string
  url: string
  prompt: string
  metadata: string
  created_at: string
}

interface Video {
  id: string
  url: string
  prompt: string
  metadata: string
  created_at: string
}

export function ArtworkTabSimple() {
  // State for artwork generation
  const [artworkModel, setArtworkModel] = useState('flux-schnell')
  const [artworkPrompt, setArtworkPrompt] = useState('')
  const [isGeneratingArtwork, setIsGeneratingArtwork] = useState(false)
  const [numImages, setNumImages] = useState(4)
  
  // State for video generation
  const [selectedImageForVideo, setSelectedImageForVideo] = useState<string | null>(null)
  const [videoModel, setVideoModel] = useState('kling-2.1')
  const [videoPrompt, setVideoPrompt] = useState('')
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)
  const [videoDuration, setVideoDuration] = useState(5)
  const [videoMode, setVideoMode] = useState('standard')
  const [enableLoop, setEnableLoop] = useState(true)
  const [selectedTailImage, setSelectedTailImage] = useState<string | null>(null)
  
  // Media library state
  const [allArtwork, setAllArtwork] = useState<Artwork[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [mediaFilter, setMediaFilter] = useState<'all' | 'images' | 'videos'>('all')
  
  // UI state
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Clear messages after timeout
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('')
        setSuccess('')
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [error, success])
  
  // Fetch artwork from API
  const fetchArtwork = useCallback(async () => {
    try {
      const response = await fetch('/api/artwork')
      const data = await response.json()
      setAllArtwork(data)
    } catch (error) {
      console.error('Failed to fetch artwork:', error)
    }
  }, [])
  
  // Fetch videos from API
  const fetchVideos = useCallback(async () => {
    try {
      const response = await fetch('/api/videos')
      const data = await response.json()
      console.log('Fetched videos:', data)
      setVideos(data)
    } catch (error) {
      console.error('Failed to fetch videos:', error)
      setError('Failed to fetch videos: ' + error.message)
    }
  }, [])
  
  useEffect(() => {
    fetchArtwork()
    fetchVideos()
    
    // Refresh videos every 5 seconds to catch completed generations
    const interval = setInterval(() => {
      fetchVideos()
    }, 5000)
    
    return () => clearInterval(interval)
  }, [fetchArtwork, fetchVideos])
  
  // Generate artwork
  const generateArtwork = async () => {
    if (!artworkPrompt) {
      setError('Please enter an artwork prompt')
      return
    }
    
    setIsGeneratingArtwork(true)
    setError('')
    setSuccess('')
    
    try {
      const response = await fetch('/api/artwork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: artworkPrompt,
          model: artworkModel,
          numImages: numImages,
          style: 'lofi anime aesthetic, album cover art'
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate artwork')
      }
      
      setSuccess('Artwork generated successfully!')
      setArtworkPrompt('') // Clear prompt after success
      fetchArtwork() // Refresh artwork list
    } catch (error: any) {
      setError(error.message)
    } finally {
      setIsGeneratingArtwork(false)
    }
  }
  
  // Generate video
  const generateVideo = async () => {
    if (!selectedImageForVideo) {
      setError('Please select an image')
      return
    }
    
    setIsGeneratingVideo(true)
    setError('')
    setSuccess('')
    
    try {
      const selectedArtwork = allArtwork.find(a => a.id === selectedImageForVideo)
      
      const response = await fetch('/api/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageId: selectedImageForVideo,
          prompt: videoPrompt,
          model: videoModel,
          duration: videoDuration,
          mode: videoMode,
          enableLoop: enableLoop,
          tailImageId: selectedTailImage
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate video')
      }
      
      setSuccess('Video generation started!')
      setVideoPrompt('') // Clear prompt after success
      fetchVideos() // Refresh video list
    } catch (error: any) {
      setError(error.message)
    } finally {
      setIsGeneratingVideo(false)
    }
  }
  
  return (
    <div className="space-y-6">
      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      
      {success && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess('')}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Artwork Generation Card */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-6">Generate Image</h2>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="artworkModel">AI Model</Label>
              <select
                id="artworkModel"
                value={artworkModel}
                onChange={(e) => setArtworkModel(e.target.value)}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="flux-schnell">FLUX Schnell (Fast)</option>
                <option value="flux-dev">FLUX Dev (Quality)</option>
                <option value="flux-pro">FLUX Pro (Best)</option>
                <option value="stable-diffusion-xl">Stable Diffusion XL</option>
              </select>
            </div>
            
            <div>
              <Label htmlFor="numImages">Number of Images</Label>
              <select
                id="numImages"
                value={numImages}
                onChange={(e) => setNumImages(Number(e.target.value))}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value={1}>1 Image</option>
                <option value={2}>2 Images</option>
                <option value={4}>4 Images</option>
                <option value={8}>8 Images</option>
              </select>
            </div>
            
            <div>
              <Label htmlFor="artworkPrompt">Describe your album artwork</Label>
              <Textarea
                id="artworkPrompt"
                value={artworkPrompt}
                onChange={(e) => setArtworkPrompt(e.target.value)}
                placeholder="e.g., cozy bedroom with rain on window, lofi aesthetic, anime style"
                className="mt-1 min-h-[100px]"
                rows={4}
              />
            </div>
            
            <Button
              onClick={generateArtwork}
              disabled={isGeneratingArtwork || !artworkPrompt}
              className="w-full"
            >
              {isGeneratingArtwork ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Image'
              )}
            </Button>
          </div>
        </Card>
        
        {/* Video Generation Card */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-6">Generate Video from Image</h2>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="videoModel">Video Model</Label>
              <select
                id="videoModel"
                value={videoModel}
                onChange={(e) => setVideoModel(e.target.value)}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="kling-2.1">Kling 2.1 (Latest)</option>
                <option value="kling-2.0">Kling 2.0</option>
                <option value="kling-1.5">Kling 1.5</option>
                <option value="kling-1.0">Kling 1.0</option>
              </select>
            </div>
            
            <div>
              <Label htmlFor="videoMode">Mode</Label>
              <select
                id="videoMode"
                value={videoMode}
                onChange={(e) => setVideoMode(e.target.value)}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="standard">Standard</option>
                <option value="pro">Professional</option>
              </select>
            </div>
            
            <div>
              <Label htmlFor="videoDuration">Duration (seconds)</Label>
              <select
                id="videoDuration"
                value={videoDuration}
                onChange={(e) => setVideoDuration(Number(e.target.value))}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value={5}>5 seconds</option>
                <option value={10}>10 seconds</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="enableLoop"
                checked={enableLoop}
                onChange={(e) => setEnableLoop(e.target.checked)}
                className="w-4 h-4 bg-gray-800 border-gray-600 rounded text-purple-500 focus:ring-purple-500"
              />
              <Label htmlFor="enableLoop" className="cursor-pointer">
                Enable seamless loop
              </Label>
            </div>
            
            <div>
              <Label>Select Image</Label>
              {selectedImageForVideo ? (
                <div className="mt-2">
                  <div className="relative w-32 h-32 rounded-lg overflow-hidden">
                    <img 
                      src={allArtwork.find(a => a.id === selectedImageForVideo)?.url} 
                      alt="Selected" 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center">
                      <Check className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedImageForVideo(null)}
                    className="mt-2"
                  >
                    Remove Selection
                  </Button>
                </div>
              ) : (
                <p className="mt-2 text-sm text-gray-400">Select an image from the gallery below</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="videoPrompt">Video Prompt (optional)</Label>
              <Textarea
                id="videoPrompt"
                value={videoPrompt}
                onChange={(e) => setVideoPrompt(e.target.value)}
                placeholder="Additional instructions for video generation..."
                className="mt-1"
                rows={2}
              />
            </div>
            
            <Button
              onClick={generateVideo}
              disabled={isGeneratingVideo || !selectedImageForVideo}
              className="w-full"
            >
              {isGeneratingVideo ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Video...
                </>
              ) : (
                'Generate Video'
              )}
            </Button>
          </div>
        </Card>
      </div>
      
      {/* Media Library */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Media Library</h2>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                fetchArtwork()
                fetchVideos()
              }}
              title="Refresh media"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              variant={mediaFilter === 'all' ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setMediaFilter('all')}
            >
              All
            </Button>
            <Button
              variant={mediaFilter === 'images' ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setMediaFilter('images')}
            >
              Images
            </Button>
            <Button
              variant={mediaFilter === 'videos' ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setMediaFilter('videos')}
            >
              Videos
            </Button>
          </div>
        </div>
        
        {/* Images Section */}
        {mediaFilter !== 'videos' && (
          <>
            {allArtwork.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Image className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No artwork yet. Generate your first album cover!</p>
              </div>
            ) : (
              <>
                {mediaFilter === 'all' && <h3 className="text-lg font-semibold mb-4 text-gray-300">Images</h3>}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-8">
                  {allArtwork.map((art) => {
                    const metadata = JSON.parse(art.metadata || '{}')
                    const modelMap: Record<string, string> = {
                      'flux-schnell': 'FLUX Schnell',
                      'flux-dev': 'FLUX Dev',
                      'flux-pro': 'FLUX Pro',
                      'stable-diffusion-xl': 'Stable Diffusion XL'
                    }
                    const modelName = modelMap[metadata.model] || metadata.model || 'Unknown model'
                    
                    return (
                      <div
                        key={art.id}
                        className={`
                          relative group cursor-pointer rounded-lg overflow-hidden bg-gray-800 
                          transition-all duration-200 hover:scale-105
                          ${selectedImageForVideo === art.id ? 'ring-2 ring-purple-500' : ''}
                        `}
                        onClick={() => setSelectedImageForVideo(art.id)}
                      >
                        <div className="aspect-square">
                          <img 
                            src={art.url} 
                            alt="Artwork" 
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                            <div className="text-xs font-medium mb-1">{modelName}</div>
                            <div className="text-xs opacity-75 line-clamp-2">
                              {art.prompt || 'No prompt'}
                            </div>
                            <div className="text-xs opacity-50 mt-1">
                              {new Date(art.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        {selectedImageForVideo === art.id && (
                          <div className="absolute top-2 right-2 bg-purple-500 rounded-full p-1">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}
        
        {/* Videos Section */}
        {mediaFilter !== 'images' && videos.length > 0 && (
          <>
            {mediaFilter === 'all' && <h3 className="text-lg font-semibold mb-4 text-gray-300">Videos</h3>}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {videos.map((video) => {
                const metadata = JSON.parse(video.metadata || '{}')
                
                return (
                  <div key={video.id} className="bg-gray-800 rounded-lg overflow-hidden">
                    <video
                      controls
                      loop={metadata.enableLoop}
                      className="w-full aspect-video bg-black"
                    >
                      <source src={video.url} type="video/mp4" />
                    </video>
                    <div className="p-4">
                      <div className="text-sm font-medium mb-1">
                        {metadata.model || 'Unknown model'}
                      </div>
                      <div className="text-xs text-gray-400 line-clamp-2">
                        {video.prompt || 'No prompt'}
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        Duration: {metadata.duration}s • {new Date(video.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </Card>
    </div>
  )
}