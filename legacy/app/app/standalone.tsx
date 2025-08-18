import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider, useTheme } from './components/theme-provider'
import { GenerateMusic } from './components/GenerateMusic'
import { MusicLibrary } from './components/MusicLibrary'
import './styles/globals.css'

// Simple navigation component without router
function SimpleNavigation() {
  const { theme, setTheme } = useTheme()
  
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <a href="/" className="mr-6 flex items-center space-x-2">
            <span className="font-bold">Lofi Studio</span>
          </a>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          <button
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 w-10"
            onClick={() => {
              if (theme === "light") setTheme("dark")
              else if (theme === "dark") setTheme("system")
              else setTheme("light")
            }}
            title={`Current theme: ${theme}. Click to change.`}
          >
            {theme === "light" && <span>☀️</span>}
            {theme === "dark" && <span>🌙</span>}
            {theme === "system" && <span>💻</span>}
            <span className="sr-only">Toggle theme</span>
          </button>
        </div>
      </div>
    </header>
  )
}

function App() {
  return (
    <ThemeProvider defaultTheme="system">
      <div className="relative min-h-screen bg-background">
        <SimpleNavigation />
        <main className="container py-6">
          <div className="space-y-8">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold mb-2">Generate Lofi Music</h1>
              <p className="text-muted-foreground">
                Create AI-powered lofi beats with custom prompts and lyrics
              </p>
            </div>
            
            <GenerateMusic />
            
            <div className="mt-12">
              <MusicLibrary />
            </div>
          </div>
        </main>
      </div>
    </ThemeProvider>
  )
}

const root = ReactDOM.createRoot(document.getElementById('root')!)
root.render(<App />)