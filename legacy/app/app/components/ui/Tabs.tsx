import { Tabs as BaseTabs } from '@base-ui-components/react'
import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

export const TabsRoot = BaseTabs.Root

interface TabsListProps extends BaseTabs.ListProps {
  className?: string
}

export const TabsList = forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, ...props }, ref) => {
    return (
      <BaseTabs.List
        ref={ref}
        className={cn(
          'flex items-center gap-1 p-1 bg-gray-800/50 rounded-lg border border-gray-700',
          className
        )}
        {...props}
      />
    )
  }
)

interface TabsTriggerProps extends BaseTabs.TabProps {
  className?: string
}

export const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, ...props }, ref) => {
    return (
      <BaseTabs.Tab
        ref={ref}
        className={cn(
          'px-4 py-2 rounded-md text-sm font-medium transition-all duration-200',
          'text-gray-400 hover:text-gray-100',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900',
          'data-[selected]:bg-gray-700 data-[selected]:text-white data-[selected]:shadow-sm',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
        {...props}
      />
    )
  }
)

interface TabsContentProps extends BaseTabs.PanelProps {
  className?: string
}

export const TabsContent = forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, ...props }, ref) => {
    return (
      <BaseTabs.Panel
        ref={ref}
        className={cn(
          'mt-4 focus-visible:outline-none',
          'data-[hidden]:hidden',
          className
        )}
        {...props}
      />
    )
  }
)

TabsList.displayName = 'TabsList'
TabsTrigger.displayName = 'TabsTrigger'
TabsContent.displayName = 'TabsContent'

// Export as a compound component
export const Tabs = {
  Root: TabsRoot,
  List: TabsList,
  Trigger: TabsTrigger,
  Content: TabsContent,
}