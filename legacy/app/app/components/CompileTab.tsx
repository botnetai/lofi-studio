import React, { useState, useEffect } from 'react'
import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Label } from './ui/Label'
import { Checkbox } from './ui/Checkbox'
import { useMusicStore } from '../store/musicStore'
import { useArtworkStore } from '../lib/artwork-store'

interface Album {
  id: string
  title: string
  artist: string
  genre?: string
  cover_art_id?: string | null
  artwork_id?: string | null
  song_ids: string[]
  status: string
  created_at: string
  track_count?: number
  distrokid_metadata?: any
}

export function CompileTab({ preselectedSongs = [] }: { preselectedSongs?: string[] }) {
  const [albumTitle, setAlbumTitle] = useState('')
  const [albumArtist, setAlbumArtist] = useState('')
  const [selectedArtwork, setSelectedArtwork] = useState<string | null>(null)
  const [albums, setAlbums] = useState<Album[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [isPreparing, setIsPreparing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const { songs, fetchSongs, selectedSongs, toggleSongSelection, clearSelection, setSelectedSongs } = useMusicStore()
  const { artworks, fetchArtwork } = useArtworkStore()

  useEffect(() => {
    fetchSongs()
    fetchArtwork()
    fetchAlbums()
    
    // If there are preselected songs, set them as selected
    if (preselectedSongs.length > 0) {
      setSelectedSongs(preselectedSongs)
    }
  }, [preselectedSongs])

  const fetchAlbums = async () => {
    try {
      const response = await fetch('/api/albums')
      const data = await response.json()
      setAlbums(data)
    } catch (err) {
      console.error('Failed to fetch albums:', err)
    }
  }

  const createAlbum = async () => {
    if (!albumTitle || selectedSongs.length === 0) {
      setError('Please enter album title and select at least one song')
      return
    }

    setIsCreating(true)
    setError(null)
    setSuccess(null)

    try {
      // First create the album
      const response = await fetch('/api/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: albumTitle,
          artist: albumArtist || 'Lofi Studio',
          songIds: selectedSongs,
          artworkId: selectedArtwork
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create album')
      }

      // Then prepare it for DistroKid
      await prepareForDistroKid(data.albumId || data.id)
      
      setSuccess('Album created and prepared for DistroKid!')
      setAlbumTitle('')
      setAlbumArtist('')
      clearSelection()
      setSelectedArtwork(null)
      fetchAlbums()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsCreating(false)
    }
  }

  const prepareForDistroKid = async (albumId: string) => {
    setIsPreparing(true)
    try {
      const response = await fetch('/api/prepare-distrokid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ albumId })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to prepare for DistroKid')
      }

      // Create download link for DistroKid package
      const packageBlob = new Blob([JSON.stringify(data.distroPackage, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(packageBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `distrokid-${albumId}.json`
      a.click()
      URL.revokeObjectURL(url)

      return data
    } catch (err: any) {
      throw err
    } finally {
      setIsPreparing(false)
    }
  }

  const prepareForDistribution = async (albumId: string) => {
    try {
      const response = await fetch('/api/distribution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ albumId })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to prepare for distribution')
      }

      setSuccess('Album prepared for distribution!')
      fetchAlbums()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const selectedSongsList = songs.filter(song => selectedSongs.includes(song.id))
  const totalDuration = selectedSongsList.reduce((sum, song) => sum + (song.duration || 0), 0)

  return (
    <div className="space-y-6">
      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Album Creation Form */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-6">Create Album for DistroKid</h2>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="album-title">Album Title</Label>
              <Input
                id="album-title"
                type="text"
                value={albumTitle}
                onChange={(e) => setAlbumTitle(e.target.value)}
                placeholder="e.g., Midnight Vibes Vol. 1"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="album-artist">Artist Name</Label>
              <Input
                id="album-artist"
                type="text"
                value={albumArtist}
                onChange={(e) => setAlbumArtist(e.target.value)}
                placeholder="e.g., Lofi Studio"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Selected Tracks</Label>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedSongs.length} tracks selected
              </p>
              {selectedSongs.length > 0 && (
                <div className="mt-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground max-h-24 overflow-y-auto">
                  {songs.filter(s => selectedSongs.includes(s.id)).map(s => s.name).join(', ')}
                </div>
              )}
              {selectedSongs.length === 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  Go to Music tab to select tracks
                </p>
              )}
            </div>

            <div>
              <Label>Album Artwork</Label>
              {selectedArtwork ? (
                <div className="mt-2">
                  <img 
                    src={artworks.find(a => a.id === selectedArtwork)?.url} 
                    alt="Selected artwork" 
                    className="w-40 h-40 object-cover rounded-lg"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedArtwork(null)}
                    className="mt-2"
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">
                  Select artwork below
                </p>
              )}
            </div>

            <Button
              onClick={createAlbum}
              disabled={!albumTitle || selectedSongs.length === 0 || isCreating}
              className="w-full"
            >
              {isCreating ? 'Creating...' : 'Create Album & Prepare for DistroKid'}
            </Button>

            <div className="pt-4 border-t">
              <Button
                variant="secondary"
                disabled
                className="w-full opacity-60"
              >
                Auto-Publish to DistroKid (Requires Desktop App)
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Download Musikai desktop app for automated publishing
              </p>
            </div>
          </div>
        </Card>

        {/* Right Column - Artwork Selection */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Select Artwork</h2>
          {artworks.length === 0 ? (
            <p className="text-muted-foreground">No artwork available. Generate some artwork first!</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {artworks.slice(0, 4).map(artwork => (
                <div
                  key={artwork.id}
                  className={`cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                    selectedArtwork === artwork.id
                      ? 'border-primary ring-2 ring-primary ring-offset-2'
                      : 'border-transparent hover:border-muted-foreground/50'
                  }`}
                  onClick={() => setSelectedArtwork(artwork.id)}
                >
                  <img
                    src={artwork.url}
                    alt={artwork.prompt || 'Artwork'}
                    className="w-full h-32 object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg">
          {success}
        </div>
      )}

      {/* Published Albums Section */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Published Albums</h2>
        {albums.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No albums published yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {albums.map(album => (
              <div key={album.id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <h3 className="font-semibold">{album.title}</h3>
                <p className="text-sm text-muted-foreground">by {album.artist}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">
                    {album.track_count || album.song_ids?.length || 0} tracks
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    album.status === 'published' 
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                      : album.status === 'ready_for_distribution'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
                  }`}>
                    {album.status === 'published' ? 'Published' : 
                     album.status === 'ready_for_distribution' ? 'Ready' : 
                     'Draft'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}