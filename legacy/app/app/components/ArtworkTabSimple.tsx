import { useState, useEffect, useCallback, useRef } from 'react'
import { Image, Loader2, Check, X, RefreshCw } from 'lucide-react'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { Textarea } from './ui/Textarea'
import { Label } from './ui/Label'
import { Select } from './ui/Select'
import { Checkbox } from './ui/Checkbox'
import { cn } from '../lib/utils'
import { MediaModal } from './ui/MediaModal'
import { DynamicGenerationForm } from './DynamicGenerationForm'

// Video Card Component with proper hover handling
function VideoCard({ video, metadata, onClick }: { video: any; metadata: any; onClick: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isHovered, setIsHovered] = useState(false)
  
  useEffect(() => {
    if (videoRef.current) {
      if (isHovered) {
        videoRef.current.play().catch(() => {})
      } else {
        videoRef.current.pause()
        videoRef.current.currentTime = 0
      }
    }
  }, [isHovered])
  
  return (
    <div
      className="relative group rounded-lg overflow-hidden bg-gray-800 transition-all duration-200 hover:scale-105 cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      <div className="aspect-square">
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          className="w-full h-full object-cover"
        >
          <source src={video.url} type="video/mp4" />
        </video>
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
          <div className="text-xs font-medium mb-1">{metadata.model || 'Unknown model'}</div>
          <div className="text-xs opacity-75 line-clamp-2">
            {video.prompt || 'No prompt'}
          </div>
          <div className="text-xs opacity-50 mt-1">
            {metadata.duration && `${metadata.duration}s • `}
            {new Date(video.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>
      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm rounded px-2 py-1">
        <span className="text-xs text-white font-medium">Video</span>
      </div>
    </div>
  )
}

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


export function ArtworkTabSimple() {
  // State for generation mode
  const [imageMode, setImageMode] = useState<'text-to-image' | 'image-to-image'>('text-to-image')
  const [selectedImageForArtwork, setSelectedImageForArtwork] = useState<string | null>(null)
  
  // Media library state
  const [allArtwork, setAllArtwork] = useState<Artwork[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [mediaFilter, setMediaFilter] = useState<'all' | 'images' | 'videos'>('all')
  
  // UI state
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedMedia, setSelectedMedia] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  
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
  
  // Handle image generation
  const handleImageGenerate = async (modelId: string, params: any) => {
    setError('')
    setSuccess('')
    
    try {
      // Extract proper parameters from dynamic form
      const body: any = {
        prompt: params.prompt || '',
        model: modelId,
        numImages: params.num_images || 4
      }
      
      // Add any additional parameters from the model schema
      Object.entries(params).forEach(([key, value]) => {
        if (key !== 'prompt' && key !== 'num_images' && value !== undefined) {
          body[key] = value
        }
      })
      
      if (imageMode === 'image-to-image') {
        body.imageId = params.imageId
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
      setSelectedImageForArtwork(null)
      fetchArtwork()
    } catch (error: any) {
      setError(error.message)
      throw error
    }
  }
  
  // Handle video generation
  const handleVideoGenerate = async (modelId: string, params: any) => {
    setError('')
    setSuccess('')
    
    try {
      // Map model ID to our expected format
      const modelParts = modelId.split('/')
      const modelKey = modelParts[modelParts.length - 1]
        .replace('/image-to-video', '')
        .replace('/standard', '')
        .replace('/pro', '')
        .replace('/master', '')
      
      const response = await fetch('/api/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageId: params.imageId,
          prompt: params.prompt || '',
          model: modelKey,
          duration: params.duration || 5,
          mode: params.mode || 'standard',
          ...params
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
      
      setTimeout(() => fetchVideos(), 500)
    } catch (error: any) {
      setError(error.message)
      throw error
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
        {/* Image Generation Card */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-6">Generate Image</h2>
          
          <div className="space-y-4">
            {/* Mode Selector */}
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
            
            {/* Embed the form content without the card wrapper */}
            <DynamicGenerationForm
              category={imageMode}
              onGenerate={handleImageGenerate}
              selectedImage={selectedImageForArtwork}
              allImages={allArtwork}
              embedded={true}
            />
          </div>
        </Card>
        
        {/* Video Generation Card */}
        <DynamicGenerationForm
          category="image-to-video"
          onGenerate={handleVideoGenerate}
          selectedImage={null}
          allImages={allArtwork}
        />
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
                      className="relative group rounded-lg overflow-hidden bg-gray-800 transition-all duration-200 hover:scale-105 cursor-pointer"
                      onClick={() => {
                        setSelectedMedia({ ...item, type: 'image' })
                        setIsModalOpen(true)
                      }}
                    >
                      <div className="aspect-square">
                        <img 
                          src={item.url} 
                          alt="Artwork" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
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
                  
                  if (isGenerating || isFailed) {
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
                          ) : (
                            <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center">
                              <X className="w-12 h-12 text-red-500 mb-4" />
                              <p className="text-sm text-red-400">Failed</p>
                              <p className="text-xs text-gray-500 mt-2 px-4 text-center">{metadata.error || 'Unknown error'}</p>
                            </div>
                          )}
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
                      </div>
                    )
                  }
                  
                  return (
                    <VideoCard 
                      key={item.id}
                      video={item} 
                      metadata={metadata}
                      onClick={() => {
                        setSelectedMedia({ ...item, type: 'video' })
                        setIsModalOpen(true)
                      }}
                    />
                  )
                }
              })}
            </div>
          )
        })()}
      </Card>
      
      {/* Media Modal */}
      <MediaModal 
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedMedia(null)
        }}
        media={selectedMedia || {}}
      />
    </div>
  )
}