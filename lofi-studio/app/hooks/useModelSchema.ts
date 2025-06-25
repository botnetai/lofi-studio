import { useState, useEffect } from 'react'
import { FalModelSchema, falSchemaToFormFields } from '../lib/fal-models'

export function useModelSchema(modelId: string | null) {
  const [schema, setSchema] = useState<FalModelSchema | null>(null)
  const [formFields, setFormFields] = useState<any[]>([])
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
          const fields = falSchemaToFormFields(data)
          setFormFields(fields)
        }
      } catch (err: any) {
        console.error('Error fetching model schema:', err)
        setError(err.message)
        
        // Fall back to static schema if available
        try {
          const fallbackResponse = await fetch(`/api/model-schemas?type=video&id=${modelId}`)
          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json()
            if (fallbackData.fields) {
              setFormFields(fallbackData.fields)
            }
          }
        } catch (fallbackErr) {
          console.error('Fallback also failed:', fallbackErr)
        }
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