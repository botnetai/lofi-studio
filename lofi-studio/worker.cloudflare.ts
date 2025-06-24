import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Env = {
  DB: D1Database
  R2: R2Bucket
  AI: any
  GOAPI_KEY: string
  UDIOAPI_KEY: string
  FAL_KEY: string
  JSON2VIDEO_KEY: string
  ASSETS: Fetcher
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

// Copy all API routes from worker-variants-fix.ts
// We'll add them after this basic setup

// Serve static assets and the React app
app.all('*', async (c) => {
  // Try to serve from ASSETS binding (the built React app)
  try {
    const url = new URL(c.req.url)
    const response = await c.env.ASSETS.fetch(url.toString())
    
    // Clone the response to add CORS headers
    const newResponse = new Response(response.body, response)
    const headers = new Headers(newResponse.headers)
    
    // Add CORS headers if not present
    if (!headers.has('Access-Control-Allow-Origin')) {
      headers.set('Access-Control-Allow-Origin', '*')
    }
    
    return new Response(newResponse.body, {
      status: newResponse.status,
      statusText: newResponse.statusText,
      headers
    })
  } catch (error) {
    console.error('Error serving assets:', error)
    return c.text('Not Found', 404)
  }
})

export default app