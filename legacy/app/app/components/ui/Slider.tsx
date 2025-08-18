import { Slider as BaseSlider } from '@base-ui-components/react'
import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

interface SliderProps {
  value?: number[]
  onValueChange?: (value: number[]) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  className?: string
}

export const Slider = forwardRef<HTMLDivElement, SliderProps>(
  ({ value = [0], onValueChange, min = 0, max = 100, step = 1, disabled, className }, ref) => {
    return (
      <BaseSlider.Root
        ref={ref}
        value={value}
        onValueChange={onValueChange}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className={cn(
          'relative flex items-center w-full h-5 touch-none select-none',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
      >
        <BaseSlider.Track className="relative w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full">
          <BaseSlider.Range className="absolute h-full bg-blue-600 rounded-full" />
        </BaseSlider.Track>
        <BaseSlider.Thumb className="block w-4 h-4 bg-white border-2 border-blue-600 rounded-full shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-shadow" />
      </BaseSlider.Root>
    )
  }
)

Slider.displayName = 'Slider'