# Lofi Studio

A modern web application for creating, visualizing, and publishing lofi music, built with TanStack Start and Cloudflare Workers.

## Features

- 🎵 **Music Generation** - Generate lofi beats using AI (GoAPI/UdioAPI)
- 📤 **Music Upload** - Upload your own audio tracks
- 🎨 **AI Artwork** - Generate album covers with Cloudflare AI
- 🎬 **Video Creation** - Create animated videos from artwork
- 📦 **R2 Storage** - All files stored in Cloudflare R2
- 🚀 **Publishing** - Export to DistroKid and YouTube

## Tech Stack

- **Framework**: TanStack Start (React)
- **Deployment**: Cloudflare Pages & Workers
- **Storage**: Cloudflare R2
- **AI**: Cloudflare AI, GoAPI, UdioAPI
- **Styling**: Tailwind CSS
- **State**: Zustand

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Create R2 bucket**:
   ```bash
   npx wrangler r2 bucket create lofi-studio-storage
   ```

3. **Configure environment**:
   - Update `wrangler.toml` with your API keys
   - Or use Cloudflare secrets:
     ```bash
     npx wrangler secret put GOAPI_KEY
     npx wrangler secret put UDIOAPI_KEY
     ```

4. **Run development server**:
   ```bash
   npm run dev
   ```

5. **Deploy to Cloudflare**:
   ```bash
   npm run deploy
   ```

## Architecture

```
app/
├── routes/          # Page routes
├── components/      # React components
├── lib/            # Utilities and API functions
└── public/         # Static assets

Server Functions:
- uploadToR2()      # File uploads to R2
- generateMusic()   # AI music generation
- generateArtwork() # AI image generation
- generateVideo()   # Video creation
```

## API Services

### Music Generation
- **GoAPI**: Udio model for music generation
- **UdioAPI**: Alternative Udio API service

### Image Generation
- **Cloudflare AI**: Stable Diffusion for artwork
- Can be extended with other APIs (DALL-E, Midjourney)

### Video Generation
- Currently returns placeholder
- Can integrate with:
  - RunwayML
  - Replicate
  - FFmpeg Workers

## Usage

1. **Create Music**:
   - Upload existing tracks or generate new ones
   - Select your track for the project

2. **Design Artwork**:
   - Generate AI artwork with custom prompts
   - Choose from various art styles
   - Or upload your own image

3. **Create Video**:
   - Select animation style
   - Set video duration
   - Generate animated video

4. **Publish**:
   - Fill in release metadata
   - Export for DistroKid
   - Prepare for YouTube upload

## R2 Configuration

Set up a public bucket or create a worker to serve R2 files:

```javascript
// r2-public.js (Worker)
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const key = url.pathname.slice(1)
    
    const object = await env.R2.get(key)
    if (!object) {
      return new Response('Not Found', { status: 404 })
    }
    
    return new Response(object.body, {
      headers: object.httpMetadata
    })
  }
}
```

## Future Enhancements

- [ ] Batch processing
- [ ] Spotify integration
- [ ] Advanced video effects
- [ ] Collaboration features
- [ ] Analytics dashboard
- [ ] Webhook support for async generation

## License

MIT