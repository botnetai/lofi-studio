import { Checkbox as BaseCheckbox } from '@base-ui-components/react'
import { forwardRef } from 'react'
import { cn } from '../../lib/utils'
import { Check } from 'lucide-react'

interface CheckboxProps extends React.HTMLAttributes<HTMLButtonElement> {
  className?: string
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
}

export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, disabled, ...props }, ref) => {
    return (
      <BaseCheckbox.Root
        ref={ref}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          'h-4 w-4 rounded border border-gray-600 bg-gray-800',
          'transition-all duration-200',
          'hover:border-gray-500',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900',
          'data-[checked]:bg-purple-600 data-[checked]:border-purple-600',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      >
        <BaseCheckbox.Indicator className="flex items-center justify-center text-white">
          <Check className="h-3 w-3" />
        </BaseCheckbox.Indicator>
      </BaseCheckbox.Root>
    )
  }
)

Checkbox.displayName = 'Checkbox'