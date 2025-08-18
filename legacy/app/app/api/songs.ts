import { createAPIFileRoute } from '@tanstack/start/api'

export const APIRoute = createAPIFileRoute('/api/songs')({
  GET: async ({ context }) => {
    const env = context.cloudflare?.env as any
    if (!env?.DB) {
      return new Response('Database not available', { status: 500 })
    }
    
    try {
      const songs = await env.DB.prepare('SELECT * FROM songs ORDER BY created_at DESC').all()
      return Response.json(songs.results || [])
    } catch (error) {
      console.error('Error fetching songs:', error)
      return new Response('Failed to fetch songs', { status: 500 })
    }
  }
})

export const APIRouteWithId = createAPIFileRoute('/api/songs/$id')({
  DELETE: async ({ params, context }) => {
    const env = context.cloudflare?.env as any
    if (!env?.DB || !env?.R2) {
      return new Response('Database or R2 not available', { status: 500 })
    }
    
    const songId = params.id
    
    try {
      // First, get the song to delete its files from R2
      const song = await env.DB.prepare('SELECT * FROM songs WHERE id = ?').bind(songId).first()
      
      if (!song) {
        return new Response('Song not found', { status: 404 })
      }
      
      // Delete files from R2
      if (song.audio_url) {
        const audioKey = song.audio_url.replace('/files/', '')
        await env.R2.delete(audioKey)
      }
      
      if (song.video_url) {
        const videoKey = song.video_url.replace('/files/', '')
        await env.R2.delete(videoKey)
      }
      
      if (song.image_url) {
        const imageKey = song.image_url.replace('/files/', '')
        await env.R2.delete(imageKey)
      }
      
      // Delete from database
      await env.DB.prepare('DELETE FROM songs WHERE id = ?').bind(songId).run()
      
      return Response.json({ success: true })
    } catch (error) {
      console.error('Error deleting song:', error)
      return new Response('Failed to delete song', { status: 500 })
    }
  }
})