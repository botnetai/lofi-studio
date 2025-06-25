import { Select as BaseSelect } from '@base-ui-components/react'
import { forwardRef } from 'react'
import { cn } from '../../lib/utils'
import { ChevronDown } from 'lucide-react'

interface SelectProps {
  value?: string
  onValueChange?: (value: string) => void
  defaultValue?: string
  disabled?: boolean
  options: Array<{ value: string; label: string; description?: string }>
  placeholder?: string
  className?: string
}

export const Select = forwardRef<HTMLDivElement, SelectProps>(
  ({ options, placeholder = 'Select an option', className, ...props }, ref) => {
    return (
      <BaseSelect.Root {...props}>
        <BaseSelect.Trigger
          ref={ref}
          className={cn(
            'w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-gray-100',
            'flex items-center justify-between',
            'hover:bg-gray-750 hover:border-gray-600 transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:border-transparent',
            'data-[popup-open]:ring-2 data-[popup-open]:ring-purple-500 data-[popup-open]:border-transparent',
            className
          )}
        >
          <BaseSelect.Value placeholder={placeholder} />
          <BaseSelect.Icon>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </BaseSelect.Icon>
        </BaseSelect.Trigger>
        
        <BaseSelect.Portal>
          <BaseSelect.Positioner>
            <BaseSelect.Popup className="z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 mt-1 max-h-60 overflow-auto">
              {options.map((option) => (
                <BaseSelect.Option
                  key={option.value}
                  value={option.value}
                  className={cn(
                    'px-4 py-2.5 text-gray-100 cursor-pointer transition-colors relative',
                    'hover:bg-gray-700',
                    'data-[selected]:bg-purple-600 data-[selected]:text-white',
                    'focus-visible:outline-none focus-visible:bg-gray-700'
                  )}
                >
                  <div>
                    <div className="font-medium">{option.label}</div>
                    {option.description && (
                      <div className="text-xs text-gray-400 mt-0.5">{option.description}</div>
                    )}
                  </div>
                </BaseSelect.Option>
              ))}
            </BaseSelect.Popup>
          </BaseSelect.Positioner>
        </BaseSelect.Portal>
      </BaseSelect.Root>
    )
  }
)

Select.displayName = 'Select'