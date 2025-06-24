import { useEffect } from 'react'
import { useMusicStore } from '../store/musicStore'
import { Button } from './Button'
import { Card } from './Card'
import { Play, Pause, Download, Check } from 'lucide-react'
import { clsx } from 'clsx'

export function MusicLibrary() {
  const { songs, isLoading, error, selectedSongs, fetchSongs, toggleSongSelection } = useMusicStore()
  
  useEffect(() => {
    fetchSongs()
    
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchSongs, 5000)
    return () => clearInterval(interval)
  }, [fetchSongs])
  
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = (seconds % 60).toString().padStart(2, '0')
    return `${mins}:${secs}`
  }
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  
  if (error) {
    return (
      <Card className="text-center py-12">
        <p className="text-red-500 mb-4">Error: {error}</p>
        <Button onClick={fetchSongs} variant="secondary">Retry</Button>
      </Card>
    )
  }
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Music Library</h2>
        <Button onClick={fetchSongs} variant="ghost" size="sm">
          Refresh
        </Button>
      </div>
      
      {isLoading && songs.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-muted-foreground">Loading songs...</p>
        </Card>
      ) : songs.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-muted-foreground">No songs yet. Generate some music to get started!</p>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left pb-3 px-2 w-10"></th>
                <th className="text-left pb-3 px-2">Title</th>
                <th className="text-left pb-3 px-2">Status</th>
                <th className="text-left pb-3 px-2">Duration</th>
                <th className="text-left pb-3 px-2">Created</th>
                <th className="text-left pb-3 px-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {songs.map((song) => {
                const metadata = typeof song.metadata === 'string' 
                  ? JSON.parse(song.metadata) 
                  : song.metadata || {}
                const isSelected = selectedSongs.includes(song.id)
                const isGenerating = song.status === 'generating' || metadata.status === 'generating'
                
                return (
                  <tr 
                    key={song.id} 
                    className="border-b border-border/50 hover:bg-secondary/50 transition-colors"
                  >
                    <td className="py-3 px-2">
                      <button
                        onClick={() => toggleSongSelection(song.id)}
                        className={clsx(
                          'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                          isSelected 
                            ? 'bg-primary border-primary' 
                            : 'border-border hover:border-primary'
                        )}
                        disabled={isGenerating}
                      >
                        {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                      </button>
                    </td>
                    <td className="py-3 px-2">
                      <div>
                        <p className="font-medium">{song.name}</p>
                        {metadata.prompt && (
                          <p className="text-sm text-muted-foreground">{metadata.prompt}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <span className={clsx(
                        'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                        {
                          'bg-yellow-500/20 text-yellow-500': isGenerating,
                          'bg-green-500/20 text-green-500': song.status === 'completed' || metadata.status === 'completed',
                          'bg-gray-500/20 text-gray-500': song.status === 'pending',
                        }
                      )}>
                        {isGenerating ? 'Generating...' : song.status || 'pending'}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      {formatDuration(song.duration || metadata.duration)}
                    </td>
                    <td className="py-3 px-2 text-sm text-muted-foreground">
                      {formatDate(song.created_at)}
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        {!isGenerating && song.url && (
                          <>
                            <Button size="sm" variant="ghost">
                              <Play className="w-4 h-4" />
                            </Button>
                            <a href={song.url} download>
                              <Button size="sm" variant="ghost">
                                <Download className="w-4 h-4" />
                              </Button>
                            </a>
                          </>
                        )}
                        {isGenerating && metadata.workId && (
                          <span className="text-xs text-muted-foreground">
                            ID: {metadata.workId.slice(0, 8)}...
                          </span>
                        )}
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
  )
}