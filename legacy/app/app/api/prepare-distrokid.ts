import { json } from '@tanstack/start'
import { createAPIFileRoute } from '@tanstack/start/api'

export const APIRoute = createAPIFileRoute('/api/prepare-distrokid')({
  POST: async ({ request, context }) => {
    const env = context.env as any
    const body = await request.json()
    const { albumId } = body

    if (!albumId) {
      return json({ error: 'Album ID is required' }, { status: 400 })
    }

    try {
      // Get album and songs
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

      // Generate DistroKid package
      const distroPackage = {
        album: {
          title: album.title,
          artist: album.artist,
          genre: album.genre || 'Lo-Fi Hip Hop',
          release_date: new Date().toISOString().split('T')[0],
          label: 'Lofi Studio Records',
          copyright: `℗ ${new Date().getFullYear()} ${album.artist}`,
          upc: null // Will be assigned by DistroKid
        },
        tracks: [],
        artwork: {
          cover_art_url: album.artwork_id ? `/files/artwork/${album.artwork_id}.png` : null
        },
        platforms: {
          spotify: true,
          apple_music: true,
          youtube_music: true,
          amazon_music: true,
          tidal: true,
          deezer: true,
          tiktok: true,
          instagram: true
        }
      }

      // Process each track
      for (const song of songs.results || []) {
        const metadata = JSON.parse(song.metadata || '{}')
        
        distroPackage.tracks.push({
          title: song.title,
          duration_seconds: song.duration || metadata.duration || 180,
          isrc: null, // Will be assigned by DistroKid
          audio_file: song.audio_url,
          writers: [album.artist],
          producers: ['Lofi Studio AI'],
          explicit: false,
          language: 'Instrumental',
          primary_genre: 'Hip-Hop',
          secondary_genre: 'Electronic'
        })
      }

      // Save DistroKid package
      await env.DB.prepare(`
        UPDATE albums 
        SET distrokid_metadata = ?, status = 'ready_for_distribution'
        WHERE id = ?
      `).bind(
        JSON.stringify(distroPackage),
        albumId
      ).run()

      return json({ 
        success: true, 
        distroPackage,
        instructions: {
          manual_steps: [
            '1. Download all audio files from the URLs provided',
            '2. Download the cover art from the URL provided',
            '3. Log into DistroKid',
            '4. Create new release with the metadata provided',
            '5. Upload audio files in the correct track order',
            '6. Upload cover art (3000x3000 recommended)',
            '7. Select distribution platforms',
            '8. Submit for distribution'
          ],
          automation_note: 'For automated distribution, integrate DistroKid API'
        }
      })
    } catch (error: any) {
      console.error('DistroKid preparation error:', error)
      return json({ error: error.message || 'Failed to prepare for DistroKid' }, { status: 500 })
    }
  }
})