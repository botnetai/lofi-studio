import { useState } from 'react'
import { Image, Upload, Loader2 } from 'lucide-react'
import { useStore } from '~/lib/store'
import { uploadToR2, generateArtwork } from '~/lib/api'
import { Button } from './ui/Button'
import { Card } from './ui/Card'

interface ArtworkSectionProps {
  disabled?: boolean
}

export function ArtworkSection({ disabled }: ArtworkSectionProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState('anime')
  
  const { artwork, setArtwork } = useStore()

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    
    setIsLoading(true)
    try {
      const url = await uploadToR2(file, 'artwork')
      setArtwork(url)
    } catch (error) {
      console.error('Upload failed:', error)
    }
    setIsLoading(false)
  }

  const handleGenerate = async () => {
    if (!prompt) return
    
    setIsLoading(true)
    try {
      const url = await generateArtwork({
        prompt: `${prompt}, ${style} style, album cover, square format, high quality`,
        style
      })
      setArtwork(url)
    } catch (error) {
      console.error('Generation failed:', error)
    }
    setIsLoading(false)
  }

  return (
    <Card className={disabled ? 'opacity-50 pointer-events-none' : ''}>
      <h2 className="text-2xl font-bold mb-6 text-pink-400">2. Album Artwork</h2>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <div className="aspect-square bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center">
            {artwork ? (
              <img src={artwork} alt="Album artwork" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center">
                <Image className="w-16 h-16 mx-auto mb-4 text-gray-500" />
                <p className="text-gray-500">No artwork yet</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="space-y-4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe your album cover..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 min-h-[120px] resize-none"
          />
          
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
          >
            <option value="anime">Anime/Manga Style</option>
            <option value="realistic">Realistic</option>
            <option value="watercolor">Watercolor</option>
            <option value="digital">Digital Art</option>
            <option value="vintage">Vintage/Retro</option>
          </select>
          
          <Button
            onClick={handleGenerate}
            disabled={!prompt || isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Artwork'
            )}
          </Button>
          
          <div className="pt-4 border-t border-gray-700">
            <p className="text-sm text-gray-400 mb-2">Or upload your own:</p>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
              id="artwork-upload"
              disabled={isLoading}
            />
            <label htmlFor="artwork-upload">
              <Button as="span" variant="secondary" className="w-full" disabled={isLoading}>
                <Upload className="w-4 h-4 mr-2" />
                Upload Image
              </Button>
            </label>
          </div>
        </div>
      </div>
    </Card>
  )
}