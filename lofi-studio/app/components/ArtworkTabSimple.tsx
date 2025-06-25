import { useState, useEffect, useCallback } from 'react'
import { Image, Loader2, Check, X, RefreshCw } from 'lucide-react'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { Textarea } from './ui/Textarea'
import { Label } from './ui/Label'
import { Select } from './ui/Select'
import { Checkbox } from './ui/Checkbox'
import { cn } from '../lib/utils'

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
  status?: 'generating' | 'completed' | 'failed'
}

// Model configurations
const IMAGE_MODEL_CONFIGS = {
  'flux-kontext': {
    name: 'FLUX Kontext',
    version: '1.0',
    modes: ['text-to-image', 'image-to-image'],
    description: 'Best for image-to-image transformations',
    supportsImageInput: true
  },
  'flux-schnell': {
    name: 'FLUX Schnell',
    version: '1.0',
    modes: ['text-to-image'],
    description: 'Fast generation, good quality',
    supportsImageInput: false
  },
  'flux-dev': {
    name: 'FLUX Dev',
    version: '1.0',
    modes: ['text-to-image'],
    description: 'Balanced speed and quality',
    supportsImageInput: false
  },
  'flux-pro': {
    name: 'FLUX Pro',
    version: '1.1',
    modes: ['text-to-image'],
    description: 'Professional quality, balanced speed',
    supportsImageInput: false
  },
  'flux-pro-ultra': {
    name: 'FLUX Pro Ultra',
    version: '1.1',
    modes: ['text-to-image'],
    description: 'Ultra high quality, best for professional use',
    supportsImageInput: false
  },
  'stable-diffusion-xl': {
    name: 'Stable Diffusion XL',
    version: 'Base 1.0',
    modes: ['text-to-image'],
    description: 'Classic model, fast and reliable',
    supportsImageInput: false
  }
}

const VIDEO_MODEL_CONFIGS = {
  'kling-2.1': {
    name: 'Kling 2.1 (Latest)',
    modes: ['standard', 'pro', 'master'],
    durations: [5, 10],
    supportsLoop: false, // Loop is just HTML5 playback, not generation
    supportsTailImage: true,
    description: 'Latest Kling model with best quality'
  },
  'kling-2.0': {
    name: 'Kling 2.0',
    modes: ['standard', 'pro', 'master'],
    durations: [5, 10],
    supportsLoop: false,
    supportsTailImage: true,
    description: 'Previous generation Kling model'
  },
  'kling-1.6': {
    name: 'Kling 1.6',
    modes: ['standard', 'pro'],
    durations: [5, 10],
    supportsLoop: false,
    supportsTailImage: true,
    description: 'Stable version with good results'
  },
  'kling-1.5': {
    name: 'Kling 1.5',
    modes: ['pro'],
    durations: [5, 10],
    supportsLoop: false,
    supportsTailImage: false,
    description: 'Earlier version, pro mode only'
  },
  'kling-1.0': {
    name: 'Kling 1.0',
    modes: ['pro'],
    durations: [5, 10],
    supportsLoop: false,
    supportsTailImage: false,
    description: 'Original Kling model'
  }
}

export function ArtworkTabSimple() {
  // State for artwork generation
  const [artworkModel, setArtworkModel] = useState('flux-kontext')
  const [artworkPrompt, setArtworkPrompt] = useState('')
  const [isGeneratingArtwork, setIsGeneratingArtwork] = useState(false)
  const [numImages, setNumImages] = useState(4)
  const [imageMode, setImageMode] = useState<'text-to-image' | 'image-to-image'>('text-to-image')
  const [selectedImageForArtwork, setSelectedImageForArtwork] = useState<string | null>(null)
  
  // State for video generation
  const [selectedImageForVideo, setSelectedImageForVideo] = useState<string | null>(null)
  const [videoModel, setVideoModel] = useState('kling-2.1')
  const [videoPrompt, setVideoPrompt] = useState('')
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)
  const [videoDuration, setVideoDuration] = useState(5)
  const [videoMode, setVideoMode] = useState('standard')
  const [selectedTailImage, setSelectedTailImage] = useState<string | null>(null)
  
  // Get current model configs
  const currentImageModelConfig = IMAGE_MODEL_CONFIGS[artworkModel as keyof typeof IMAGE_MODEL_CONFIGS]
  const currentVideoModelConfig = VIDEO_MODEL_CONFIGS[videoModel as keyof typeof VIDEO_MODEL_CONFIGS]
  
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
    
    if (imageMode === 'image-to-image' && !selectedImageForArtwork) {
      setError('Please select a source image')
      return
    }
    
    setIsGeneratingArtwork(true)
    setError('')
    setSuccess('')
    
    try {
      const body: any = {
        prompt: artworkPrompt,
        model: artworkModel,
        numImages: numImages,
        style: imageMode === 'text-to-image' ? 'lofi anime aesthetic, album cover art' : ''
      }
      
      if (imageMode === 'image-to-image') {
        body.imageId = selectedImageForArtwork
        body.mode = 'image-to-image'
      }
      
      const response = await fetch('/api/artwork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate artwork')
      }
      
      setSuccess('Artwork generated successfully!')
      setArtworkPrompt('') // Clear prompt after success
      setSelectedImageForArtwork(null) // Clear source image selection
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
          tailImageId: selectedTailImage
        })
      })
      
      const data = await response.json()
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate video')
      }
      
      if (data.status === 'completed') {
        setSuccess('Video generated successfully!')
      } else {
        setSuccess('Video generation started! Your video will appear in the Media Library in 1-2 minutes.')
      }
      
      setVideoPrompt('') // Clear prompt after success
      setSelectedImageForVideo(null) // Clear selection
      
      // Refresh to show the new video
      setTimeout(() => fetchVideos(), 500)
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
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setError('')}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
      
      {success && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{success}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setSuccess('')}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Artwork Generation Card */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-6">Generate Image</h2>
          
          <div className="space-y-4">
            <div>
              <Label>Generation Mode</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  variant={imageMode === 'text-to-image' ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setImageMode('text-to-image')
                    setSelectedImageForArtwork(null)
                  }}
                  className={cn(
                    "flex-1",
                    imageMode === 'text-to-image' && "ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-900"
                  )}
                >
                  Text to Image
                </Button>
                <Button
                  variant={imageMode === 'image-to-image' ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setImageMode('image-to-image')
                    // Set to flux-kontext if current model doesn't support image-to-image
                    const currentConfig = IMAGE_MODEL_CONFIGS[artworkModel as keyof typeof IMAGE_MODEL_CONFIGS]
                    if (!currentConfig.supportsImageInput) {
                      setArtworkModel('flux-kontext')
                    }
                  }}
                  className={cn(
                    "flex-1",
                    imageMode === 'image-to-image' && "ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-900"
                  )}
                >
                  Image to Image
                </Button>
              </div>
            </div>
            
            <div>
              <Label htmlFor="artworkModel">AI Model</Label>
              <Select
                value={artworkModel}
                onValueChange={(value) => {
                  setArtworkModel(value)
                }}
                options={Object.entries(IMAGE_MODEL_CONFIGS)
                  .filter(([key, config]) => {
                    // Filter models based on selected mode
                    if (imageMode === 'image-to-image') {
                      return config.supportsImageInput
                    }
                    return true // All models support text-to-image
                  })
                  .map(([key, config]) => ({
                    value: key,
                    label: `${config.name} ${config.version}`,
                    description: config.description
                  }))}
                className="w-full mt-1"
              />
            </div>
            
            {imageMode === 'image-to-image' && (
              <div>
                <Label>Source Image</Label>
                {selectedImageForArtwork ? (
                  <div className="mt-2">
                    <div className="relative w-32 h-32 rounded-lg overflow-hidden">
                      <img 
                        src={allArtwork.find(a => a.id === selectedImageForArtwork)?.url} 
                        alt="Selected Source" 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center">
                        <Check className="w-8 h-8 text-white" />
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelectedImageForArtwork(null)}
                      className="mt-2"
                    >
                      Remove Source Image
                    </Button>
                  </div>
                ) : (
                  <div className="mt-2 space-y-2">
                    <p className="text-sm text-gray-400">Select a source image from below</p>
                    <div className="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto">
                      {allArtwork.map((art) => (
                        <div
                          key={art.id}
                          className="relative cursor-pointer rounded overflow-hidden hover:ring-2 hover:ring-purple-500"
                          onClick={() => setSelectedImageForArtwork(art.id)}
                        >
                          <img 
                            src={art.url} 
                            alt="Source option" 
                            className="w-full h-full object-cover aspect-square"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <div>
              <Label htmlFor="numImages">Number of Images</Label>
              <Select
                value={numImages.toString()}
                onValueChange={(value) => setNumImages(Number(value))}
                options={[
                  { value: '1', label: '1 Image' },
                  { value: '2', label: '2 Images' },
                  { value: '4', label: '4 Images' },
                  { value: '8', label: '8 Images' }
                ]}
                className="w-full mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="artworkPrompt">
                {imageMode === 'text-to-image' ? 'Describe your album artwork' : 'Describe the transformation'}
              </Label>
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
              disabled={isGeneratingArtwork || !artworkPrompt || (imageMode === 'image-to-image' && !selectedImageForArtwork)}
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
          <h2 className="text-2xl font-bold mb-6">Generate Video</h2>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="videoModel">Video Model</Label>
              <Select
                value={videoModel}
                onValueChange={(newModel) => {
                  setVideoModel(newModel)
                  const config = VIDEO_MODEL_CONFIGS[newModel as keyof typeof VIDEO_MODEL_CONFIGS]
                  // Reset mode if not supported by new model
                  if (!config.modes.includes(videoMode)) {
                    setVideoMode(config.modes[0])
                  }
                  // Reset tail image if not supported
                  if (!config.supportsTailImage) {
                    setSelectedTailImage(null)
                  }
                }}
                options={Object.entries(VIDEO_MODEL_CONFIGS).map(([key, config]) => ({
                  value: key,
                  label: config.name,
                  description: config.description
                }))}
                className="w-full mt-1"
              />
            </div>
            
            {currentVideoModelConfig.modes.length > 1 && (
              <div>
                <Label htmlFor="videoMode">Mode</Label>
                <Select
                  value={videoMode}
                  onValueChange={setVideoMode}
                  options={[
                    ...(currentVideoModelConfig.modes.includes('standard') ? [{ value: 'standard', label: 'Standard' }] : []),
                    ...(currentVideoModelConfig.modes.includes('pro') ? [{ value: 'pro', label: 'Professional' }] : []),
                    ...(currentVideoModelConfig.modes.includes('master') ? [{ value: 'master', label: 'Master (Highest Quality)' }] : [])
                  ]}
                  className="w-full mt-1"
                />
              </div>
            )}
            
            <div>
              <Label htmlFor="videoDuration">Duration (seconds)</Label>
              <Select
                value={videoDuration.toString()}
                onValueChange={(value) => setVideoDuration(Number(value))}
                options={currentVideoModelConfig.durations.map(duration => ({
                  value: duration.toString(),
                  label: `${duration} seconds`
                }))}
                className="w-full mt-1"
              />
            </div>
            
            
            <div>
              <Label>Start Frame</Label>
              {selectedImageForVideo ? (
                <div className="mt-2">
                  <div className="relative w-32 h-32 rounded-lg overflow-hidden">
                    <img 
                      src={allArtwork.find(a => a.id === selectedImageForVideo)?.url} 
                      alt="Selected Start Frame" 
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
                    Remove Start Frame
                  </Button>
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  <p className="text-sm text-gray-400">Click an image below to set as start frame</p>
                  <div className="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto">
                    {allArtwork.map((art) => (
                      <div
                        key={art.id}
                        className="relative cursor-pointer rounded overflow-hidden hover:ring-2 hover:ring-purple-500"
                        onClick={() => setSelectedImageForVideo(art.id)}
                      >
                        <img 
                          src={art.url} 
                          alt="Start frame option" 
                          className="w-full h-full object-cover aspect-square"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {currentVideoModelConfig.supportsTailImage && (
              <div>
                <Label>End Frame (optional)</Label>
                <p className="text-xs text-gray-400 mb-2">For seamless transitions</p>
                
                {selectedImageForVideo && (
                  <div className="flex items-center gap-2 mb-3">
                    <Checkbox
                      id="useSameAsStart"
                      checked={selectedTailImage === selectedImageForVideo}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedTailImage(selectedImageForVideo)
                        } else {
                          setSelectedTailImage(null)
                        }
                      }}
                    />
                    <Label htmlFor="useSameAsStart" className="cursor-pointer text-sm">
                      Use same as start frame
                    </Label>
                  </div>
                )}
                
                {selectedTailImage ? (
                  <div className="mt-2">
                    <div className="relative w-32 h-32 rounded-lg overflow-hidden">
                      <img 
                        src={allArtwork.find(a => a.id === selectedTailImage)?.url} 
                        alt="Selected End Frame" 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-orange-500/20 flex items-center justify-center">
                        <Check className="w-8 h-8 text-white" />
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelectedTailImage(null)}
                      className="mt-2"
                    >
                      Remove End Frame
                    </Button>
                  </div>
                ) : (
                  <div className="mt-2 space-y-2">
                    {!selectedImageForVideo ? (
                      <p className="text-sm text-gray-400">Select a start frame first</p>
                    ) : (
                      <>
                        <p className="text-sm text-gray-400">Click an image below to set as end frame</p>
                        <div className="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto">
                          {allArtwork.map((art) => (
                            <div
                              key={art.id}
                              className={`relative cursor-pointer rounded overflow-hidden hover:ring-2 hover:ring-orange-500 ${
                                art.id === selectedImageForVideo ? 'ring-2 ring-purple-500' : ''
                              }`}
                              onClick={() => setSelectedTailImage(art.id)}
                            >
                              <img 
                                src={art.url} 
                                alt="End frame option" 
                                className="w-full h-full object-cover aspect-square"
                              />
                              {art.id === selectedImageForVideo && (
                                <div className="absolute inset-0 bg-purple-500/10 flex items-center justify-center">
                                  <span className="text-xs bg-black/60 text-white px-2 py-1 rounded">Start</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
            
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
        
        {/* Combined Media Feed */}
        {(() => {
          // Combine and sort media
          const combinedMedia = [
            ...allArtwork.map(art => ({ ...art, type: 'image' as const })),
            ...videos.map(video => ({ ...video, type: 'video' as const }))
          ]
          .filter(item => {
            if (mediaFilter === 'all') return true
            if (mediaFilter === 'images') return item.type === 'image'
            if (mediaFilter === 'videos') return item.type === 'video'
            return true
          })
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          
          if (combinedMedia.length === 0) {
            return (
              <div className="text-center py-12 text-gray-400">
                <Image className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>
                  {mediaFilter === 'videos' 
                    ? 'No videos yet. Select an image and generate your first video!'
                    : mediaFilter === 'images'
                    ? 'No artwork yet. Generate your first album cover!'
                    : 'No media yet. Start by generating some artwork!'}
                </p>
              </div>
            )
          }
          
          return (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {combinedMedia.map((item) => {
                const metadata = JSON.parse(item.metadata || '{}')
                
                if (item.type === 'image') {
                  const modelMap: Record<string, string> = {
                    'flux-schnell': 'FLUX Schnell',
                    'flux-dev': 'FLUX Dev',
                    'flux-pro': 'FLUX Pro',
                    'stable-diffusion-xl': 'Stable Diffusion XL'
                  }
                  const modelName = modelMap[metadata.model] || metadata.model || 'Unknown model'
                  
                  return (
                    <div
                      key={item.id}
                      className="relative group rounded-lg overflow-hidden bg-gray-800 transition-all duration-200 hover:scale-105"
                    >
                      <div className="aspect-square">
                        <img 
                          src={item.url} 
                          alt="Artwork" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                          <div className="text-xs font-medium mb-1">{modelName}</div>
                          <div className="text-xs opacity-75 line-clamp-2">
                            {item.prompt || 'No prompt'}
                          </div>
                          <div className="text-xs opacity-50 mt-1">
                            {new Date(item.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm rounded px-2 py-1">
                        <span className="text-xs text-white font-medium">Image</span>
                      </div>
                    </div>
                  )
                } else {
                  // Video
                  const status = item.status || 'completed'
                  const isGenerating = status === 'generating'
                  const isFailed = status === 'failed'
                  
                  return (
                    <div 
                      key={item.id} 
                      className="relative group rounded-lg overflow-hidden bg-gray-800 transition-all duration-200 hover:scale-105"
                    >
                      <div className="aspect-square">
                        {isGenerating ? (
                          <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center">
                            <Loader2 className="w-12 h-12 text-purple-500 animate-spin mb-4" />
                            <p className="text-sm text-gray-400">Generating video...</p>
                            <p className="text-xs text-gray-500 mt-2">1-2 minutes</p>
                          </div>
                        ) : isFailed ? (
                          <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center">
                            <X className="w-12 h-12 text-red-500 mb-4" />
                            <p className="text-sm text-red-400">Failed</p>
                            <p className="text-xs text-gray-500 mt-2 px-4 text-center">{metadata.error || 'Unknown error'}</p>
                          </div>
                        ) : (
                          <video
                            autoPlay
                            muted
                            loop
                            playsInline
                            className="w-full h-full object-cover"
                          >
                            <source src={item.url} type="video/mp4" />
                          </video>
                        )}
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                          <div className="text-xs font-medium mb-1">{metadata.model || 'Unknown model'}</div>
                          <div className="text-xs opacity-75 line-clamp-2">
                            {item.prompt || 'No prompt'}
                          </div>
                          <div className="text-xs opacity-50 mt-1">
                            {metadata.duration && `${metadata.duration}s • `}
                            {new Date(item.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      {isGenerating && (
                        <div className="absolute top-2 right-2 bg-purple-500 rounded-full p-1">
                          <div className="w-4 h-4" />
                        </div>
                      )}
                      {isFailed && (
                        <div className="absolute top-2 right-2 bg-red-500 rounded-full p-1">
                          <X className="w-4 h-4 text-white" />
                        </div>
                      )}
                      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm rounded px-2 py-1">
                        <span className="text-xs text-white font-medium">Video</span>
                      </div>
                    </div>
                  )
                }
              })}
            </div>
          )
        })()}
      </Card>
    </div>
  )
}