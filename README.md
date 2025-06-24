# Lofi Music Generation Project

This project uses Musikai to automatically generate lofi music using AI services (Suno/Udio).

## Setup Status

### ✅ Completed
- Musikai tool built and configured
- SQLite database initialized
- Audio processing tools installed (ffmpeg, aubio)
- 2captcha API key configured: `bca5b8df2e7750615dc5bb5dc9f3bc7e`
- Multiple lofi music prompts configured
- Suno cookie stored (but service appears suspended)
- Udio cookie stored

### ⚠️ Issues
- **Suno**: Service returning "503 Service Suspended" - appears to be down
- **Udio**: Requires ngrok setup for captcha solving

## Quick Start

### For Suno (when service is back):
```bash
cd musikai
./musikai generate --config ../configs/generate-lofi.yaml
```

### For Udio:
1. First set up ngrok:
   ```bash
   # Sign up at https://dashboard.ngrok.com/signup
   # Get your authtoken
   ngrok authtoken YOUR_AUTH_TOKEN
   ```

2. Then generate music:
   ```bash
   cd musikai
   ./musikai generate --config ../configs/generate-lofi-udio.yaml
   ```

## Configuration Files

- `/configs/migrate.yaml` - Database setup
- `/configs/suno-cookie.yaml` - Suno authentication
- `/configs/udio-cookie.yaml` - Udio authentication  
- `/configs/generate-lofi.yaml` - Suno generation settings
- `/configs/generate-lofi-udio.yaml` - Udio generation settings
- `/configs/lofi-prompts.csv` - Suno prompts
- `/configs/udio-lofi-prompts.csv` - Udio prompts

## Complete Workflow

### 1. Generate Music
```bash
# For Udio (after setting up ngrok)
cd musikai
./musikai generate --config ../configs/generate-lofi-udio.yaml
```

### 2. Process Audio
```bash
./musikai process --config ../configs/process.yaml
```

### 3. Web Interface (Review & Organize)
```bash
./musikai web --config ../configs/web.yaml
# Open browser to http://localhost:8080
# Login with admin/admin
```

### 4. Publish to DistroKid (Automated)
```bash
# First, update publish.yaml with your info
./musikai publish --config ../configs/publish.yaml
```

## DistroKid Integration

Musikai handles the complete DistroKid workflow:
- Automatic album creation
- Track upload
- Metadata submission
- Cover art generation/upload
- Platform selection
- Release scheduling

The `publish` command will:
1. Find approved tracks in the database
2. Create albums based on your settings
3. Generate cover art if needed
4. Upload everything to DistroKid
5. Handle all the distribution settings

## Database
- Location: `/data/musikai.db`
- Type: SQLite
- Contains: Settings, generated songs, metadata

## File Storage
- Location: `/data/files/`
- Stores: Generated audio files, processed versions