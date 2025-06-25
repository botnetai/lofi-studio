// Fal.ai model schema fetching and caching

export interface FalModelInput {
  name: string
  type: string
  description?: string
  default?: any
  required?: boolean
  minimum?: number
  maximum?: number
  enum?: string[]
  properties?: Record<string, FalModelInput> // For object types
}

export interface FalModelSchema {
  inputs: Record<string, FalModelInput>
  outputs?: Record<string, any>
}

// Cache for model schemas to avoid repeated API calls
const schemaCache = new Map<string, { schema: FalModelSchema; timestamp: number }>()
const CACHE_DURATION = 1000 * 60 * 60 // 1 hour

export async function fetchModelSchema(
  modelId: string,
  falKey: string
): Promise<FalModelSchema | null> {
  // Check cache first
  const cached = schemaCache.get(modelId)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.schema
  }

  try {
    // Fal.ai model info endpoint
    const response = await fetch(`https://fal.run/${modelId}`, {
      method: 'OPTIONS',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      console.error(`Failed to fetch schema for ${modelId}:`, response.status)
      return null
    }

    const schema = await response.json()
    
    // Cache the schema
    schemaCache.set(modelId, {
      schema,
      timestamp: Date.now()
    })

    return schema
  } catch (error) {
    console.error(`Error fetching schema for ${modelId}:`, error)
    return null
  }
}

// Convert Fal schema to our form field format
export function falSchemaToFormFields(schema: FalModelSchema) {
  const fields: any[] = []
  
  for (const [key, input] of Object.entries(schema.inputs || {})) {
    // Skip certain fields that we handle separately
    if (key === 'image_url' || key === 'tail_image_url') continue
    
    const field: any = {
      name: key,
      label: key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      description: input.description,
      required: input.required,
      default: input.default
    }
    
    // Determine field type based on Fal input type
    if (input.enum) {
      field.type = 'select'
      field.options = input.enum.map(value => ({
        value,
        label: value.toString()
      }))
    } else if (input.type === 'boolean') {
      field.type = 'boolean'
    } else if (input.type === 'integer' || input.type === 'number') {
      if (input.minimum !== undefined && input.maximum !== undefined) {
        field.type = 'range'
        field.min = input.minimum
        field.max = input.maximum
        field.step = input.type === 'integer' ? 1 : 0.1
      } else {
        field.type = 'number'
        if (input.minimum !== undefined) field.min = input.minimum
        if (input.maximum !== undefined) field.max = input.maximum
      }
    } else if (input.type === 'string') {
      field.type = 'text'
      if (key.includes('prompt') || key.includes('description')) {
        field.type = 'textarea'
      }
    }
    
    fields.push(field)
  }
  
  return fields
}

// Get available video models from Fal.ai
export const FAL_VIDEO_MODELS = [
  { id: 'fal-ai/kling-video/v2.1/standard/image-to-video', name: 'Kling 2.1 Standard' },
  { id: 'fal-ai/kling-video/v2.1/pro/image-to-video', name: 'Kling 2.1 Pro' },
  { id: 'fal-ai/kling-video/v2.1/master/image-to-video', name: 'Kling 2.1 Master' },
  { id: 'fal-ai/kling-video/v2/standard/image-to-video', name: 'Kling 2.0 Standard' },
  { id: 'fal-ai/kling-video/v2/pro/image-to-video', name: 'Kling 2.0 Pro' },
  { id: 'fal-ai/kling-video/v2/master/image-to-video', name: 'Kling 2.0 Master' },
  { id: 'fal-ai/kling-video/v1.6/standard/image-to-video', name: 'Kling 1.6 Standard' },
  { id: 'fal-ai/kling-video/v1.6/pro/image-to-video', name: 'Kling 1.6 Pro' },
  { id: 'fal-ai/kling-video/v1.5/pro/image-to-video', name: 'Kling 1.5 Pro' },
  { id: 'fal-ai/kling-video/v1/pro/image-to-video', name: 'Kling 1.0 Pro' }
]

// Get available image models from Fal.ai
export const FAL_IMAGE_MODELS = [
  { id: 'fal-ai/flux-kontext', name: 'FLUX Kontext' },
  { id: 'fal-ai/flux/schnell', name: 'FLUX Schnell' },
  { id: 'fal-ai/flux/dev', name: 'FLUX Dev' },
  { id: 'fal-ai/flux-pro', name: 'FLUX Pro' },
  { id: 'fal-ai/flux-pro-ultra', name: 'FLUX Pro Ultra' },
  { id: 'fal-ai/stable-diffusion-xl', name: 'Stable Diffusion XL' }
]