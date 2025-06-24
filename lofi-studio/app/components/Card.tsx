import { HTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          'rounded-lg border border-border bg-secondary p-6 shadow-sm',
          className
        )}
        {...props}
      />
    )
  }
)

Card.displayName = 'Card'