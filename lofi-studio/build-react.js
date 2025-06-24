import { build } from 'esbuild'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Create dist directory
await mkdir('dist', { recursive: true })

// Build the React app
const result = await build({
  entryPoints: ['app/main.tsx'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts',
    '.jsx': 'jsx',
    '.js': 'js',
    '.css': 'css'
  },
  jsx: 'automatic',
  jsxImportSource: 'react',
  write: false,
  external: []
})

// Read the CSS file
const css = await readFile('app/styles/globals.css', 'utf-8')

// Create the HTML with embedded React app
const html = `<!DOCTYPE html>
<html lang="en" suppressHydrationWarning>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lofi Studio</title>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <style>
    ${css}
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    // Define require for UMD modules
    window.require = function(name) {
      if (name === 'react') return window.React;
      if (name === 'react-dom') return window.ReactDOM;
      if (name === 'react-dom/client') return window.ReactDOM;
      throw new Error('Unknown module: ' + name);
    };
    ${result.outputFiles[0].text}
  </script>
</body>
</html>`

await writeFile('dist/index.html', html)
console.log('React app built successfully!')