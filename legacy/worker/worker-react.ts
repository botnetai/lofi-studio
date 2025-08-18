import { Hono } from 'hono'
import { cors } from 'hono/cors'

// Import the API routes from the existing worker
import workerCode from './worker-variants-fix.ts?raw'

type Env = {
  DB: D1Database
  R2: R2Bucket
  AI: any
  GOAPI_KEY: string
  UDIOAPI_KEY: string
  FAL_KEY: string
  JSON2VIDEO_KEY: string
}

const app = new Hono<{ Bindings: Env }>()

// Enable CORS for all routes
app.use('*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization', 'Range'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
  exposeHeaders: ['Content-Length', 'Content-Type', 'Content-Range', 'Accept-Ranges'],
  maxAge: 600,
  credentials: true,
}))

// Serve the React app HTML
app.get('/', async (c) => {
  const html = `<!DOCTYPE html>
<html lang="en" suppressHydrationWarning>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lofi Studio</title>
  <script type="module">
    // React app code will be bundled here
    import React from 'https://esm.sh/react@18.3.1'
    import ReactDOM from 'https://esm.sh/react-dom@18.3.1/client'
    import { BrowserRouter } from 'https://esm.sh/react-router-dom@6.28.1'
    
    // Import our app components
    ${await getAppCode()}
  </script>
  <link href="/globals.css" rel="stylesheet">
</head>
<body>
  <div id="root"></div>
</body>
</html>`
  
  return c.html(html)
})

// Copy all the API routes from worker-variants-fix.ts
// We'll need to extract them programmatically or copy manually

export default app

async function getAppCode() {
  // This would bundle and return the React app code
  // For now, return a placeholder
  return `
    const App = () => {
      return React.createElement('div', null, 'Loading...')
    }
    
    const root = ReactDOM.createRoot(document.getElementById('root'))
    root.render(React.createElement(App))
  `
}