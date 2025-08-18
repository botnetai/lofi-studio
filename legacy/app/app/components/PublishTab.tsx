import { useState, useEffect } from 'react'
import { Share2, Youtube, Music2, Loader2, Download, ExternalLink, Clock } from 'lucide-react'
import { useStore } from '~/lib/store'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { Input } from './ui/Input'
import { Label } from './ui/Label'
import { Textarea } from './ui/Textarea'

interface Album {
  id: string
  title: string
  artist: string
  song_ids: string
  artwork_id?: string
  status: string
  created_at: string
  distrokid_metadata?: string
}

interface Video {
  id: string
  url: string
  metadata?: string
  created_at: string
}

interface PublishingHistoryItem {
  id: string
  platform: string
  album_id: string
  published_at: string
  status: string
  metadata?: string
}

export function PublishTab() {
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Albums and videos
  const [albums, setAlbums] = useState<Album[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [publishingHistory, setPublishingHistory] = useState<PublishingHistoryItem[]>([])
  
  // YouTube Publishing
  const [selectedAlbumForYT, setSelectedAlbumForYT] = useState('')
  const [ytVideoStyle, setYtVideoStyle] = useState('static')
  const [selectedVideoLoop, setSelectedVideoLoop] = useState('')
  const [isPublishingToYT, setIsPublishingToYT] = useState(false)
  const [ytConnected, setYtConnected] = useState(false)
  
  // TikTok Publishing
  const [selectedTrackForTikTok, setSelectedTrackForTikTok] = useState('')
  const [tiktokClipDuration, setTiktokClipDuration] = useState('15')
  
  // DistroKid Status
  const [distrokidAlbums, setDistrokidAlbums] = useState<Album[]>([])
  
  const { tracks } = useStore()

  useEffect(() => {
    fetchAlbums()
    fetchVideos()
    fetchPublishingHistory()
    checkYouTubeConnection()
  }, [])

  const fetchAlbums = async () => {
    try {
      const response = await fetch('/api/albums')
      const data = await response.json()
      setAlbums(data)
      
      // Filter albums ready for DistroKid
      const readyAlbums = data.filter((album: Album) => 
        album.status === 'ready_for_distribution' || album.distrokid_metadata
      )
      setDistrokidAlbums(readyAlbums)
    } catch (error) {
      console.error('Failed to fetch albums:', error)
    }
  }

  const fetchVideos = async () => {
    try {
      const response = await fetch('/api/videos')
      const data = await response.json()
      setVideos(data)
    } catch (error) {
      console.error('Failed to fetch videos:', error)
    }
  }

  const fetchPublishingHistory = async () => {
    try {
      const response = await fetch('/api/publishing-history')
      const data = await response.json()
      setPublishingHistory(data)
    } catch (error) {
      console.error('Failed to fetch publishing history:', error)
    }
  }

  const checkYouTubeConnection = async () => {
    try {
      const response = await fetch('/api/youtube/status')
      const data = await response.json()
      setYtConnected(data.connected || false)
    } catch (error) {
      console.error('Failed to check YouTube connection:', error)
    }
  }

  const connectYouTube = () => {
    window.location.href = '/api/youtube/auth'
  }

  const publishToYouTube = async () => {
    if (!selectedAlbumForYT) {
      setError('Please select an album')
      return
    }

    setIsPublishingToYT(true)
    setError('')
    setSuccess('')

    try {
      const album = albums.find(a => a.id === selectedAlbumForYT)
      if (!album) throw new Error('Album not found')

      // Get album songs
      const albumSongs = await fetch(`/api/albums/${selectedAlbumForYT}/songs`)
      const songsData = await albumSongs.json()

      // Prepare YouTube upload
      const response = await fetch('/api/youtube/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          albumId: selectedAlbumForYT,
          videoStyle: ytVideoStyle,
          videoLoopId: selectedVideoLoop,
          album: album,
          songs: songsData
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to prepare YouTube upload')
      }

      // Handle video generation response
      if (data.video && data.video.status === 'rendering') {
        setSuccess(`Video is being generated! ${data.video.estimatedTime}. Video ID: ${data.video.renderingId}`)
        localStorage.setItem(`video-rendering-${selectedAlbumForYT}`, data.video.renderingId)
      } else if (data.video && data.video.videoUrl) {
        // Video is ready, create download package
        const uploadInfo = `YouTube Upload Information
==========================

Title: ${data.title}

Description:
${data.description}

Tags: ${data.tags.join(', ')}

Category: Music (ID: 10)
Privacy: Private (change after upload if desired)

Generated Video: ${data.video.videoUrl}

Instructions:
1. Download the video from the link above
2. Go to YouTube Studio (studio.youtube.com)
3. Click "Create" → "Upload videos"
4. Select the downloaded video
5. Copy and paste the title, description, and tags
6. Set category to "Music"
7. Upload!`

        // Create download link
        const blob = new Blob([uploadInfo], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `youtube-upload-${album.title.replace(/\s+/g, '-')}.txt`
        a.click()
        URL.revokeObjectURL(url)
        
        setSuccess('YouTube upload package downloaded! Check your downloads folder.')
      } else {
        // Manual video creation needed
        const uploadInfo = `YouTube Upload Information
==========================

Title: ${data.title}

Description:
${data.description}

Tags: ${data.tags.join(', ')}

Category: Music (ID: 10)
Privacy: Private (change after upload if desired)

Manual Video Creation Required
Video Style: ${ytVideoStyle}

Instructions:
1. Create video using your preferred editor
2. Use album artwork and audio files
3. Export as MP4 (1920x1080)
4. Upload to YouTube Studio with above metadata`

        const blob = new Blob([uploadInfo], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `youtube-upload-${album.title.replace(/\s+/g, '-')}.txt`
        a.click()
        URL.revokeObjectURL(url)
        
        setSuccess('YouTube metadata package downloaded! Check your downloads folder.')
      }
    } catch (error: any) {
      setError(error.message)
    } finally {
      setIsPublishingToYT(false)
    }
  }

  const updateDistributionStatus = async (albumId: string, status: string, upc?: string, platformIds?: any) => {
    try {
      const response = await fetch('/api/albums/distribution-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          albumId,
          status,
          upc,
          platform_ids: platformIds
        })
      })

      if (response.ok) {
        setSuccess('Distribution status updated')
        fetchAlbums()
      }
    } catch (error) {
      setError('Failed to update distribution status')
    }
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-500/10 border border-green-500/50 text-green-300 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* YouTube Publishing */}
        <Card>
          <div className="flex items-center gap-2 mb-6">
            <Youtube className="w-6 h-6 text-red-500" />
            <h2 className="text-xl font-bold">Publish to YouTube</h2>
          </div>

          <div className="space-y-4">
            {!ytConnected && (
              <div className="bg-yellow-500/10 border border-yellow-500/50 p-4 rounded-lg">
                <p className="text-sm text-yellow-300 mb-3">
                  YouTube requires OAuth2 authentication for automated uploads.
                </p>
                <Button 
                  onClick={connectYouTube}
                  variant="outline"
                  size="sm"
                >
                  <Youtube className="w-4 h-4 mr-2" />
                  Connect YouTube Account
                </Button>
              </div>
            )}

            <div>
              <Label htmlFor="album-select">Select Album</Label>
              <select
                id="album-select"
                value={selectedAlbumForYT}
                onChange={(e) => setSelectedAlbumForYT(e.target.value)}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
              >
                <option value="">Choose an album</option>
                {albums.map(album => (
                  <option key={album.id} value={album.id}>
                    {album.title} - {album.artist}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="video-style">Video Style</Label>
              <select
                id="video-style"
                value={ytVideoStyle}
                onChange={(e) => setYtVideoStyle(e.target.value)}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
              >
                <option value="static">Static Image with Audio Visualizer</option>
                <option value="animated">Animated Loop Video</option>
              </select>
            </div>

            {ytVideoStyle === 'animated' && (
              <div>
                <Label htmlFor="video-loop">Select Loop Video</Label>
                <select
                  id="video-loop"
                  value={selectedVideoLoop}
                  onChange={(e) => setSelectedVideoLoop(e.target.value)}
                  className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
                >
                  <option value="">Select a video to loop</option>
                  {videos.map(video => (
                    <option key={video.id} value={video.id}>
                      Video generated on {new Date(video.created_at).toLocaleDateString()}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-gray-400 mt-1">
                  This video will loop for the entire duration of the album
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <Button
                onClick={publishToYouTube}
                disabled={!selectedAlbumForYT || isPublishingToYT}
                className="w-full"
              >
                {isPublishingToYT ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Preparing...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Generate Upload Package
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={() => window.open('https://studio.youtube.com', '_blank')}
                className="w-full"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open YouTube Studio
              </Button>
            </div>

            <p className="text-sm text-gray-400">
              Click "Generate Upload Package" to prepare your video metadata, 
              then upload manually via YouTube Studio.
            </p>
          </div>
        </Card>

        {/* TikTok Publishing */}
        <Card>
          <div className="flex items-center gap-2 mb-6">
            <Music2 className="w-6 h-6" />
            <h2 className="text-xl font-bold">Publish to TikTok</h2>
          </div>

          <div className="space-y-4">
            <p className="text-gray-400">
              Create short clips and publish to TikTok
            </p>

            <div>
              <Label htmlFor="tiktok-track">Select Track</Label>
              <select
                id="tiktok-track"
                value={selectedTrackForTikTok}
                onChange={(e) => setSelectedTrackForTikTok(e.target.value)}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
              >
                <option value="">Select a track</option>
                {tracks.filter(t => t.status === 'completed').map(track => (
                  <option key={track.id} value={track.id}>{track.name}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="clip-duration">Clip Duration</Label>
              <select
                id="clip-duration"
                value={tiktokClipDuration}
                onChange={(e) => setTiktokClipDuration(e.target.value)}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
              >
                <option value="15">15 seconds</option>
                <option value="30">30 seconds</option>
                <option value="60">60 seconds</option>
              </select>
            </div>

            <Button className="w-full" disabled>
              Connect TikTok Account (Coming Soon)
            </Button>

            <p className="text-sm text-gray-400">
              TikTok API integration will be available soon
            </p>
          </div>
        </Card>
      </div>

      {/* DistroKid Ready Albums */}
      <Card>
        <h2 className="text-xl font-bold mb-6">DistroKid Ready Albums</h2>
        
        {distrokidAlbums.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p>No albums ready for DistroKid distribution.</p>
            <p className="text-sm mt-2">Create and prepare albums in the Distribute tab first.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {distrokidAlbums.map(album => {
              const metadata = album.distrokid_metadata ? JSON.parse(album.distrokid_metadata) : null
              return (
                <div key={album.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{album.title}</h3>
                      <p className="text-sm text-gray-400">{album.artist}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Created: {new Date(album.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs ${
                        album.status === 'published' 
                          ? 'bg-green-500/20 text-green-300' 
                          : 'bg-yellow-500/20 text-yellow-300'
                      }`}>
                        {album.status === 'published' ? 'Published' : 'Ready'}
                      </span>
                      {metadata?.upc && (
                        <p className="text-xs text-gray-400 mt-2">UPC: {metadata.upc}</p>
                      )}
                    </div>
                  </div>
                  
                  {album.status !== 'published' && (
                    <div className="mt-4 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const upc = prompt('Enter UPC code after publishing:')
                          if (upc) {
                            updateDistributionStatus(album.id, 'published', upc)
                          }
                        }}
                      >
                        Mark as Published
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open('https://distrokid.com', '_blank')}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Open DistroKid
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Publishing History */}
      <Card>
        <h2 className="text-xl font-bold mb-6">Publishing History</h2>
        
        {publishingHistory.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p>No content published yet.</p>
            <p className="text-sm mt-2">Connect your accounts to start publishing.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4">Platform</th>
                  <th className="text-left py-3 px-4">Album</th>
                  <th className="text-left py-3 px-4">Date</th>
                  <th className="text-left py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {publishingHistory.map(item => {
                  const album = albums.find(a => a.id === item.album_id)
                  return (
                    <tr key={item.id} className="border-b border-gray-800">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {item.platform === 'youtube' && <Youtube className="w-4 h-4 text-red-500" />}
                          {item.platform === 'distrokid' && <Music2 className="w-4 h-4 text-green-500" />}
                          <span className="capitalize">{item.platform}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">{album?.title || 'Unknown'}</td>
                      <td className="py-3 px-4 text-gray-400">
                        {new Date(item.published_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-1 rounded text-xs ${
                          item.status === 'success' 
                            ? 'bg-green-500/20 text-green-300' 
                            : 'bg-yellow-500/20 text-yellow-300'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}