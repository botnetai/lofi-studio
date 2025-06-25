import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { Label } from './ui/Label'
import { Select } from './ui/Select'
import { Input } from './ui/Input'
import { Textarea } from './ui/Textarea'
import { Checkbox } from './ui/Checkbox'
import { useModelSchema } from '../hooks/useModelSchema'
import { FAL_MODELS, FalModel } from '../lib/fal-model-discovery'

interface DynamicGenerationFormProps {
  category: 'text-to-image' | 'image-to-image' | 'image-to-video' | 'text-to-video'
  onGenerate: (modelId: string, params: any) => Promise<void>
  selectedImage?: string | null
  allImages?: any[]
}

export function DynamicGenerationForm({ 
  category, 
  onGenerate, 
  selectedImage,
  allImages = []
}: DynamicGenerationFormProps) {
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [models, setModels] = useState<FalModel[]>([])
  const [formValues, setFormValues] = useState<Record<string, any>>({})
  const [isGenerating, setIsGenerating] = useState(false)
  
  const { schema, formFields, loading: schemaLoading, error: schemaError } = useModelSchema(selectedModel)
  
  // Load models for category
  useEffect(() => {
    const categoryModels = FAL_MODELS[category] || []
    setModels(categoryModels)
    
    // Set default model
    if (categoryModels.length > 0 && !selectedModel) {
      setSelectedModel(categoryModels[0].id)
    }
  }, [category])
  
  // Initialize form values when schema loads
  useEffect(() => {
    if (schema?.inputs) {
      const initialValues: Record<string, any> = {}
      
      for (const [key, input] of Object.entries(schema.inputs)) {
        if (input.default !== undefined) {
          initialValues[key] = input.default
        }
      }
      
      setFormValues(initialValues)
    }
  }, [schema])
  
  const handleFieldChange = (name: string, value: any) => {
    setFormValues(prev => ({
      ...prev,
      [name]: value
    }))
  }
  
  const handleSubmit = async () => {
    setIsGenerating(true)
    
    try {
      // Prepare parameters based on category
      const params: any = { ...formValues }
      
      // Add image URL for image-based categories
      if ((category === 'image-to-image' || category === 'image-to-video') && selectedImage) {
        params.imageId = selectedImage
      }
      
      await onGenerate(selectedModel, params)
    } catch (error) {
      console.error('Generation error:', error)
    } finally {
      setIsGenerating(false)
    }
  }
  
  // Check if we need image selection
  const needsImageSelection = category === 'image-to-image' || category === 'image-to-video'
  const canGenerate = !needsImageSelection || selectedImage
  
  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-6">
        {category === 'text-to-image' || category === 'image-to-image' 
          ? 'Generate Image' 
          : category === 'image-to-video' 
          ? 'Generate Video'
          : 'Generate'
        }
      </h2>
      
      <div className="space-y-4">
        {/* Model Selection */}
        <div>
          <Label>AI Model</Label>
          <Select
            value={selectedModel}
            onValueChange={setSelectedModel}
            options={models.map(model => ({
              value: model.id,
              label: model.name,
              description: model.description
            }))}
            className="w-full mt-1"
          />
        </div>
        
        {/* Image Selection for image-based generation */}
        {needsImageSelection && (
          <div>
            <Label>Source Image</Label>
            {selectedImage ? (
              <div className="mt-2">
                <div className="relative w-32 h-32 rounded-lg overflow-hidden">
                  <img 
                    src={allImages.find(img => img.id === selectedImage)?.url} 
                    alt="Selected" 
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 mt-1">
                Select an image from the Media Library
              </p>
            )}
          </div>
        )}
        
        {/* Loading Schema */}
        {schemaLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>Loading model parameters...</span>
          </div>
        )}
        
        {/* Schema Error */}
        {schemaError && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg">
            Error loading model schema: {schemaError}
          </div>
        )}
        
        {/* Dynamic Form Fields */}
        {!schemaLoading && !schemaError && formFields.length > 0 && (
          <div className="space-y-4">
            {formFields.map((field) => {
              const value = formValues[field.name] ?? field.default
              
              switch (field.type) {
                case 'textarea':
                  return (
                    <div key={field.name}>
                      <Label htmlFor={field.name}>
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </Label>
                      <Textarea
                        id={field.name}
                        value={value || ''}
                        onChange={(e) => handleFieldChange(field.name, e.target.value)}
                        placeholder={field.description}
                        disabled={isGenerating}
                        className="mt-1"
                        rows={3}
                      />
                    </div>
                  )
                  
                case 'number':
                case 'range':
                  return (
                    <div key={field.name}>
                      <Label htmlFor={field.name}>
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </Label>
                      <Input
                        id={field.name}
                        type="number"
                        value={value || ''}
                        onChange={(e) => handleFieldChange(field.name, e.target.value ? Number(e.target.value) : '')}
                        placeholder={field.description}
                        disabled={isGenerating}
                        className="mt-1"
                        min={field.min}
                        max={field.max}
                        step={field.step}
                      />
                      {field.description && (
                        <p className="text-xs text-gray-500 mt-1">{field.description}</p>
                      )}
                    </div>
                  )
                  
                case 'select':
                  return (
                    <div key={field.name}>
                      <Label htmlFor={field.name}>
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </Label>
                      <Select
                        value={value?.toString() || ''}
                        onValueChange={(val) => handleFieldChange(field.name, val)}
                        options={field.options || []}
                        disabled={isGenerating}
                        className="mt-1"
                      />
                    </div>
                  )
                  
                case 'boolean':
                  return (
                    <div key={field.name} className="flex items-center gap-2">
                      <Checkbox
                        id={field.name}
                        checked={!!value}
                        onCheckedChange={(checked) => handleFieldChange(field.name, checked)}
                        disabled={isGenerating}
                      />
                      <Label htmlFor={field.name} className="cursor-pointer">
                        {field.label}
                      </Label>
                    </div>
                  )
                  
                default:
                  return (
                    <div key={field.name}>
                      <Label htmlFor={field.name}>
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </Label>
                      <Input
                        id={field.name}
                        type="text"
                        value={value || ''}
                        onChange={(e) => handleFieldChange(field.name, e.target.value)}
                        placeholder={field.description}
                        disabled={isGenerating}
                        className="mt-1"
                      />
                    </div>
                  )
              }
            })}
          </div>
        )}
        
        {/* Generate Button */}
        <Button
          onClick={handleSubmit}
          disabled={isGenerating || !canGenerate || !schema}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            'Generate'
          )}
        </Button>
      </div>
    </Card>
  )
}