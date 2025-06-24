import * as React from "react"
import { Checkbox as BaseCheckbox } from "@base-ui-components/react/checkbox"
import { Check } from "lucide-react"
import { cn } from "../../lib/utils"

export interface CheckboxProps {
  className?: string
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
}

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => {
    return (
      <BaseCheckbox
        ref={ref}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className={cn(
          "peer h-4 w-4 shrink-0 rounded-sm border border-input bg-background ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
          className
        )}
        {...props}
      >
        <BaseCheckbox.Indicator className="flex items-center justify-center text-current">
          <Check className="h-4 w-4" />
        </BaseCheckbox.Indicator>
      </BaseCheckbox>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }