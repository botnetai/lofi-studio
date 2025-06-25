// Fal.ai model discovery and categorization

export interface FalModel {
  id: string
  name: string
  category: 'text-to-image' | 'image-to-image' | 'image-to-video' | 'text-to-video'
  description?: string
  thumbnailUrl?: string
  inputs?: Record<string, any>
}

// Known Fal.ai models by category
// This list can be expanded or fetched dynamically from Fal.ai
export const FAL_MODELS: Record<string, FalModel[]> = {
  'text-to-image': [
    { id: 'fal-ai/flux-pro/v1.1-ultra', name: 'FLUX Pro 1.1 Ultra', category: 'text-to-image' },
    { id: 'fal-ai/flux-pro', name: 'FLUX Pro', category: 'text-to-image' },
    { id: 'fal-ai/flux/dev', name: 'FLUX Dev', category: 'text-to-image' },
    { id: 'fal-ai/flux/schnell', name: 'FLUX Schnell', category: 'text-to-image' },
    { id: 'fal-ai/stable-diffusion-xl', name: 'Stable Diffusion XL', category: 'text-to-image' },
    { id: 'fal-ai/stable-diffusion-xl-lightning', name: 'SDXL Lightning', category: 'text-to-image' },
    { id: 'fal-ai/aura-flow', name: 'Aura Flow', category: 'text-to-image' },
    { id: 'fal-ai/kolors', name: 'Kolors', category: 'text-to-image' },
    { id: 'fal-ai/stable-cascade', name: 'Stable Cascade', category: 'text-to-image' }
  ],
  'image-to-image': [
    { id: 'fal-ai/flux-kontext', name: 'FLUX Kontext', category: 'image-to-image' },
    { id: 'fal-ai/creative-upscaler', name: 'Creative Upscaler', category: 'image-to-image' },
    { id: 'fal-ai/clarity-upscaler', name: 'Clarity Upscaler', category: 'image-to-image' },
    { id: 'fal-ai/face-to-sticker', name: 'Face to Sticker', category: 'image-to-image' },
    { id: 'fal-ai/imageutils/rembg', name: 'Remove Background', category: 'image-to-image' },
    { id: 'fal-ai/controlnet-sdxl', name: 'ControlNet SDXL', category: 'image-to-image' }
  ],
  'image-to-video': [
    { id: 'fal-ai/kling-video/v2.1/standard/image-to-video', name: 'Kling 2.1 Standard', category: 'image-to-video' },
    { id: 'fal-ai/kling-video/v2.1/pro/image-to-video', name: 'Kling 2.1 Pro', category: 'image-to-video' },
    { id: 'fal-ai/kling-video/v2.1/master/image-to-video', name: 'Kling 2.1 Master', category: 'image-to-video' },
    { id: 'fal-ai/kling-video/v2/standard/image-to-video', name: 'Kling 2.0 Standard', category: 'image-to-video' },
    { id: 'fal-ai/kling-video/v2/pro/image-to-video', name: 'Kling 2.0 Pro', category: 'image-to-video' },
    { id: 'fal-ai/kling-video/v2/master/image-to-video', name: 'Kling 2.0 Master', category: 'image-to-video' },
    { id: 'fal-ai/kling-video/v1.6/standard/image-to-video', name: 'Kling 1.6 Standard', category: 'image-to-video' },
    { id: 'fal-ai/kling-video/v1.6/pro/image-to-video', name: 'Kling 1.6 Pro', category: 'image-to-video' },
    { id: 'fal-ai/kling-video/v1.5/pro/image-to-video', name: 'Kling 1.5 Pro', category: 'image-to-video' },
    { id: 'fal-ai/kling-video/v1/pro/image-to-video', name: 'Kling 1.0 Pro', category: 'image-to-video' },
    { id: 'fal-ai/stable-video', name: 'Stable Video Diffusion', category: 'image-to-video' },
    { id: 'fal-ai/animatediff-sparsectrl-lcm', name: 'AnimateDiff Sparse', category: 'image-to-video' },
    { id: 'fal-ai/animatediff-v2v', name: 'AnimateDiff V2V', category: 'image-to-video' }
  ],
  'text-to-video': [
    { id: 'fal-ai/ltx-video', name: 'LTX Video', category: 'text-to-video' },
    { id: 'fal-ai/animatediff', name: 'AnimateDiff', category: 'text-to-video' }
  ]
}

// Fetch models for a specific category
export async function fetchModelsForCategory(category: keyof typeof FAL_MODELS): Promise<FalModel[]> {
  // For now, return static list. In future, this could fetch from Fal.ai API
  return FAL_MODELS[category] || []
}

// Fetch all available models
export async function fetchAllModels(): Promise<FalModel[]> {
  const allModels: FalModel[] = []
  for (const category of Object.keys(FAL_MODELS)) {
    allModels.push(...FAL_MODELS[category as keyof typeof FAL_MODELS])
  }
  return allModels
}

// Determine model category from ID
export function getModelCategory(modelId: string): string {
  for (const [category, models] of Object.entries(FAL_MODELS)) {
    if (models.some(m => m.id === modelId)) {
      return category
    }
  }
  
  // Fallback detection based on ID patterns
  if (modelId.includes('video')) {
    if (modelId.includes('image-to-video')) return 'image-to-video'
    return 'text-to-video'
  }
  if (modelId.includes('kontext') || modelId.includes('upscaler') || modelId.includes('controlnet')) {
    return 'image-to-image'
  }
  return 'text-to-image'
}