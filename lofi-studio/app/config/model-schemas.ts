// Model configuration schemas defining available parameters for each model

export interface ModelField {
  name: string
  type: 'text' | 'number' | 'select' | 'boolean' | 'range'
  label: string
  description?: string
  required?: boolean
  default?: any
  min?: number
  max?: number
  step?: number
  options?: Array<{ value: string | number; label: string }>
}

export interface ModelSchema {
  id: string
  name: string
  description: string
  fields: ModelField[]
}

// Image generation model schemas
export const imageModelSchemas: Record<string, ModelSchema> = {
  'flux-kontext': {
    id: 'flux-kontext',
    name: 'FLUX Kontext',
    description: 'Best for image-to-image transformations',
    fields: [
      {
        name: 'prompt',
        type: 'text',
        label: 'Prompt',
        description: 'Describe what you want to generate',
        required: true
      },
      {
        name: 'strength',
        type: 'range',
        label: 'Transformation Strength',
        description: 'How much to transform the source image (image-to-image only)',
        default: 0.85,
        min: 0.1,
        max: 1.0,
        step: 0.05
      },
      {
        name: 'num_images',
        type: 'select',
        label: 'Number of Images',
        default: 4,
        options: [
          { value: 1, label: '1 Image' },
          { value: 2, label: '2 Images' },
          { value: 4, label: '4 Images' },
          { value: 8, label: '8 Images' }
        ]
      }
    ]
  },
  'flux-schnell': {
    id: 'flux-schnell',
    name: 'FLUX Schnell',
    description: 'Fast generation, good quality',
    fields: [
      {
        name: 'prompt',
        type: 'text',
        label: 'Prompt',
        description: 'Describe what you want to generate',
        required: true
      },
      {
        name: 'num_images',
        type: 'select',
        label: 'Number of Images',
        default: 4,
        options: [
          { value: 1, label: '1 Image' },
          { value: 2, label: '2 Images' },
          { value: 4, label: '4 Images' },
          { value: 8, label: '8 Images' }
        ]
      }
    ]
  },
  'flux-dev': {
    id: 'flux-dev',
    name: 'FLUX Dev',
    description: 'Balanced speed and quality',
    fields: [
      {
        name: 'prompt',
        type: 'text',
        label: 'Prompt',
        description: 'Describe what you want to generate',
        required: true
      },
      {
        name: 'num_images',
        type: 'select',
        label: 'Number of Images',
        default: 4,
        options: [
          { value: 1, label: '1 Image' },
          { value: 2, label: '2 Images' },
          { value: 4, label: '4 Images' },
          { value: 8, label: '8 Images' }
        ]
      },
      {
        name: 'guidance_scale',
        type: 'range',
        label: 'Guidance Scale',
        description: 'How closely to follow the prompt',
        default: 7.5,
        min: 1,
        max: 20,
        step: 0.5
      }
    ]
  },
  'flux-pro': {
    id: 'flux-pro',
    name: 'FLUX Pro',
    description: 'Professional quality, balanced speed',
    fields: [
      {
        name: 'prompt',
        type: 'text',
        label: 'Prompt',
        description: 'Describe what you want to generate',
        required: true
      },
      {
        name: 'num_images',
        type: 'select',
        label: 'Number of Images',
        default: 4,
        options: [
          { value: 1, label: '1 Image' },
          { value: 2, label: '2 Images' },
          { value: 4, label: '4 Images' }
        ]
      },
      {
        name: 'guidance_scale',
        type: 'range',
        label: 'Guidance Scale',
        description: 'How closely to follow the prompt',
        default: 7.5,
        min: 1,
        max: 20,
        step: 0.5
      },
      {
        name: 'steps',
        type: 'range',
        label: 'Inference Steps',
        description: 'More steps = better quality but slower',
        default: 30,
        min: 20,
        max: 50,
        step: 5
      }
    ]
  },
  'flux-pro-ultra': {
    id: 'flux-pro-ultra',
    name: 'FLUX Pro Ultra',
    description: 'Ultra high quality, best for professional use',
    fields: [
      {
        name: 'prompt',
        type: 'text',
        label: 'Prompt',
        description: 'Describe what you want to generate',
        required: true
      },
      {
        name: 'num_images',
        type: 'select',
        label: 'Number of Images',
        default: 1,
        options: [
          { value: 1, label: '1 Image' },
          { value: 2, label: '2 Images' }
        ]
      },
      {
        name: 'aspect_ratio',
        type: 'select',
        label: 'Aspect Ratio',
        default: 'square',
        options: [
          { value: 'square', label: 'Square (1:1)' },
          { value: 'portrait', label: 'Portrait (2:3)' },
          { value: 'landscape', label: 'Landscape (3:2)' },
          { value: 'wide', label: 'Wide (16:9)' }
        ]
      }
    ]
  }
}

// Video generation model schemas
export const videoModelSchemas: Record<string, ModelSchema> = {
  'kling-2.1': {
    id: 'kling-2.1',
    name: 'Kling 2.1',
    description: 'Latest Kling model with best quality',
    fields: [
      {
        name: 'mode',
        type: 'select',
        label: 'Quality Mode',
        default: 'standard',
        options: [
          { value: 'standard', label: 'Standard' },
          { value: 'pro', label: 'Professional' },
          { value: 'master', label: 'Master (Highest Quality)' }
        ]
      },
      {
        name: 'duration',
        type: 'select',
        label: 'Duration',
        default: 5,
        options: [
          { value: 5, label: '5 seconds' },
          { value: 10, label: '10 seconds' }
        ]
      },
      {
        name: 'prompt',
        type: 'text',
        label: 'Video Prompt',
        description: 'Describe the motion and camera movement',
        default: 'smooth camera movement, cinematic'
      },
      {
        name: 'cfg_scale',
        type: 'range',
        label: 'CFG Scale',
        description: 'Lower = more creative, Higher = more accurate',
        default: 0.5,
        min: 0.1,
        max: 2.0,
        step: 0.1
      },
      {
        name: 'seed',
        type: 'number',
        label: 'Seed',
        description: 'Use -1 for random',
        default: -1
      }
    ]
  },
  'kling-2.0': {
    id: 'kling-2.0',
    name: 'Kling 2.0',
    description: 'Previous generation Kling model',
    fields: [
      {
        name: 'mode',
        type: 'select',
        label: 'Quality Mode',
        default: 'standard',
        options: [
          { value: 'standard', label: 'Standard' },
          { value: 'pro', label: 'Professional' },
          { value: 'master', label: 'Master (Highest Quality)' }
        ]
      },
      {
        name: 'duration',
        type: 'select',
        label: 'Duration',
        default: 5,
        options: [
          { value: 5, label: '5 seconds' },
          { value: 10, label: '10 seconds' }
        ]
      },
      {
        name: 'prompt',
        type: 'text',
        label: 'Video Prompt',
        description: 'Describe the motion and camera movement',
        default: 'smooth camera movement, cinematic'
      },
      {
        name: 'cfg_scale',
        type: 'range',
        label: 'CFG Scale',
        description: 'Lower = more creative, Higher = more accurate',
        default: 0.5,
        min: 0.1,
        max: 2.0,
        step: 0.1
      }
    ]
  },
  'kling-1.6': {
    id: 'kling-1.6',
    name: 'Kling 1.6',
    description: 'Stable version with good results',
    fields: [
      {
        name: 'mode',
        type: 'select',
        label: 'Quality Mode',
        default: 'standard',
        options: [
          { value: 'standard', label: 'Standard' },
          { value: 'pro', label: 'Professional' }
        ]
      },
      {
        name: 'duration',
        type: 'select',
        label: 'Duration',
        default: 5,
        options: [
          { value: 5, label: '5 seconds' },
          { value: 10, label: '10 seconds' }
        ]
      },
      {
        name: 'prompt',
        type: 'text',
        label: 'Video Prompt',
        description: 'Describe the motion and camera movement',
        default: 'smooth camera movement, cinematic'
      }
    ]
  }
}

// Music generation model schemas
export const musicModelSchemas: Record<string, ModelSchema> = {
  'goapi': {
    id: 'goapi',
    name: 'GoAPI (Udio)',
    description: 'High-quality music generation with Udio engine',
    fields: [
      {
        name: 'prompt',
        type: 'text',
        label: 'Music Prompt',
        description: 'Describe your lofi beat',
        required: true
      },
      {
        name: 'custom_mode',
        type: 'boolean',
        label: 'Add Custom Lyrics',
        default: false
      },
      {
        name: 'lyrics',
        type: 'text',
        label: 'Lyrics',
        description: 'Enter your lyrics (only if custom mode is enabled)'
      },
      {
        name: 'make_instrumental',
        type: 'boolean',
        label: 'Make Instrumental',
        default: true
      }
    ]
  },
  'udioapi': {
    id: 'udioapi',
    name: 'UdioAPI.pro',
    description: 'Alternative API for music generation',
    fields: [
      {
        name: 'prompt',
        type: 'text',
        label: 'Music Prompt',
        description: 'Describe your lofi beat',
        required: true
      },
      {
        name: 'title',
        type: 'text',
        label: 'Track Title',
        default: 'Untitled'
      },
      {
        name: 'tags',
        type: 'text',
        label: 'Tags',
        description: 'Comma-separated tags',
        default: 'lofi, chill, instrumental'
      }
    ]
  }
}

// Helper function to get schema for a model
export function getModelSchema(modelType: 'image' | 'video' | 'music', modelId: string): ModelSchema | null {
  switch (modelType) {
    case 'image':
      return imageModelSchemas[modelId] || null
    case 'video':
      return videoModelSchemas[modelId] || null
    case 'music':
      return musicModelSchemas[modelId] || null
    default:
      return null
  }
}