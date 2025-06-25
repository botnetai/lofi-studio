import { useState } from 'react'
import { Upload, Music, Loader2 } from 'lucide-react'
import { useStore } from '~/lib/store'
import { uploadToR2, generateMusic } from '~/lib/api'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { TrackList } from './TrackList'
import { Select } from './ui/Select'
import { Textarea } from './ui/Textarea'
import { Input } from './ui/Input'
import { Label } from './ui/Label'

export function MusicSection() {
  const [activeTab, setActiveTab] = useState<'upload' | 'generate'>('upload')
  const [isLoading, setIsLoading] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState('')
  const [service, setService] = useState('goapi')
  
  const { addTrack } = useStore()

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    
    for (const file of files) {
      if (!file.type.startsWith('audio/')) continue
      
      setIsLoading(true)
      try {
        const url = await uploadToR2(file, 'audio')
        addTrack({
          id: crypto.randomUUID(),
          name: file.name,
          url,
          type: 'upload'
        })
      } catch (error) {
        console.error('Upload failed:', error)
      }
      setIsLoading(false)
    }
  }

  const handleGenerate = async () => {
    if (!prompt) return
    
    setIsLoading(true)
    try {
      const result = await generateMusic({
        service,
        prompt,
        title: title || 'Untitled',
        tags
      })
      
      if (result.tracks) {
        result.tracks.forEach((track: any) => {
          addTrack({
            id: crypto.randomUUID(),
            name: track.title || title || 'Generated Track',
            url: track.url,
            type: 'generated',
            service
          })
        })
      }
    } catch (error) {
      console.error('Generation failed:', error)
    }
    setIsLoading(false)
  }

  return (
    <Card>
      <h2 className="text-2xl font-bold mb-6 text-purple-400">1. Music</h2>
      
      <div className="flex gap-2 mb-6">
        <Button
          variant={activeTab === 'upload' ? 'primary' : 'secondary'}
          onClick={() => setActiveTab('upload')}
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload
        </Button>
        <Button
          variant={activeTab === 'generate' ? 'primary' : 'secondary'}
          onClick={() => setActiveTab('generate')}
        >
          <Music className="w-4 h-4 mr-2" />
          Generate
        </Button>
      </div>

      {activeTab === 'upload' ? (
        <div className="border-2 border-dashed border-gray-700 rounded-lg p-12 text-center hover:border-purple-500 transition-colors">
          <Upload className="w-12 h-12 mx-auto mb-4 text-gray-500" />
          <p className="text-gray-400 mb-2">Drop your music files here or click to browse</p>
          <p className="text-sm text-gray-500">Supports MP3, WAV, FLAC</p>
          <input
            type="file"
            accept="audio/*"
            multiple
            onChange={handleFileUpload}
            className="hidden"
            id="music-upload"
            disabled={isLoading}
          />
          <label htmlFor="music-upload">
            <Button as="span" className="mt-4" disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Choose Files'}
            </Button>
          </label>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <Label htmlFor="service">AI Model</Label>
            <Select
              value={service}
              onValueChange={setService}
              options={[
                { value: 'goapi', label: 'GoAPI (Udio)', description: 'High-quality music generation with Udio engine' },
                { value: 'udioapi', label: 'UdioAPI.pro', description: 'Alternative API for music generation' }
              ]}
              className="w-full mt-1"
            />
          </div>
          
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe your lofi beat..."
            className="w-full min-h-[100px]"
          />
          
          <div className="grid grid-cols-2 gap-4">
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Track title"
            />
            <Input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Tags (comma separated)"
            />
          </div>
          
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
              'Generate Music'
            )}
          </Button>
        </div>
      )}
      
      <TrackList />
    </Card>
  )
}