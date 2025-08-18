import { createRootRoute, Outlet, ScrollRestoration } from '@tanstack/react-router'
import { Meta, Scripts } from '@tanstack/start'
import { ThemeProvider } from '../components/theme-provider'
import { Navigation } from '../components/navigation'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Lofi Studio</title>
        <Meta />
      </head>
      <body>
        <ThemeProvider defaultTheme="system">
          <div className="relative min-h-screen bg-background">
            <Navigation />
            <main className="container py-6">
              <Outlet />
            </main>
          </div>
          <ScrollRestoration />
          <Scripts />
        </ThemeProvider>
      </body>
    </html>
  )
}