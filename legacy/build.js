import { build } from 'esbuild'
import { cp, mkdir } from 'fs/promises'

// Create dist directory
await mkdir('dist', { recursive: true })

// Build the React app
await build({
  entryPoints: ['app/main.tsx'],
  bundle: true,
  minify: true,
  sourcemap: true,
  target: ['es2020'],
  outfile: 'dist/app.js',
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts',
    '.css': 'css'
  },
  external: [],
  format: 'esm',
  jsx: 'automatic',
  jsxImportSource: 'react'
})

// Copy index.html
await cp('index.html', 'dist/index.html')
await cp('app/styles/globals.css', 'dist/globals.css')

console.log('Build complete!')