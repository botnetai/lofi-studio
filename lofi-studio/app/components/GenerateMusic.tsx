import { useState } from 'react'
import { useMusicStore } from '../store/musicStore'
import { Button } from './ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card'
import { Input } from './ui/Input'
import { Label } from './ui/Label'
import { Textarea } from './ui/Textarea'
import { Checkbox } from './ui/Checkbox'
import { Music, Loader2 } from 'lucide-react'

export function GenerateMusic() {
  const { addSong, updateSong } = useMusicStore()
  const [isGenerating, setIsGenerating] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [customMode, setCustomMode] = useState(false)
  const [lyrics, setLyrics] = useState('')
  
  const generateMusic = async () => {
    if (!prompt.trim()) return
    
    setIsGenerating(true)
    try {
      const response = await fetch('/api/generate-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          custom_mode: customMode,
          lyrics: customMode ? lyrics : undefined,
          make_instrumental: !customMode || !lyrics
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate music')
      }
      
      // Poll for status
      if (data.workId) {
        pollStatus(data.workId, data.songId)
      }
      
      // Clear form
      setPrompt('')
      setLyrics('')
      
    } catch (error) {
      console.error('Error generating music:', error)
      alert(error.message)
    } finally {
      setIsGenerating(false)
    }
  }
  
  const pollStatus = async (workId: string, songId: string) => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/generate-music-status?workId=${workId}`)
        const data = await response.json()
        
        if (data.status === 'completed') {
          // Status endpoint handles the download and update
          // Just refresh the songs list
          const songsResponse = await fetch('/api/songs')
          const songs = await songsResponse.json()
          const updatedSong = songs.find((s: any) => s.id === songId)
          if (updatedSong) {
            updateSong(songId, updatedSong)
          }
        } else if (data.status === 'failed') {
          updateSong(songId, { status: 'failed' })
        } else {
          // Continue polling
          setTimeout(checkStatus, 3000)
        }
      } catch (error) {
        console.error('Error checking status:', error)
      }
    }
    
    // Start polling
    setTimeout(checkStatus, 3000)
  }
  
  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music className="h-5 w-5" />
          Generate Music
        </CardTitle>
        <CardDescription>
          Create AI-powered lofi beats with custom prompts and lyrics
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="prompt">Music Prompt</Label>
          <Input
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., chill lofi beat with soft piano and rain sounds"
          />
          <p className="text-xs text-muted-foreground">
            Describe the style, mood, and instruments you want
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Checkbox
            id="custom-mode"
            checked={customMode}
            onCheckedChange={setCustomMode}
          />
          <Label 
            htmlFor="custom-mode" 
            className="text-sm font-normal cursor-pointer"
          >
            Add custom lyrics
          </Label>
        </div>
        
        {customMode && (
          <div className="space-y-2">
            <Label htmlFor="lyrics">Lyrics (optional)</Label>
            <Textarea
              id="lyrics"
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder="Enter your lyrics here..."
              className="min-h-[120px]"
            />
          </div>
        )}
        
        <Button 
          onClick={generateMusic}
          disabled={isGenerating || !prompt.trim()}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Music className="mr-2 h-4 w-4" />
              Generate Music
            </>
          )}
        </Button>
        
        <p className="text-center text-xs text-muted-foreground">
          Powered by Udio AI • Generation takes 1-3 minutes
        </p>
      </CardContent>
    </Card>
  )
}