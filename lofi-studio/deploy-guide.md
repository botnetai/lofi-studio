# Deploying TanStack Start to Cloudflare Workers

## Current Setup

The application uses TanStack Start for the frontend React application and has a comprehensive API built with Hono that handles:
- Music generation with Udio API
- File storage with R2
- Database operations with D1
- AI operations

## Deployment Strategy

Since TanStack Start with Cloudflare Workers preset requires specific configurations and we have a working API, we'll use a hybrid approach:

### Option 1: Keep Current Worker Setup (Recommended)

1. **Current Architecture**:
   - Worker: `worker-variants-fix.ts` - Handles all API routes and file serving
   - Frontend: Served as static files from the worker
   - Bindings: DB (D1), R2 (R2 Bucket), AI, and API keys

2. **Build Process**:
   ```bash
   # Build the frontend
   bun run build
   
   # Deploy the worker
   wrangler deploy
   ```

3. **Configuration**:
   - `wrangler.toml` is already configured with all necessary bindings
   - Worker serves both API routes and static frontend files

### Option 2: Full TanStack Start Integration

To fully integrate TanStack Start with Cloudflare Workers:

1. **Update app.config.ts**:
   ```typescript
   import { defineConfig } from '@tanstack/start/config'
   
   export default defineConfig({
     server: {
       preset: 'cloudflare',
       rollupConfig: {
         external: ['node:async_hooks']
       }
     }
   })
   ```

2. **Create API Routes**:
   - Move each API endpoint to separate files in `app/api/`
   - Use TanStack Start's API file routes
   - Example: `app/api/songs.ts` for `/api/songs` endpoint

3. **Worker Configuration**:
   - Update `wrangler.toml` to point to the built output
   - Ensure all bindings are properly configured

## Current Working Solution

The application currently works with:
- **Worker**: `worker-variants-fix.ts`
- **Frontend**: React app built with Vite
- **Deployment**: `wrangler deploy`

All API routes are functional and properly integrated with Cloudflare services (D1, R2, AI).

## API Routes Summary

- `GET /api/songs` - Fetch all songs
- `POST /api/generate-music` - Generate new music
- `GET /api/generate-music-status` - Check generation status
- `POST /api/refresh-stuck` - Refresh stuck generations
- `GET /files/*` - Serve files from R2
- `DELETE /api/songs/:id` - Delete a song
- `POST /api/artwork` - Generate artwork
- `POST /api/video` - Generate video
- `POST /api/albums` - Create albums
- And more...

## Deployment Commands

```bash
# Install dependencies
bun install

# Build the application
bun run build

# Deploy to Cloudflare Workers
wrangler deploy

# Or deploy with specific environment
wrangler deploy --env production
```

## Environment Variables

Ensure these are set in your Cloudflare Workers dashboard or via wrangler:
- `GOAPI_KEY`
- `UDIOAPI_KEY`
- `FAL_KEY`
- `JSON2VIDEO_KEY`

## Bindings

Configure these in wrangler.toml or Cloudflare dashboard:
- `DB` - D1 database
- `R2` - R2 bucket for file storage
- `AI` - Cloudflare AI binding