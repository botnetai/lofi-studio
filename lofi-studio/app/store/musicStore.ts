import { create } from 'zustand'

interface Song {
  id: string
  name: string
  url: string
  status: string
  metadata: any
  created_at: string
  duration?: number
}

interface MusicStore {
  songs: Song[]
  isLoading: boolean
  error: string | null
  selectedSongs: string[]
  
  fetchSongs: () => Promise<void>
  addSong: (song: Song) => void
  updateSong: (id: string, updates: Partial<Song>) => void
  toggleSongSelection: (id: string) => void
  clearSelection: () => void
  setSelectedSongs: (songIds: string[]) => void
  setError: (error: string | null) => void
}

export const useMusicStore = create<MusicStore>((set, get) => ({
  songs: [],
  isLoading: false,
  error: null,
  selectedSongs: [],
  
  fetchSongs: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch('/api/songs')
      if (!response.ok) throw new Error('Failed to fetch songs')
      const songs = await response.json()
      set({ songs, isLoading: false })
    } catch (error) {
      set({ error: error.message, isLoading: false })
    }
  },
  
  addSong: (song) => {
    set((state) => ({ songs: [song, ...state.songs] }))
  },
  
  updateSong: (id, updates) => {
    set((state) => ({
      songs: state.songs.map(song => 
        song.id === id ? { ...song, ...updates } : song
      )
    }))
  },
  
  toggleSongSelection: (id) => {
    set((state) => ({
      selectedSongs: state.selectedSongs.includes(id)
        ? state.selectedSongs.filter(songId => songId !== id)
        : [...state.selectedSongs, id]
    }))
  },
  
  clearSelection: () => {
    set({ selectedSongs: [] })
  },
  
  setSelectedSongs: (songIds) => {
    set({ selectedSongs: songIds })
  },
  
  setError: (error) => {
    set({ error })
  }
}))