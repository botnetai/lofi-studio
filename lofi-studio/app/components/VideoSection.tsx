import { useState } from 'react'
import { Video, Loader2 } from 'lucide-react'
import { useStore } from '~/lib/store'
import { generateVideo } from '~/lib/api'
import { Button } from './ui/Button'
import { Card } from './ui/Card'

interface VideoSectionProps {
  disabled?: boolean
}

export function VideoSection({ disabled }: VideoSectionProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [animationStyle, setAnimationStyle] = useState('subtle')
  const [duration, setDuration] = useState(30)
  
  const { video, setVideo, artwork, tracks, selectedTrack } = useStore()

  const handleGenerate = async () => {
    if (!artwork || !selectedTrack) return
    
    const track = tracks.find(t => t.id === selectedTrack)
    if (!track) return
    
    setIsLoading(true)
    try {
      const url = await generateVideo({
        imageUrl: artwork,
        audioUrl: track.url,
        animationStyle,
        duration
      })
      setVideo(url)
    } catch (error) {
      console.error('Generation failed:', error)
    }
    setIsLoading(false)
  }

  return (
    <Card className={disabled ? 'opacity-50 pointer-events-none' : ''}>
      <h2 className="text-2xl font-bold mb-6 text-blue-400">3. Animated Video</h2>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <div className="aspect-video bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center">
            {video ? (
              <video src={video} controls loop className="w-full h-full object-cover" />
            ) : (
              <div className="text-center">
                <Video className="w-16 h-16 mx-auto mb-4 text-gray-500" />
                <p className="text-gray-500">No video yet</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Animation Style
            </label>
            <select
              value={animationStyle}
              onChange={(e) => setAnimationStyle(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
            >
              <option value="subtle">Subtle Movement</option>
              <option value="particles">Floating Particles</option>
              <option value="rain">Rain Effect</option>
              <option value="glitch">Glitch Effect</option>
              <option value="zoom">Slow Zoom</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Duration (seconds)
            </label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              min={10}
              max={300}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
            />
          </div>
          
          <Button
            onClick={handleGenerate}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating Video...
              </>
            ) : (
              'Create Video'
            )}
          </Button>
          
          <p className="text-sm text-gray-500">
            This will create an animated video using your artwork and selected track.
          </p>
        </div>
      </div>
    </Card>
  )
}