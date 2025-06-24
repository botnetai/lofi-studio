# Lofi Music Project

## Overview
An automated music generation system using Musikai - a comprehensive tool that leverages AI services (Suno/Udio) to generate, process, and publish music albums.

## Project Goals
- Automatically generate lofi/ambient music using AI
- Process and master generated tracks
- Create album artwork using AI
- Publish to digital music stores via DistroKid
- Full automation from generation to publication

## Technology Stack
- **Language**: Go
- **Music Generation**: Suno API / Udio API
- **Image Generation**: Midjourney (via Bulkai)
- **Audio Processing**: ffmpeg, aubio, phaselimiter
- **Database**: SQLite/PostgreSQL/MySQL
- **File Storage**: Local/S3/Telegram
- **Distribution**: DistroKid

## Project Structure
```
lofi-music/
├── PROJECT_OVERVIEW.md
├── TASKS.md
└── musikai/            # Musikai tool for music generation
    ├── cmd/            # Main application entry
    ├── pkg/            # Core packages
    │   ├── suno/       # Suno API integration
    │   ├── udio/       # Udio API integration
    │   ├── distrokid/  # DistroKid publishing
    │   └── ...
    └── scripts/        # Installation scripts
```

## Key Features
- **Music Generation**: Automated generation with customizable prompts
- **Audio Processing**: Fade-out detection, BPM analysis, mastering
- **Cover Art**: AI-generated album covers with Midjourney
- **Album Management**: Web interface for song/cover approval
- **Publishing**: Automated DistroKid submission
- **Sync**: Track UPC/ISRC codes and streaming platform IDs

## Workflow
1. Generate songs using AI (Suno/Udio)
2. Process audio (mastering, fade-outs)
3. Filter and approve songs via web UI
4. Generate album covers with Midjourney
5. Create albums from approved content
6. Publish to DistroKid
7. Sync metadata from streaming platforms