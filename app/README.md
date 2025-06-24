# Lofi Music Studio

A complete web application for creating, visualizing, and publishing lofi music.

## Features

- **Music Generation**: Generate lofi beats using AI (GoAPI/UdioAPI)
- **Music Upload**: Upload your own tracks
- **Album Artwork**: Generate AI artwork or upload your own
- **Video Creation**: Create animated videos from your artwork
- **Publishing**: Export to DistroKid and YouTube

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and add your API keys:
```bash
cp .env.example .env
```

3. Start the server:
```bash
npm start
# or for development with auto-reload
npm run dev
```

4. Open http://localhost:3000 in your browser

## API Services Required

### Music Generation
- **GoAPI**: Sign up at https://goapi.ai
- **UdioAPI**: Sign up at https://udioapi.pro

### Image Generation
- **Stability AI**: Get API key from https://platform.stability.ai
- Alternative: Use DALL-E, Midjourney, or any image generation API

### Video Generation
Options:
- **RunwayML**: https://runwayml.com
- **D-ID**: https://www.d-id.com
- **FFmpeg**: Installed locally for simple animations

### Publishing
- **DistroKid**: No public API - manual upload required
- **YouTube**: Set up OAuth2 credentials in Google Cloud Console

## Usage

1. **Create Music**:
   - Upload existing tracks or generate new ones
   - Select your preferred track

2. **Design Artwork**:
   - Generate AI artwork with prompts
   - Or upload your own image

3. **Create Video**:
   - Choose animation style
   - Set duration
   - Generate animated video

4. **Publish**:
   - Fill in release details
   - Export for DistroKid
   - Upload to YouTube

## Architecture

- Frontend: Vanilla JavaScript with modern CSS
- Backend: Node.js/Express
- File Storage: Local uploads folder
- APIs: REST endpoints for all services

## Customization

### Adding New Music Services
Edit `server.js` and add your service in the `/api/generate-music` endpoint.

### Adding New Animation Styles
Edit the video generation logic in `server.js` to add custom FFmpeg filters.

### Styling
Modify `styles.css` to change colors, fonts, and layout.

## Troubleshooting

- **Music generation fails**: Check API keys and credits
- **Video generation slow**: Normal for longer videos, consider reducing duration
- **Upload fails**: Check file size limits and server disk space

## Future Enhancements

- Batch processing for multiple tracks
- Preset management
- Social media integration
- Spotify publishing
- Advanced video effects
- Collaborative features