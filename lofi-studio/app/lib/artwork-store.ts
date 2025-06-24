import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Artwork {
  id: string
  url: string
  prompt: string
  metadata: string
  created_at: string
}

export interface Video {
  id: string
  url: string
  prompt: string
  metadata: string
  created_at: string
}

export interface Album {
  id: string
  title: string
  artist: string
  artwork_id: string | null
  song_ids: string[]
  status: string
  created_at: string
}

interface ArtworkStoreState {
  // Artwork state
  artworkModel: string
  artworkPrompt: string
  numImages: number
  allArtwork: Artwork[]
  artworks: Artwork[] // Alias for compatibility
  selectedArtwork: string | null
  
  // Video state
  videoModel: string
  videoPrompt: string
  videoDuration: number
  videoSeed: number
  videoCfgScale: number
  videoMode: string
  enableLoop: boolean
  selectedImageForVideo: string | null
  selectedTailImage: string | null
  videos: Video[]
  
  // Album state
  albums: Album[]
  selectedAlbum: string | null
  
  // UI state
  mediaFilter: 'all' | 'images' | 'videos'
  
  // Actions
  setArtworkModel: (model: string) => void
  setArtworkPrompt: (prompt: string) => void
  setNumImages: (num: number) => void
  setAllArtwork: (artwork: Artwork[]) => void
  addArtwork: (artwork: Artwork) => void
  selectArtwork: (id: string | null) => void
  fetchArtwork: () => Promise<void>
  
  setVideoModel: (model: string) => void
  setVideoPrompt: (prompt: string) => void
  setVideoDuration: (duration: number) => void
  setVideoSeed: (seed: number) => void
  setVideoCfgScale: (scale: number) => void
  setVideoMode: (mode: string) => void
  setEnableLoop: (enable: boolean) => void
  setSelectedImageForVideo: (id: string | null) => void
  setSelectedTailImage: (id: string | null) => void
  setVideos: (videos: Video[]) => void
  addVideo: (video: Video) => void
  
  setAlbums: (albums: Album[]) => void
  addAlbum: (album: Album) => void
  selectAlbum: (id: string | null) => void
  
  setMediaFilter: (filter: 'all' | 'images' | 'videos') => void
}

export const useArtworkStore = create<ArtworkStoreState>()(
  persist(
    (set, get) => ({
      // Initial artwork state
      artworkModel: 'flux-schnell',
      artworkPrompt: '',
      numImages: 4,
      allArtwork: [],
      artworks: [], // Alias for compatibility
      selectedArtwork: null,
      
      // Initial video state
      videoModel: 'kling-1.6',
      videoPrompt: '',
      videoDuration: 5,
      videoSeed: -1,
      videoCfgScale: 0.5,
      videoMode: 'standard',
      enableLoop: true,
      selectedImageForVideo: null,
      selectedTailImage: null,
      videos: [],
      
      // Initial album state
      albums: [],
      selectedAlbum: null,
      
      // Initial UI state
      mediaFilter: 'all',
      
      // Artwork actions
      setArtworkModel: (model) => set({ artworkModel: model }),
      setArtworkPrompt: (prompt) => set({ artworkPrompt: prompt }),
      setNumImages: (num) => set({ numImages: num }),
      setAllArtwork: (artwork) => set({ allArtwork: artwork, artworks: artwork }),
      addArtwork: (artwork) => set((state) => ({ 
        allArtwork: [...state.allArtwork, artwork],
        artworks: [...state.allArtwork, artwork] 
      })),
      selectArtwork: (id) => set({ selectedArtwork: id }),
      fetchArtwork: async () => {
        try {
          const response = await fetch('/api/artwork')
          const data = await response.json()
          set({ allArtwork: data, artworks: data })
        } catch (error) {
          console.error('Failed to fetch artwork:', error)
        }
      },
      
      // Video actions
      setVideoModel: (model) => set({ videoModel: model }),
      setVideoPrompt: (prompt) => set({ videoPrompt: prompt }),
      setVideoDuration: (duration) => set({ videoDuration: duration }),
      setVideoSeed: (seed) => set({ videoSeed: seed }),
      setVideoCfgScale: (scale) => set({ videoCfgScale: scale }),
      setVideoMode: (mode) => set({ videoMode: mode }),
      setEnableLoop: (enable) => set({ enableLoop: enable }),
      setSelectedImageForVideo: (id) => set({ selectedImageForVideo: id }),
      setSelectedTailImage: (id) => set({ selectedTailImage: id }),
      setVideos: (videos) => set({ videos: videos }),
      addVideo: (video) => set((state) => ({ 
        videos: [...state.videos, video] 
      })),
      
      // Album actions
      setAlbums: (albums) => set({ albums: albums }),
      addAlbum: (album) => set((state) => ({ 
        albums: [...state.albums, album] 
      })),
      selectAlbum: (id) => set({ selectedAlbum: id }),
      
      // UI actions
      setMediaFilter: (filter) => set({ mediaFilter: filter })
    }),
    {
      name: 'lofi-studio-artwork-storage'
    }
  )
)