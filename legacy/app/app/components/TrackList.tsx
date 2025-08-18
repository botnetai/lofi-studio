import { Play, Pause, Check, Trash2 } from 'lucide-react'
import { useStore } from '~/lib/store'
import { Button } from './ui/Button'
import { useState, useRef, useEffect } from 'react'

export function TrackList() {
  const { tracks, selectedTrack, selectTrack, removeTrack } = useStore()
  const [playingTrack, setPlayingTrack] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (audioRef.current) {
      if (playingTrack) {
        const track = tracks.find(t => t.id === playingTrack)
        if (track) {
          audioRef.current.src = track.url
          audioRef.current.play()
        }
      } else {
        audioRef.current.pause()
      }
    }
  }, [playingTrack, tracks])

  if (tracks.length === 0) return null

  return (
    <div className="mt-6 space-y-2">
      <h3 className="text-sm font-medium text-gray-400 mb-3">Tracks</h3>
      {tracks.map((track) => (
        <div
          key={track.id}
          className={`flex items-center gap-3 p-3 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors ${
            selectedTrack === track.id ? 'ring-2 ring-purple-500' : ''
          }`}
        >
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setPlayingTrack(playingTrack === track.id ? null : track.id)}
            className="p-2"
          >
            {playingTrack === track.id ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </Button>
          
          <div className="flex-1">
            <p className="font-medium">{track.name}</p>
            <p className="text-xs text-gray-500">
              {track.type === 'generated' ? `Generated (${track.service})` : 'Uploaded'}
            </p>
          </div>
          
          <Button
            size="sm"
            variant={selectedTrack === track.id ? 'primary' : 'secondary'}
            onClick={() => selectTrack(track.id === selectedTrack ? null : track.id)}
          >
            {selectedTrack === track.id ? (
              <Check className="w-4 h-4" />
            ) : (
              'Select'
            )}
          </Button>
          
          <Button
            size="sm"
            variant="ghost"
            onClick={() => removeTrack(track.id)}
            className="text-red-400 hover:text-red-300"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
      
      <audio ref={audioRef} onEnded={() => setPlayingTrack(null)} />
    </div>
  )
}