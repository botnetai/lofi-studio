import { Menu } from '@base-ui-components/react'
import { forwardRef, useState, useMemo } from 'react'
import { cn } from '../../lib/utils'
import { ChevronDown, Check } from 'lucide-react'

interface DropdownProps {
  value?: string
  onValueChange?: (value: string) => void
  defaultValue?: string
  disabled?: boolean
  options: Array<{ value: string; label: string; description?: string }>
  placeholder?: string
  className?: string
}

export const Dropdown = forwardRef<HTMLDivElement, DropdownProps>(
  ({ options, placeholder = 'Select an option', className, value, onValueChange, defaultValue, disabled }, ref) => {
    const [internalValue, setInternalValue] = useState(defaultValue || '')
    const currentValue = value !== undefined ? value : internalValue
    
    // Find the selected option to display its label and description
    const selectedOption = useMemo(
      () => options.find(opt => opt.value === currentValue),
      [options, currentValue]
    )
    
    const handleSelect = (newValue: string) => {
      if (value === undefined) {
        setInternalValue(newValue)
      }
      onValueChange?.(newValue)
    }
    
    return (
      <Menu.Root>
        <Menu.Trigger
          ref={ref}
          disabled={disabled}
          className={cn(
            'w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5 text-gray-900 dark:text-gray-100',
            'flex items-center justify-between gap-2',
            'hover:border-gray-300 dark:hover:border-gray-600 transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:border-transparent',
            'data-[popup-open]:ring-2 data-[popup-open]:ring-purple-500 data-[popup-open]:border-transparent',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            className
          )}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="truncate">
              {selectedOption?.label || placeholder}
            </span>
            {selectedOption?.description && (
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {selectedOption.description}
              </span>
            )}
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        </Menu.Trigger>
        
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup className="z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 mt-1 min-w-[200px] max-h-72 overflow-auto">
              {options.map((option) => (
                <Menu.Item
                  key={option.value}
                  onSelect={() => handleSelect(option.value)}
                  className={cn(
                    'px-4 py-3 text-gray-700 dark:text-gray-100 cursor-pointer transition-all relative',
                    'hover:bg-gray-50 dark:hover:bg-gray-800',
                    'focus-visible:bg-gray-50 dark:focus-visible:bg-gray-800',
                    'focus-visible:outline-none',
                    currentValue === option.value && [
                      'bg-purple-50 dark:bg-purple-900/20',
                      'text-purple-900 dark:text-purple-100',
                      'pl-10'
                    ]
                  )}
                >
                  {currentValue === option.value && (
                    <Check className="w-4 h-4 text-purple-500 absolute left-3 top-3.5" />
                  )}
                  <div>
                    <div className="font-medium">{option.label}</div>
                    {option.description && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {option.description}
                      </div>
                    )}
                  </div>
                </Menu.Item>
              ))}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    )
  }
)

Dropdown.displayName = 'Dropdown'