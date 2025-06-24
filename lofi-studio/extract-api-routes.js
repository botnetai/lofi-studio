import { readFile, writeFile } from 'fs/promises'

const workerContent = await readFile('worker-variants-fix.ts', 'utf-8')

// Find the start of API routes (after CORS setup)
const apiStart = workerContent.indexOf('// API Routes')
const htmlStart = workerContent.indexOf('app.get(\'/\', async (c) => {')

// Extract just the API routes
const apiRoutes = workerContent.substring(apiStart, htmlStart)

// Create new worker with just API routes
const newWorker = `import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

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

${apiRoutes}

// Serve static files from the dist directory
app.get('/*', serveStatic({ root: './' }))

export default app`

await writeFile('worker-api-only.ts', newWorker)
console.log('API routes extracted to worker-api-only.ts')