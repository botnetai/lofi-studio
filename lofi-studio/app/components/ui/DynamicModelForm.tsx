import { ModelField, ModelSchema } from '../../config/model-schemas'
import { Input } from './Input'
import { Textarea } from './Textarea'
import { Select } from './Select'
import { Checkbox } from './Checkbox'
import { Label } from './Label'
import { Slider } from './Slider'

interface DynamicModelFormProps {
  schema: ModelSchema
  values: Record<string, any>
  onChange: (name: string, value: any) => void
  disabled?: boolean
}

export function DynamicModelForm({ schema, values, onChange, disabled }: DynamicModelFormProps) {
  const renderField = (field: ModelField) => {
    const value = values[field.name] ?? field.default
    
    switch (field.type) {
      case 'text':
        if (field.name.includes('prompt') || field.name.includes('lyrics')) {
          return (
            <Textarea
              id={field.name}
              value={value || ''}
              onChange={(e) => onChange(field.name, e.target.value)}
              placeholder={field.description}
              disabled={disabled}
              className="mt-1"
              rows={field.name.includes('lyrics') ? 6 : 3}
            />
          )
        }
        return (
          <Input
            id={field.name}
            type="text"
            value={value || ''}
            onChange={(e) => onChange(field.name, e.target.value)}
            placeholder={field.description}
            disabled={disabled}
            className="mt-1"
          />
        )
        
      case 'number':
        return (
          <Input
            id={field.name}
            type="number"
            value={value || ''}
            onChange={(e) => onChange(field.name, e.target.value ? Number(e.target.value) : '')}
            placeholder={field.description}
            disabled={disabled}
            className="mt-1"
            min={field.min}
            max={field.max}
            step={field.step}
          />
        )
        
      case 'select':
        return (
          <Select
            value={value?.toString() || ''}
            onValueChange={(val) => {
              // Convert back to number if the original options were numbers
              const option = field.options?.find(opt => opt.value.toString() === val)
              onChange(field.name, option?.value || val)
            }}
            options={field.options?.map(opt => ({
              value: opt.value.toString(),
              label: opt.label
            })) || []}
            disabled={disabled}
            className="mt-1"
          />
        )
        
      case 'boolean':
        return (
          <div className="flex items-center gap-2 mt-2">
            <Checkbox
              id={field.name}
              checked={!!value}
              onCheckedChange={(checked) => onChange(field.name, checked)}
              disabled={disabled}
            />
            <Label htmlFor={field.name} className="cursor-pointer text-sm">
              {field.description || field.label}
            </Label>
          </div>
        )
        
      case 'range':
        return (
          <div className="mt-2 space-y-2">
            <div className="flex justify-between text-sm">
              <span>{field.min}</span>
              <span className="font-medium">{value}</span>
              <span>{field.max}</span>
            </div>
            <Slider
              value={[value || field.default || field.min || 0]}
              onValueChange={([val]) => onChange(field.name, val)}
              min={field.min}
              max={field.max}
              step={field.step}
              disabled={disabled}
              className="mt-1"
            />
          </div>
        )
        
      default:
        return null
    }
  }
  
  return (
    <div className="space-y-4">
      {schema.fields.map((field) => {
        // Skip conditional fields
        if (field.name === 'lyrics' && !values.custom_mode) {
          return null
        }
        
        return (
          <div key={field.name}>
            {field.type !== 'boolean' && (
              <Label htmlFor={field.name}>
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
            )}
            {renderField(field)}
            {field.description && field.type !== 'boolean' && (
              <p className="text-xs text-gray-500 mt-1">{field.description}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}