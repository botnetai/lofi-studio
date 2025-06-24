// New async video generation endpoint
app.post('/api/video', async (c) => {
  const body = await c.req.json()
  const { 
    imageId, 
    prompt = '', 
    model = 'kling-2.1', 
    enableLoop = false, 
    duration = 5,
    seed = -1,
    cfgScale = 0.5,
    mode = 'standard',
    tailImageId = null
  } = body
  
  console.log('Video generation request:', { imageId, model, duration, mode })
  
  try {
    // Get image URL
    const artwork = await c.env.DB.prepare(
      'SELECT * FROM artwork WHERE id = ?'
    ).bind(imageId).first()
    
    if (!artwork) {
      return c.json({ error: 'Artwork not found' }, 404)
    }
    
    // Generate video ID upfront
    const videoId = crypto.randomUUID()
    const key = `videos/${videoId}.mp4`
    
    // Create placeholder entry in database with "generating" status
    await c.env.DB.prepare(`
      INSERT INTO videos (id, url, artwork_id, metadata, created_at, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      videoId,
      `/files/${key}`, // Placeholder URL
      imageId,
      JSON.stringify({ 
        model, 
        prompt, 
        enableLoop,
        duration,
        mode,
        status: 'generating',
        requestedAt: new Date().toISOString()
      }),
      new Date().toISOString(),
      'generating'
    ).run()
    
    console.log('Created placeholder video entry:', videoId)
    
    // Return immediately with the video ID
    const responseData = { 
      success: true, 
      videoId,
      status: 'generating',
      message: 'Video generation started. Check back in 1-2 minutes.'
    }
    
    // Handle the actual generation in the background
    c.executionCtx.waitUntil(
      generateVideoInBackground(c, {
        videoId,
        key,
        imageId,
        artwork,
        model,
        prompt,
        duration,
        mode,
        enableLoop,
        seed,
        cfgScale,
        tailImageId
      })
    )
    
    return c.json(responseData)
  } catch (error) {
    console.error('Video generation error:', error)
    return c.json({ error: error.message }, 500)
  }
})

// Background video generation function
async function generateVideoInBackground(c: any, params: any) {
  const {
    videoId,
    key,
    imageId,
    artwork,
    model,
    prompt,
    duration,
    mode,
    enableLoop,
    seed,
    cfgScale,
    tailImageId
  } = params
  
  try {
    // Get full URL for the artwork
    const origin = c.req.header('origin') || `https://${c.req.header('host')}`
    const fullImageUrl = artwork.url.startsWith('http') ? artwork.url : `${origin}${artwork.url}`
    
    // Get tail image URL if provided
    let fullTailImageUrl = null
    if (tailImageId) {
      const tailArtwork = await c.env.DB.prepare(
        'SELECT * FROM artwork WHERE id = ?'
      ).bind(tailImageId).first()
      
      if (tailArtwork) {
        fullTailImageUrl = tailArtwork.url.startsWith('http') 
          ? tailArtwork.url 
          : `${origin}${tailArtwork.url}`
      }
    }
    
    console.log('Starting background video generation for:', videoId)
    
    // Map models to endpoints and configurations
    const modelConfigs = {
      'kling-2.1': {
        endpoint: mode === 'pro' 
          ? 'https://queue.fal.run/fal-ai/kling-video/v2.1/pro/image-to-video'
          : mode === 'master'
          ? 'https://queue.fal.run/fal-ai/kling-video/v2.1/master/image-to-video'
          : 'https://queue.fal.run/fal-ai/kling-video/v2.1/standard/image-to-video',
        params: {
          image_url: fullImageUrl,
          prompt: prompt || 'smooth camera movement, cinematic',
          duration: duration.toString(),
          cfg_scale: cfgScale,
          seed: seed === -1 ? Math.floor(Math.random() * 1000000) : seed,
          ...(fullTailImageUrl && { tail_image_url: fullTailImageUrl })
        }
      },
      // ... other model configs ...
    }
    
    const config = modelConfigs[model]
    if (!config) {
      throw new Error(`Unknown model: ${model}`)
    }
    
    // Call the video generation API
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${c.env.FAL_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config.params)
    })
    
    if (!response.ok) {
      throw new Error(`Video generation failed: ${response.statusText}`)
    }
    
    let data = await response.json()
    console.log('Initial API response:', data)
    
    // Handle queue response - poll for the result
    if (data.request_id && data.status_url) {
      console.log('Polling for video generation result...')
      
      let result = data
      let attempts = 0
      const maxAttempts = 120 // 10 minutes
      
      while (result.status !== 'completed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds
        
        const statusResponse = await fetch(data.status_url, {
          headers: {
            'Authorization': `Key ${c.env.FAL_KEY}`
          }
        })
        
        if (!statusResponse.ok) {
          throw new Error(`Status check failed: ${statusResponse.statusText}`)
        }
        
        result = await statusResponse.json()
        console.log(`Polling ${videoId} - Attempt ${attempts + 1}: ${result.status}`)
        
        if (result.status === 'failed') {
          throw new Error(`Video generation failed: ${result.error || 'Unknown error'}`)
        }
        
        attempts++
      }
      
      if (result.status !== 'completed') {
        throw new Error('Video generation timed out')
      }
      
      data = result
    }
    
    // Get video URL from response
    const videoUrl = data.video?.url || data.video_url || data.url || data.output
    
    if (!videoUrl) {
      throw new Error('No video URL in response')
    }
    
    console.log('Video generated successfully, downloading...')
    
    // Download and save video to R2
    const videoResponse = await fetch(videoUrl)
    await c.env.R2.put(key, videoResponse.body, {
      httpMetadata: { contentType: 'video/mp4' }
    })
    
    // Update database entry with completed status
    await c.env.DB.prepare(`
      UPDATE videos 
      SET status = 'completed', 
          metadata = json_set(metadata, 
            '$.status', 'completed',
            '$.completedAt', ?,
            '$.fal_url', ?
          )
      WHERE id = ?
    `).bind(
      new Date().toISOString(),
      videoUrl,
      videoId
    ).run()
    
    console.log('Video generation completed:', videoId)
  } catch (error) {
    console.error('Background video generation error:', error)
    
    // Update database entry with failed status
    await c.env.DB.prepare(`
      UPDATE videos 
      SET status = 'failed', 
          metadata = json_set(metadata, 
            '$.status', 'failed',
            '$.error', ?,
            '$.failedAt', ?
          )
      WHERE id = ?
    `).bind(
      error.message,
      new Date().toISOString(),
      videoId
    ).run()
  }
}