# Lofi Music Project Tasks

## Completed Tasks
- [x] Create lofi-music project directory
- [x] Create project overview MD
- [x] Create tasks MD
- [x] Switch to Musikai implementation (Go-based)
- [x] Download musikai repository
- [x] Build musikai binary
- [x] Initialize SQLite database
- [x] Configure Suno cookie
- [x] Install audio processing tools (aubio, ffmpeg)
- [x] Create lofi generation config
- [x] Create multiple lofi prompts CSV
- [x] Configure 2captcha key

## In Progress
- [ ] Fix Suno API authentication (503 error)
- [ ] Generate first lofi tracks

## Recently Completed (Lofi Studio React App)
- [x] Fix img2vid generation error in worker-api-only.ts
  - [x] Updated all Fal.ai endpoints to use queue.fal.run format
  - [x] Added support for Kling 2.0 and 2.1 (latest versions)
  - [x] Changed default model from kling-1.6 to kling-2.1
  - [x] Implemented queue polling logic for async generation
  - [x] Fixed both video and artwork generation endpoints
  - [x] Improved error handling to show API error details
- [x] Implement Publish/Distribution tab functionality in React app
  - [x] Create PublishTab component with YouTube publishing
  - [x] Add DistroKid preparation display
  - [x] Add TikTok publishing placeholder
  - [x] Create publishing history section
  - [x] Add API endpoints for YouTube OAuth
  - [x] Add publishing history API
  - [x] Add video generation endpoint
  - [x] Create /publish route
  - [x] Add database schema for publishing tables
- [x] Add "Create Album" button to Music tab
  - [x] Button appears when tracks are selected
  - [x] Navigates to Compile tab with selected tracks
  - [x] Preselects the tracks in Compile tab
- [x] Implement URL navigation for standalone React app
  - [x] Update URLs when switching tabs (/music, /artwork, /compile, /publish)
  - [x] Handle browser back/forward navigation with popstate events
  - [x] Load correct tab based on URL on page load
  - [x] Use History API (pushState) for URL updates without page reload
  - [x] Configure Vite for SPA routing
  - [x] Add dev:standalone script to package.json
- [x] Implement async video generation with loading states
  - [x] Added status field to videos table with migration
  - [x] Modified video API to create placeholder entry immediately
  - [x] Updated UI to show loading states for generating videos
  - [x] Videos now show in Media Library immediately with progress indicator
  - [x] Auto-refresh updates video status from generating to completed
  - [x] Added proper error handling for failed video generations

## Pending Tasks
- [ ] Set up audio processing pipeline
- [ ] Configure web interface for track approval
- [ ] Set up cover art generation (Midjourney)
- [ ] Configure DistroKid publishing
- [ ] Create album workflows

## Current Issues
- Suno API returning 503 error - possible causes:
  - Cookie might be expired
  - API endpoint changes
  - Authentication flow issues

## Next Steps
1. Get fresh Suno cookie from app.suno.ai
2. Test authentication with simple script
3. Generate lofi tracks with variety of prompts
4. Set up processing pipeline for mastering
5. Configure web UI for track management

## Configuration Files Created
- `/configs/migrate.yaml` - Database setup
- `/configs/suno-cookie.yaml` - Suno authentication
- `/configs/generate-lofi.yaml` - Generation settings
- `/configs/lofi-prompts.csv` - Variety of lofi styles

## Tools Configured
- 2captcha API key: bca5b8df2e7750615dc5bb5dc9f3bc7e
- SQLite database: /data/musikai.db
- File storage: /data/files/