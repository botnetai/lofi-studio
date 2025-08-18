import { json } from '@tanstack/start'
import { createAPIFileRoute } from '@tanstack/start/api'

export const APIRoute = createAPIFileRoute('/api/artwork')({
  GET: async ({ request, context }) => {
    const env = context.env as any
    
    try {
      // Get artwork from D1 database
      const result = await env.DB.prepare(
        'SELECT * FROM artwork ORDER BY created_at DESC LIMIT 100'
      ).all()
      
      return json(result.results || [])
    } catch (error) {
      console.error('Failed to fetch artwork:', error)
      return json({ error: 'Failed to fetch artwork' }, { status: 500 })
    }
  },
  
  POST: async ({ request, context }) => {
    const env = context.env as any
    const body = await request.json()
    const { prompt, style = 'lofi anime aesthetic, album cover art', numImages = 4, model = 'flux-schnell' } = body
    
    if (!prompt) {
      return json({ error: 'Prompt is required' }, { status: 400 })
    }
    
    // Map model names to Fal.ai endpoints
    const modelEndpoints: Record<string, string> = {
      'flux-schnell': 'https://fal.run/fal-ai/flux/schnell',
      'flux-dev': 'https://fal.run/fal-ai/flux/dev',
      'flux-pro': 'https://fal.run/fal-ai/flux-pro',
      'stable-diffusion-xl': 'https://fal.run/fal-ai/stable-diffusion-xl'
    }
    
    const endpoint = modelEndpoints[model] || modelEndpoints['flux-schnell']
    
    try {
      // Generate artwork using Fal.ai
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${env.FAL_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: `${prompt}, ${style}, high quality, detailed`,
          image_size: 'square_hd',
          num_images: numImages,
          enable_safety_checker: true
        })
      })
      
      if (!response.ok) {
        throw new Error(`Fal.ai error: ${response.statusText}`)
      }
      
      const data = await response.json()
      const artworkIds = []
      
      // Store each generated image in the database
      for (const image of data.images) {
        const id = crypto.randomUUID()
        await env.DB.prepare(
          `INSERT INTO artwork (id, url, prompt, metadata, created_at) 
           VALUES (?, ?, ?, ?, datetime('now'))`
        ).bind(id, image.url, prompt, JSON.stringify({ model, style })).run()
        
        artworkIds.push(id)
      }
      
      return json({ artworkIds, images: data.images })
    } catch (error: any) {
      console.error('Artwork generation error:', error)
      return json({ error: error.message || 'Failed to generate artwork' }, { status: 500 })
    }
  }
})