import { json } from '@tanstack/start'
import { createAPIFileRoute } from '@tanstack/start/api'

export const APIRoute = createAPIFileRoute('/api/albums')({
  GET: async ({ request, context }) => {
    const env = context.env as any
    
    try {
      // Get albums from D1 database
      const result = await env.DB.prepare(
        'SELECT * FROM albums ORDER BY created_at DESC'
      ).all()
      
      return json(result.results || [])
    } catch (error) {
      console.error('Failed to fetch albums:', error)
      return json({ error: 'Failed to fetch albums' }, { status: 500 })
    }
  },

  // Get album songs
  '/:id/songs': {
    GET: async ({ request, context }) => {
      const env = context.env as any
      const albumId = request.params.id
      
      try {
        const album = await env.DB.prepare(
          'SELECT * FROM albums WHERE id = ?'
        ).bind(albumId).first()
        
        if (!album) {
          return json({ error: 'Album not found' }, { status: 404 })
        }
        
        const songIds = JSON.parse(album.song_ids || '[]')
        const songs = await env.DB.prepare(
          `SELECT * FROM songs WHERE id IN (${songIds.map(() => '?').join(',')}) ORDER BY created_at`
        ).bind(...songIds).all()
        
        return json(songs.results || [])
      } catch (error) {
        console.error('Failed to fetch album songs:', error)
        return json({ error: 'Failed to fetch album songs' }, { status: 500 })
      }
    }
  },

  // Update distribution status
  '/distribution-status': {
    POST: async ({ request, context }) => {
      const env = context.env as any
      const body = await request.json()
      const { albumId, status, upc, platform_ids } = body
      
      try {
        await env.DB.prepare(`
          UPDATE albums 
          SET status = ?,
              distrokid_metadata = json_set(
                COALESCE(distrokid_metadata, '{}'),
                '$.upc', ?,
                '$.platform_ids', ?,
                '$.published_at', ?
              )
          WHERE id = ?
        `).bind(
          status,
          upc || null,
          JSON.stringify(platform_ids || {}),
          new Date().toISOString(),
          albumId
        ).run()
        
        return json({ success: true })
      } catch (error: any) {
        console.error('Failed to update distribution status:', error)
        return json({ error: error.message || 'Failed to update status' }, { status: 500 })
      }
    }
  },
  
  POST: async ({ request, context }) => {
    const env = context.env as any
    const body = await request.json()
    const { title, artist, artworkId, songIds } = body
    
    if (!title || !songIds || songIds.length === 0) {
      return json({ error: 'Title and songs are required' }, { status: 400 })
    }
    
    try {
      const id = crypto.randomUUID()
      
      // Create album record
      await env.DB.prepare(
        `INSERT INTO albums (id, title, artist, artwork_id, song_ids, status, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        id, 
        title, 
        artist || 'Unknown Artist', 
        artworkId || null,
        JSON.stringify(songIds),
        'draft'
      ).run()
      
      return json({ 
        id, 
        title, 
        artist: artist || 'Unknown Artist',
        artwork_id: artworkId,
        song_ids: songIds,
        status: 'draft',
        created_at: new Date().toISOString()
      })
    } catch (error: any) {
      console.error('Album creation error:', error)
      return json({ error: error.message || 'Failed to create album' }, { status: 500 })
    }
  }
})