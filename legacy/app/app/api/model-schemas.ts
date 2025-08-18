import { imageModelSchemas, videoModelSchemas, musicModelSchemas } from '../config/model-schemas'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const modelType = url.searchParams.get('type')
  const modelId = url.searchParams.get('id')
  
  // Return all schemas for a type
  if (modelType && !modelId) {
    switch (modelType) {
      case 'image':
        return new Response(JSON.stringify(imageModelSchemas), {
          headers: { 'Content-Type': 'application/json' }
        })
      case 'video':
        return new Response(JSON.stringify(videoModelSchemas), {
          headers: { 'Content-Type': 'application/json' }
        })
      case 'music':
        return new Response(JSON.stringify(musicModelSchemas), {
          headers: { 'Content-Type': 'application/json' }
        })
      default:
        return new Response(JSON.stringify({ error: 'Invalid model type' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }
  }
  
  // Return specific schema
  if (modelType && modelId) {
    let schema = null
    switch (modelType) {
      case 'image':
        schema = imageModelSchemas[modelId]
        break
      case 'video':
        schema = videoModelSchemas[modelId]
        break
      case 'music':
        schema = musicModelSchemas[modelId]
        break
    }
    
    if (schema) {
      return new Response(JSON.stringify(schema), {
        headers: { 'Content-Type': 'application/json' }
      })
    } else {
      return new Response(JSON.stringify({ error: 'Model not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
  
  // Return all schemas
  return new Response(JSON.stringify({
    image: imageModelSchemas,
    video: videoModelSchemas,
    music: musicModelSchemas
  }), {
    headers: { 'Content-Type': 'application/json' }
  })
}