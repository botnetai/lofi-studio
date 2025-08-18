import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Track {
  id: string
  name: string
  url: string
  type: 'upload' | 'generated'
  service?: string
  duration?: number
  status?: 'generating' | 'completed' | 'failed'
}

interface StoreState {
  tracks: Track[]
  selectedTrack: string | null
  artwork: string | null
  video: string | null
  
  addTrack: (track: Track) => void
  removeTrack: (id: string) => void
  selectTrack: (id: string | null) => void
  setArtwork: (url: string | null) => void
  setVideo: (url: string | null) => void
  reset: () => void
}

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      tracks: [],
      selectedTrack: null,
      artwork: null,
      video: null,
      
      addTrack: (track) => set((state) => ({ 
        tracks: [...state.tracks, track] 
      })),
      
      removeTrack: (id) => set((state) => ({
        tracks: state.tracks.filter(t => t.id !== id),
        selectedTrack: state.selectedTrack === id ? null : state.selectedTrack
      })),
      
      selectTrack: (id) => set({ selectedTrack: id }),
      
      setArtwork: (url) => set({ artwork: url }),
      
      setVideo: (url) => set({ video: url }),
      
      reset: () => set({
        tracks: [],
        selectedTrack: null,
        artwork: null,
        video: null
      })
    }),
    {
      name: 'lofi-studio-storage'
    }
  )
)