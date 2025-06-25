import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'default'
  size?: 'sm' | 'md' | 'lg' | 'icon'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        {...props}
        className={cn(
          // Base styles
          'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'focus:ring-offset-gray-900',
          
          // Variant styles
          {
            // Primary (purple gradient)
            'bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800 active:from-purple-800 active:to-purple-900':
              variant === 'primary' || variant === 'default',
            
            // Secondary (gray)
            'bg-gray-800 text-gray-100 hover:bg-gray-700 active:bg-gray-600 border border-gray-700':
              variant === 'secondary',
            
            // Ghost (transparent)
            'hover:bg-gray-800 text-gray-300 hover:text-gray-100 active:bg-gray-700':
              variant === 'ghost',
            
            // Outline
            'border border-gray-600 bg-transparent text-gray-300 hover:bg-gray-800 hover:text-gray-100 hover:border-gray-500':
              variant === 'outline',
          },
          
          // Size styles
          {
            'h-8 px-3 text-sm': size === 'sm',
            'h-10 px-4': size === 'md',
            'h-12 px-6 text-lg': size === 'lg',
            'h-10 w-10 p-0': size === 'icon',
          },
          
          className
        )}
      />
    )
  }
)

Button.displayName = 'Button'