import { json } from '@tanstack/start'
import { createAPIFileRoute } from '@tanstack/start/api'

export const APIRoute = createAPIFileRoute('/api/youtube')({
  // YouTube authentication
  '/auth': {
    GET: async ({ context }) => {
      const env = context.env as any
      const CLIENT_ID = env.YOUTUBE_CLIENT_ID
      const REDIRECT_URI = `${context.request.headers.get('origin')}/api/youtube/callback`
      
      if (!CLIENT_ID) {
        return json({ error: 'YouTube client ID not configured' }, { status: 500 })
      }
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent('https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube')}&` +
        `access_type=offline&` +
        `prompt=consent`
      
      return Response.redirect(authUrl)
    }
  },

  // OAuth callback
  '/callback': {
    GET: async ({ request, context }) => {
      const env = context.env as any
      const url = new URL(request.url)
      const code = url.searchParams.get('code')
      const CLIENT_ID = env.YOUTUBE_CLIENT_ID
      const CLIENT_SECRET = env.YOUTUBE_CLIENT_SECRET
      const REDIRECT_URI = `${request.headers.get('origin')}/api/youtube/callback`
      
      if (!code) {
        return json({ error: 'No authorization code provided' }, { status: 400 })
      }
      
      try {
        // Exchange code for tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code'
          })
        })
        
        const tokens = await tokenResponse.json()
        
        // Store tokens in D1 (in production, encrypt these)
        await env.DB.prepare(`
          INSERT OR REPLACE INTO youtube_auth (id, access_token, refresh_token, expires_at)
          VALUES ('default', ?, ?, ?)
        `).bind(
          tokens.access_token,
          tokens.refresh_token,
          new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        ).run()
        
        // Redirect back to publish tab
        return Response.redirect('/#publish?youtube=connected')
      } catch (error: any) {
        return json({ error: error.message }, { status: 500 })
      }
    }
  },

  // Check connection status
  '/status': {
    GET: async ({ context }) => {
      const env = context.env as any
      
      try {
        const auth = await env.DB.prepare(
          'SELECT * FROM youtube_auth WHERE id = ?'
        ).bind('default').first()
        
        return json({ 
          connected: !!auth && new Date(auth.expires_at) > new Date() 
        })
      } catch (error) {
        return json({ connected: false })
      }
    }
  },

  // Prepare YouTube upload
  '/prepare': {
    POST: async ({ request, context }) => {
      const env = context.env as any
      const body = await request.json()
      const { albumId, videoStyle, videoLoopId, album, songs } = body
      
      try {
        // Generate description
        const description = `${album.title} by ${album.artist}
        
Full album lofi music compilation.

Tracklist:
${songs.map((song: any, idx: number) => {
  const minutes = Math.floor(idx * 3)
  const seconds = (idx * 3) % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} - ${song.name}`
}).join('\n')}

Created with Lofi Studio - AI-powered music generation
        
#lofi #lofihiphop #studymusic #chillbeats #relaxingmusic`
        
        // Generate tags
        const tags = [
          'lofi', 'lofi hip hop', 'study music', 'chill beats',
          'relaxing music', 'lofi mix', 'lofi compilation',
          album.artist.toLowerCase(), album.title.toLowerCase()
        ]
        
        // Generate video based on style
        let videoData
        const origin = request.headers.get('origin') || `https://${request.headers.get('host')}`
        
        if (videoStyle === 'static' || videoStyle === 'animated') {
          // Generate video with either static image or looping video
          const videoGenResponse = await fetch(`${origin}/api/video/generate-static`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              albumId,
              album,
              songs,
              videoStyle,
              videoLoopId // Optional: ID of video to loop
            })
          })
          
          if (!videoGenResponse.ok) {
            const error = await videoGenResponse.json()
            throw new Error(error.error || 'Failed to generate video')
          }
          
          videoData = await videoGenResponse.json()
        } else {
          // For other styles, return instructions for manual creation
          videoData = {
            status: 'manual',
            message: 'Please create video manually for this style'
          }
        }
        
        return json({
          success: true,
          description,
          tags,
          videoStyle,
          title: `${album.title} - ${album.artist} [Full Album]`,
          categoryId: '10', // Music category
          privacyStatus: 'private', // Start as private
          video: videoData,
          message: videoData.status === 'rendering' 
            ? `Video is being generated (${videoData.estimatedTime}). Check back soon!`
            : 'YouTube upload package prepared.',
        })
      } catch (error: any) {
        return json({ error: error.message }, { status: 500 })
      }
    }
  }
})