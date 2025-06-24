import { build } from 'esbuild'
import { mkdir, readFile, writeFile, cp } from 'fs/promises'
import { join } from 'path'

// Clean and create dist directory
await mkdir('dist', { recursive: true })

// Read the HTML template
const indexHtml = `<!DOCTYPE html>
<html lang="en" suppressHydrationWarning>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lofi Studio</title>
  <link rel="stylesheet" href="/app.css">
</head>
<body>
  <div id="root"></div>
  <script src="/app.js"></script>
</body>
</html>`

// Write HTML
await writeFile('dist/index.html', indexHtml)

// Build CSS
const css = await readFile('app/styles/globals.css', 'utf-8')
await writeFile('dist/app.css', css)

// Build JavaScript - create a simple entry point
const entryPoint = `
import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider } from './app/components/theme-provider'
import { Navigation } from './app/components/navigation'
import { GenerateMusic } from './app/components/GenerateMusic'
import { MusicLibrary } from './app/components/MusicLibrary'
import './app/styles/globals.css'

function App() {
  return (
    <ThemeProvider defaultTheme="system">
      <div className="relative min-h-screen bg-background">
        <Navigation />
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

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(<App />)
`

await writeFile('temp-entry.jsx', entryPoint)

// Build the app
await build({
  entryPoints: ['temp-entry.jsx'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  outfile: 'dist/app.js',
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts',
    '.jsx': 'jsx',
    '.js': 'js',
    '.css': 'css'
  },
  jsx: 'automatic',
  external: []
})

console.log('Static build complete!')