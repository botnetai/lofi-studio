import { json } from '@tanstack/start'
import { createAPIFileRoute } from '@tanstack/start/api'

export const APIRoute = createAPIFileRoute('/api/videos')({
  GET: async ({ request, context }) => {
    const env = context.env as any
    
    try {
      // Get videos from D1 database
      const result = await env.DB.prepare(
        'SELECT * FROM videos ORDER BY created_at DESC LIMIT 50'
      ).all()
      
      return json(result.results || [])
    } catch (error) {
      console.error('Failed to fetch videos:', error)
      return json({ error: 'Failed to fetch videos' }, { status: 500 })
    }
  },
  
  POST: async ({ request, context }) => {
    const env = context.env as any
    const body = await request.json()
    const {
      imageUrl,
      prompt,
      model = 'kling-1.6',
      duration = 5,
      seed = -1,
      cfgScale = 0.5,
      mode = 'standard',
      enableLoop = true,
      tailImageUrl
    } = body
    
    if (!imageUrl) {
      return json({ error: 'Image URL is required' }, { status: 400 })
    }
    
    try {
      // Video generation endpoint mapping
      const endpoint = model.startsWith('kling') 
        ? 'https://api.klingai.com/v1/video/generate'
        : 'https://api.example.com/video/generate' // Placeholder for other models
      
      // Prepare request body based on model
      let requestBody: any = {
        image_url: imageUrl,
        prompt: prompt || '',
        duration: duration,
        seed: seed,
        cfg_scale: cfgScale,
        mode: mode
      }
      
      if (model.startsWith('kling')) {
        requestBody = {
          ...requestBody,
          model: model,
          enable_loop: enableLoop,
          tail_image_url: tailImageUrl
        }
      }
      
      // Generate video
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.KLING_API_KEY || env.VIDEO_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })
      
      if (!response.ok) {
        throw new Error(`Video generation error: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      // Store video in database
      const id = crypto.randomUUID()
      const metadata = {
        model,
        duration,
        seed,
        cfgScale,
        mode,
        enableLoop,
        imageUrl,
        tailImageUrl
      }
      
      await env.DB.prepare(
        `INSERT INTO videos (id, url, prompt, metadata, created_at) 
         VALUES (?, ?, ?, ?, datetime('now'))`
      ).bind(id, data.video_url || data.url, prompt, JSON.stringify(metadata)).run()
      
      return json({ 
        id, 
        video_url: data.video_url || data.url,
        status: data.status || 'completed'
      })
    } catch (error: any) {
      console.error('Video generation error:', error)
      return json({ error: error.message || 'Failed to generate video' }, { status: 500 })
    }
  }
})