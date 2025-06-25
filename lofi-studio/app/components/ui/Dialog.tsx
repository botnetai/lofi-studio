import { Dialog as BaseDialog } from '@base-ui-components/react'
import { forwardRef } from 'react'
import { cn } from '../../lib/utils'
import { X } from 'lucide-react'

export const DialogRoot = BaseDialog.Root
export const DialogTrigger = BaseDialog.Trigger

interface DialogContentProps extends BaseDialog.PopupProps {
  className?: string
  showCloseButton?: boolean
}

export const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, showCloseButton = true, ...props }, ref) => {
    return (
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0" />
        <BaseDialog.Popup
          ref={ref}
          className={cn(
            'fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%]',
            'bg-gray-900 border border-gray-800 rounded-xl shadow-2xl',
            'data-[open]:animate-in data-[closed]:animate-out',
            'data-[closed]:fade-out-0 data-[open]:fade-in-0',
            'data-[closed]:zoom-out-95 data-[open]:zoom-in-95',
            'data-[closed]:slide-out-to-left-1/2 data-[closed]:slide-out-to-top-[48%]',
            'data-[open]:slide-in-from-left-1/2 data-[open]:slide-in-from-top-[48%]',
            'p-6',
            className
          )}
          {...props}
        >
          {showCloseButton && (
            <BaseDialog.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-gray-900 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:pointer-events-none">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </BaseDialog.Close>
          )}
          {children}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    )
  }
)

interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
}

export const DialogHeader = forwardRef<HTMLDivElement, DialogHeaderProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)}
        {...props}
      />
    )
  }
)

interface DialogTitleProps extends BaseDialog.TitleProps {
  className?: string
}

export const DialogTitle = forwardRef<HTMLHeadingElement, DialogTitleProps>(
  ({ className, ...props }, ref) => {
    return (
      <BaseDialog.Title
        ref={ref}
        className={cn('text-lg font-semibold leading-none tracking-tight text-gray-100', className)}
        {...props}
      />
    )
  }
)

interface DialogDescriptionProps extends BaseDialog.DescriptionProps {
  className?: string
}

export const DialogDescription = forwardRef<HTMLParagraphElement, DialogDescriptionProps>(
  ({ className, ...props }, ref) => {
    return (
      <BaseDialog.Description
        ref={ref}
        className={cn('text-sm text-gray-400', className)}
        {...props}
      />
    )
  }
)

DialogContent.displayName = 'DialogContent'
DialogHeader.displayName = 'DialogHeader'
DialogTitle.displayName = 'DialogTitle'
DialogDescription.displayName = 'DialogDescription'

// Export as a compound component
export const Dialog = {
  Root: DialogRoot,
  Trigger: DialogTrigger,
  Content: DialogContent,
  Header: DialogHeader,
  Title: DialogTitle,
  Description: DialogDescription,
  Close: BaseDialog.Close,
}