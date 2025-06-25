import { useState, useEffect } from 'react'

export interface ModelInput {
  type: string
  description?: string
  default?: any
  required?: boolean
  minimum?: number
  maximum?: number
  enum?: string[]
  examples?: string[]
}

export interface ModelSchema {
  inputs: Record<string, ModelInput>
  outputs?: Record<string, any>
}

export interface FormField {
  name: string
  type: 'text' | 'textarea' | 'number' | 'select' | 'boolean' | 'range'
  label: string
  description?: string
  required?: boolean
  default?: any
  min?: number
  max?: number
  step?: number
  options?: Array<{ value: string | number; label: string }>
  examples?: string[]
}

// Convert Fal.ai schema to form fields
function schemaToFormFields(schema: ModelSchema): FormField[] {
  const fields: FormField[] = []
  
  for (const [key, input] of Object.entries(schema.inputs || {})) {
    // Skip fields we handle separately
    if (key === 'image_url' || key === 'sync_mode') continue
    
    const field: FormField = {
      name: key,
      label: key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      description: input.description,
      required: input.required,
      default: input.default,
      examples: input.examples,
      type: 'text' // default
    }
    
    // Determine field type based on schema
    if (input.enum) {
      field.type = 'select'
      field.options = input.enum.map(value => ({
        value,
        label: value.toString()
      }))
    } else if (input.type === 'boolean') {
      field.type = 'boolean'
    } else if (input.type === 'integer' || input.type === 'number') {
      if (input.minimum !== undefined && input.maximum !== undefined && (input.maximum - input.minimum) <= 100) {
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
      // Use textarea for prompts and descriptions
      if (key.includes('prompt') || key.includes('description')) {
        field.type = 'textarea'
      } else {
        field.type = 'text'
      }
    }
    
    fields.push(field)
  }
  
  // Sort fields to put required ones first
  fields.sort((a, b) => {
    if (a.required && !b.required) return -1
    if (!a.required && b.required) return 1
    // Put prompt fields first
    if (a.name.includes('prompt') && !b.name.includes('prompt')) return -1
    if (!a.name.includes('prompt') && b.name.includes('prompt')) return 1
    return 0
  })
  
  return fields
}

export function useModelSchema(modelId: string | null) {
  const [schema, setSchema] = useState<ModelSchema | null>(null)
  const [formFields, setFormFields] = useState<FormField[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!modelId) {
      setSchema(null)
      setFormFields([])
      return
    }

    const fetchSchema = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const response = await fetch(`/api/fal-model-schema/${encodeURIComponent(modelId)}`)
        const data = await response.json()
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch model schema')
        }
        
        setSchema(data)
        
        // Convert to form fields
        if (data.inputs) {
          const fields = schemaToFormFields(data)
          setFormFields(fields)
        }
      } catch (err: any) {
        console.error('Error fetching model schema:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchSchema()
  }, [modelId])

  return {
    schema,
    formFields,
    loading,
    error,
    hasField: (fieldName: string) => {
      return schema?.inputs?.[fieldName] !== undefined
    }
  }
}