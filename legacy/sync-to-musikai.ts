import { Hono } from 'hono'

const app = new Hono()

// Add this endpoint to your worker to sync songs to Musikai
app.post('/api/sync-to-musikai', async (c) => {
  const env = c.env
  const body = await c.req.json()
  const { songIds } = body
  
  try {
    // Get songs from Lofi Studio DB
    const songs = await env.DB.prepare(`
      SELECT * FROM songs 
      WHERE id IN (${songIds.map(() => '?').join(',')})
      AND status = 'completed'
    `).bind(...songIds).all()
    
    const synced = []
    
    for (const song of songs.results || []) {
      const metadata = JSON.parse(song.metadata || '{}')
      
      // Download audio from R2
      const audioKey = song.url.replace('/files/', '')
      const audioObject = await env.R2.get(audioKey)
      
      if (!audioObject) {
        console.error(`Audio not found for song ${song.id}`)
        continue
      }
      
      // Prepare data for Musikai
      const musikalSong = {
        title: song.name,
        prompt: metadata.prompt || '',
        tags: metadata.tags || '',
        duration: metadata.duration,
        audio_url: metadata.audio_url,
        created_at: song.created_at,
        source: 'lofi-studio',
        udio_id: metadata.workId,
        status: 'pending_approval',
        // Add any other fields Musikai expects
      }
      
      // Option A: Direct file system write (if on same server)
      // Save to Musikai's songs directory
      // const fs = require('fs')
      // const path = `/path/to/musikai/songs/${song.id}.mp3`
      // await fs.writeFile(path, await audioObject.arrayBuffer())
      
      // Option B: API call to Musikai (if running as separate service)
      // const response = await fetch('http://musikai-server/api/import-song', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(musikalSong)
      // })
      
      // Option C: Direct database insert (if sharing DB)
      // await musikaiDB.prepare(`
      //   INSERT INTO songs (id, title, prompt, tags, duration, path, status, created_at)
      //   VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      // `).bind(...).run()
      
      synced.push({
        id: song.id,
        name: song.name,
        musikai_status: 'synced'
      })
    }
    
    return c.json({ 
      success: true, 
      synced_count: synced.length,
      songs: synced
    })
  } catch (error) {
    console.error('Sync error:', error)
    return c.json({ error: error.message }, 500)
  }
})

// Export songs in Musikai-compatible format
app.get('/api/export-for-musikai', async (c) => {
  const env = c.env
  
  const songs = await env.DB.prepare(`
    SELECT * FROM songs 
    WHERE status = 'completed'
    ORDER BY created_at DESC
  `).all()
  
  const exportData = {
    version: '1.0',
    source: 'lofi-studio',
    export_date: new Date().toISOString(),
    songs: []
  }
  
  for (const song of songs.results || []) {
    const metadata = JSON.parse(song.metadata || '{}')
    
    exportData.songs.push({
      id: song.id,
      title: song.name,
      prompt: metadata.prompt,
      tags: metadata.tags,
      duration: metadata.duration,
      audio_url: song.url,
      udio_id: metadata.workId,
      variant: metadata.variant,
      created_at: song.created_at,
      // Include all metadata Musikai needs
    })
  }
  
  return c.json(exportData)
})

export default app