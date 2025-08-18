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
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'focus:ring-offset-white dark:focus:ring-offset-gray-900',
          
          // Variant styles
          {
            // Primary (blue gradient)
            'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 active:from-blue-800 active:to-blue-900 shadow-sm':
              variant === 'primary' || variant === 'default',
            
            // Secondary (light gray)
            'bg-gray-100 text-gray-900 hover:bg-gray-200 active:bg-gray-300 border border-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 dark:border-gray-700':
              variant === 'secondary',
            
            // Ghost (transparent)
            'hover:bg-gray-100 text-gray-700 hover:text-gray-900 active:bg-gray-200 dark:hover:bg-gray-800 dark:text-gray-300 dark:hover:text-gray-100':
              variant === 'ghost',
            
            // Outline
            'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-400 dark:border-gray-600 dark:bg-transparent dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100':
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