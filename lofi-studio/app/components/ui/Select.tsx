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
  ({ options, placeholder = 'Select an option', className, value, onValueChange, ...props }, ref) => {
    // Find the selected option to display its description
    const selectedOption = useMemo(
      () => options.find(opt => opt.value === value),
      [options, value]
    )
    
    const handleValueChange = (newValue: string) => {
      console.log('Select component value change:', newValue)
      onValueChange?.(newValue)
    }
    
    return (
      <BaseSelect.Root value={value} onValueChange={handleValueChange} {...props}>
        <BaseSelect.Trigger
          ref={ref}
          className={cn(
            'w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5 text-gray-900 dark:text-gray-100',
            'flex items-center justify-between gap-2',
            'hover:border-gray-300 dark:hover:border-gray-600 transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-transparent',
            'data-[popup-open]:ring-2 data-[popup-open]:ring-blue-500 data-[popup-open]:border-transparent',
            className
          )}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <BaseSelect.Value placeholder={placeholder} className="truncate" />
            {selectedOption?.description && (
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
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
            <BaseSelect.Popup className="z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 mt-1 max-h-72 overflow-auto">
              {options.map((option) => (
                <BaseSelect.Item
                  key={option.value}
                  value={option.value}
                  className={cn(
                    'px-4 py-3 text-gray-700 dark:text-gray-100 cursor-pointer transition-all relative',
                    'hover:bg-gray-50 dark:hover:bg-gray-800 hover:pl-5',
                    'data-[selected]:bg-blue-50 dark:data-[selected]:bg-blue-900/20',
                    'data-[selected]:border-l-2 data-[selected]:border-blue-500 data-[selected]:pl-5',
                    'data-[selected]:text-blue-900 dark:data-[selected]:text-blue-100',
                    'focus-visible:outline-none focus-visible:bg-gray-50 dark:focus-visible:bg-gray-800'
                  )}
                >
                  <div>
                    <div className="font-medium flex items-center justify-between">
                      <span>{option.label}</span>
                      {value === option.value && (
                        <span className="text-blue-400 ml-2">✓</span>
                      )}
                    </div>
                    {option.description && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {option.description}
                      </div>
                    )}
                  </div>
                </BaseSelect.Item>
              ))}
            </BaseSelect.Popup>
          </BaseSelect.Positioner>
        </BaseSelect.Portal>
      </BaseSelect.Root>
    )
  }
)

Select.displayName = 'Select'