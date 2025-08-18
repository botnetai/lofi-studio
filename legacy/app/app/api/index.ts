import { createAPIFileRoute } from '@tanstack/start/api'
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
}

// Create a Hono app instance for our API routes
const api = new Hono<{ Bindings: Env }>()

// Enable CORS for all routes
api.use('*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization', 'Range'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
  exposeHeaders: ['Content-Length', 'Content-Type', 'Content-Range', 'Accept-Ranges'],
  maxAge: 600,
  credentials: true,
}))

// Export the Hono app for use in server functions
export { api }

// Create an API file route that handles all /api/* requests
export const APIRoute = createAPIFileRoute('/api')({
  GET: async ({ request, context }) => {
    const env = context.cloudflare?.env as Env
    if (!env) {
      return new Response('Environment not available', { status: 500 })
    }
    
    // Handle the request with Hono
    return api.fetch(request, env)
  },
  POST: async ({ request, context }) => {
    const env = context.cloudflare?.env as Env
    if (!env) {
      return new Response('Environment not available', { status: 500 })
    }
    
    return api.fetch(request, env)
  },
  DELETE: async ({ request, context }) => {
    const env = context.cloudflare?.env as Env
    if (!env) {
      return new Response('Environment not available', { status: 500 })
    }
    
    return api.fetch(request, env)
  }
})