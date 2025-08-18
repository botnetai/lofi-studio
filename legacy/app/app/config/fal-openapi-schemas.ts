// Known Fal.ai OpenAPI schemas
// These are extracted from the Fal.ai documentation

export const FAL_OPENAPI_SCHEMAS: Record<string, any> = {
  'fal-ai/flux-pro/v1.1-ultra': {
    inputs: {
      prompt: {
        type: 'string',
        description: 'The prompt to generate an image from.',
        required: true,
        examples: ['Extreme close-up of a single tiger eye, direct frontal view. Detailed iris and pupil. Sharp focus on eye texture and color. Natural lighting to capture authentic eye shine and depth. The word "FLUX" is painted over it in big, white brush strokes with visible texture.']
      },
      aspect_ratio: {
        type: 'string',
        enum: ['21:9', '16:9', '4:3', '3:2', '1:1', '2:3', '3:4', '9:16', '9:21'],
        default: '16:9',
        description: 'The aspect ratio of the generated image.'
      },
      num_images: {
        type: 'integer',
        minimum: 1,
        maximum: 4,
        default: 1,
        description: 'The number of images to generate.'
      },
      output_format: {
        type: 'string',
        enum: ['jpeg', 'png'],
        default: 'jpeg',
        description: 'The format of the generated image.'
      },
      sync_mode: {
        type: 'boolean',
        default: false,
        description: 'If set to true, the function will wait for the image to be generated and uploaded before returning the response.'
      },
      safety_tolerance: {
        type: 'string',
        enum: ['1', '2', '3', '4', '5', '6'],
        default: '2',
        description: 'The safety tolerance level for the generated image. 1 being the most strict and 6 being the most permissive.'
      },
      enable_safety_checker: {
        type: 'boolean',
        default: true,
        description: 'If set to true, the safety checker will be enabled.'
      },
      seed: {
        type: 'integer',
        description: 'The same seed and the same prompt given to the same version of the model will output the same image every time.'
      },
      raw: {
        type: 'boolean',
        default: false,
        description: 'Generate less processed, more natural-looking images.'
      }
    }
  },
  
  // Add more schemas as we discover them from the documentation
  // TODO: Fetch Kling video model schemas to determine which support tail_image_url
}

// Function to check if a model supports a specific input field
export function modelSupportsField(modelId: string, fieldName: string): boolean {
  const schema = FAL_OPENAPI_SCHEMAS[modelId]
  if (!schema) return false
  return schema.inputs && schema.inputs[fieldName] !== undefined
}