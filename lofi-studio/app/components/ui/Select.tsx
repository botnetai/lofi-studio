import { Select as BaseSelect } from '@base-ui-components/react'
import { forwardRef, useMemo } from 'react'
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
  ({ options, placeholder = 'Select an option', className, value, ...props }, ref) => {
    // Find the selected option to display its description
    const selectedOption = useMemo(
      () => options.find(opt => opt.value === value),
      [options, value]
    )
    
    return (
      <BaseSelect.Root value={value} {...props}>
        <BaseSelect.Trigger
          ref={ref}
          className={cn(
            'w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-gray-100',
            'flex items-center justify-between gap-2',
            'hover:bg-gray-750 hover:border-gray-600 transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:border-transparent',
            'data-[popup-open]:ring-2 data-[popup-open]:ring-purple-500 data-[popup-open]:border-transparent',
            className
          )}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <BaseSelect.Value placeholder={placeholder} className="truncate" />
            {selectedOption?.description && (
              <span className="text-xs text-gray-400 truncate">
                {selectedOption.description}
              </span>
            )}
          </div>
          <BaseSelect.Icon className="flex-shrink-0">
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </BaseSelect.Icon>
        </BaseSelect.Trigger>
        
        <BaseSelect.Portal>
          <BaseSelect.Positioner>
            <BaseSelect.Popup className="z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl py-1 mt-1 max-h-72 overflow-auto backdrop-blur-xl">
              {options.map((option) => (
                <BaseSelect.Option
                  key={option.value}
                  value={option.value}
                  className={cn(
                    'px-4 py-3 text-gray-100 cursor-pointer transition-all relative',
                    'hover:bg-gray-800 hover:pl-5',
                    'data-[selected]:bg-gradient-to-r data-[selected]:from-purple-600/20 data-[selected]:to-purple-700/20',
                    'data-[selected]:border-l-2 data-[selected]:border-purple-500 data-[selected]:pl-5',
                    'focus-visible:outline-none focus-visible:bg-gray-800'
                  )}
                >
                  <div>
                    <div className="font-medium flex items-center justify-between">
                      <span>{option.label}</span>
                      {value === option.value && (
                        <span className="text-purple-400 ml-2">✓</span>
                      )}
                    </div>
                    {option.description && (
                      <div className="text-xs text-gray-500 mt-0.5 data-[selected]:text-gray-400">
                        {option.description}
                      </div>
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