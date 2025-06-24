import { useState } from 'react'
import { Share2, Youtube, Music2, Loader2 } from 'lucide-react'
import { useStore } from '~/lib/store'
import { publishToDistroKid, publishToYouTube } from '~/lib/api'
import { Button } from './ui/Button'
import { Card } from './ui/Card'

interface PublishSectionProps {
  disabled?: boolean
}

export function PublishSection({ disabled }: PublishSectionProps) {
  const [isLoadingDistro, setIsLoadingDistro] = useState(false)
  const [isLoadingYT, setIsLoadingYT] = useState(false)
  
  // DistroKid fields
  const [artistName, setArtistName] = useState('')
  const [albumName, setAlbumName] = useState('')
  const [releaseDate, setReleaseDate] = useState('')
  const [releaseType, setReleaseType] = useState('single')
  const [credits, setCredits] = useState('')
  
  // YouTube fields
  const [ytTitle, setYtTitle] = useState('')
  const [ytDescription, setYtDescription] = useState('')
  const [ytTags, setYtTags] = useState('')
  const [ytCategory, setYtCategory] = useState('10')
  const [ytPrivacy, setYtPrivacy] = useState('public')
  
  const { tracks, selectedTrack, artwork, video } = useStore()

  const handleDistroKid = async () => {
    const track = tracks.find(t => t.id === selectedTrack)
    if (!track || !artwork) return
    
    setIsLoadingDistro(true)
    try {
      await publishToDistroKid({
        trackUrl: track.url,
        artworkUrl: artwork,
        artistName,
        albumName,
        releaseDate,
        releaseType,
        credits
      })
      alert('Successfully prepared for DistroKid! Check your downloads.')
    } catch (error) {
      console.error('Publishing failed:', error)
      alert('Failed to prepare DistroKid package')
    }
    setIsLoadingDistro(false)
  }

  const handleYouTube = async () => {
    if (!video) return
    
    setIsLoadingYT(true)
    try {
      const result = await publishToYouTube({
        videoUrl: video,
        title: ytTitle,
        description: ytDescription,
        tags: ytTags,
        category: ytCategory,
        privacy: ytPrivacy
      })
      
      if (result.videoId) {
        window.open(`https://youtube.com/watch?v=${result.videoId}`, '_blank')
      } else {
        alert('Video prepared for YouTube upload. Please upload manually.')
      }
    } catch (error) {
      console.error('Publishing failed:', error)
      alert('Failed to prepare YouTube video')
    }
    setIsLoadingYT(false)
  }

  return (
    <Card className={disabled ? 'opacity-50 pointer-events-none' : ''}>
      <h2 className="text-2xl font-bold mb-6 text-green-400">4. Publish</h2>
      
      <div className="grid md:grid-cols-2 gap-6">
        {/* DistroKid */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Music2 className="w-5 h-5" />
            <h3 className="text-lg font-semibold">DistroKid</h3>
          </div>
          
          <input
            type="text"
            value={artistName}
            onChange={(e) => setArtistName(e.target.value)}
            placeholder="Artist name"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
          />
          
          <input
            type="text"
            value={albumName}
            onChange={(e) => setAlbumName(e.target.value)}
            placeholder="Album/Single name"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
          />
          
          <input
            type="date"
            value={releaseDate}
            onChange={(e) => setReleaseDate(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
          />
          
          <select
            value={releaseType}
            onChange={(e) => setReleaseType(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
          >
            <option value="single">Single</option>
            <option value="ep">EP</option>
            <option value="album">Album</option>
          </select>
          
          <textarea
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
            placeholder="Track credits (optional)"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 min-h-[80px] resize-none"
          />
          
          <Button
            onClick={handleDistroKid}
            disabled={!artistName || !albumName || isLoadingDistro}
            className="w-full"
          >
            {isLoadingDistro ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Preparing...
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4 mr-2" />
                Upload to DistroKid
              </>
            )}
          </Button>
        </div>
        
        {/* YouTube */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Youtube className="w-5 h-5" />
            <h3 className="text-lg font-semibold">YouTube</h3>
          </div>
          
          <input
            type="text"
            value={ytTitle}
            onChange={(e) => setYtTitle(e.target.value)}
            placeholder="Video title"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
          />
          
          <textarea
            value={ytDescription}
            onChange={(e) => setYtDescription(e.target.value)}
            placeholder="Video description"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 min-h-[80px] resize-none"
          />
          
          <input
            type="text"
            value={ytTags}
            onChange={(e) => setYtTags(e.target.value)}
            placeholder="Tags (comma separated)"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
          />
          
          <select
            value={ytCategory}
            onChange={(e) => setYtCategory(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
          >
            <option value="10">Music</option>
            <option value="24">Entertainment</option>
          </select>
          
          <select
            value={ytPrivacy}
            onChange={(e) => setYtPrivacy(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
          >
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
            <option value="private">Private</option>
          </select>
          
          <Button
            onClick={handleYouTube}
            disabled={!video || !ytTitle || isLoadingYT}
            className="w-full"
          >
            {isLoadingYT ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Preparing...
              </>
            ) : (
              <>
                <Youtube className="w-4 h-4 mr-2" />
                Upload to YouTube
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  )
}