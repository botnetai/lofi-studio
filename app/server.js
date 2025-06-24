const express = require('express');
const multer = require('multer');
const path = require('path');
const fetch = require('node-fetch');
const fs = require('fs').promises;
const { google } = require('googleapis');
const FormData = require('form-data');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// File upload setup
const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// API Keys (should be in environment variables)
const API_KEYS = {
    goapi: 'c3ba91c7503bb8b8d3c4e6f41292af00e910a8e1067b6d20c4a2661017c9e7da',
    udioapi: '51bdc9d9-ba8f-45fa-a34c-d7d8aadc9a6a',
    // Add your image generation API keys here
    stability: process.env.STABILITY_API_KEY,
    // Add your video generation API keys here
    runway: process.env.RUNWAY_API_KEY
};

// Music Generation Endpoints
app.post('/api/generate-music', async (req, res) => {
    const { service, prompt, title, tags, apiKey } = req.body;
    
    try {
        if (service === 'goapi') {
            const response = await fetch('https://api.goapi.ai/api/v1/task', {
                method: 'POST',
                headers: {
                    'X-API-Key': apiKey || API_KEYS.goapi,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'music-u',
                    task_type: 'generate_music',
                    input: {
                        prompt: prompt,
                        title: title,
                        lyrics_type: 'instrumental',
                        gpt_description_prompt: prompt
                    }
                })
            });
            
            const data = await response.json();
            res.json({ success: true, taskId: data.task_id });
            
        } else if (service === 'udioapi') {
            const response = await fetch('https://udioapi.pro/api/v2/generate', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey || API_KEYS.udioapi}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                },
                body: JSON.stringify({
                    prompt: prompt,
                    title: title,
                    tags: tags,
                    make_instrumental: true,
                    model: 'chirp-v4-5'
                })
            });
            
            const data = await response.json();
            res.json({ success: true, workId: data.workId });
        }
    } catch (error) {
        console.error('Music generation error:', error);
        res.json({ success: false, error: error.message });
    }
});

app.get('/api/check-music-status', async (req, res) => {
    const { taskId, service } = req.query;
    
    try {
        if (service === 'goapi') {
            const response = await fetch(`https://api.goapi.ai/api/v1/task/${taskId}`, {
                headers: {
                    'X-API-Key': API_KEYS.goapi
                }
            });
            
            const data = await response.json();
            if (data.status === 'completed') {
                res.json({
                    status: 'completed',
                    tracks: data.output.audio_urls.map(url => ({
                        url: url,
                        title: data.input.title || 'Generated Track'
                    }))
                });
            } else {
                res.json({ status: data.status });
            }
            
        } else if (service === 'udioapi') {
            const response = await fetch(`https://udioapi.pro/api/v2/feed?workId=${taskId}`, {
                headers: {
                    'Authorization': `Bearer ${API_KEYS.udioapi}`,
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                }
            });
            
            const data = await response.json();
            if (data.data && data.data.type === 'SUCCESS') {
                res.json({
                    status: 'completed',
                    tracks: data.data.response_data.map(track => ({
                        url: track.audio_url,
                        title: track.title || 'Generated Track'
                    }))
                });
            } else {
                res.json({ status: 'processing' });
            }
        }
    } catch (error) {
        console.error('Status check error:', error);
        res.json({ success: false, error: error.message });
    }
});

// Artwork Generation
app.post('/api/generate-artwork', async (req, res) => {
    const { prompt, style } = req.body;
    
    try {
        // Using Stability AI as an example
        const response = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${API_KEYS.stability}`
            },
            body: JSON.stringify({
                text_prompts: [
                    {
                        text: prompt,
                        weight: 1
                    }
                ],
                cfg_scale: 7,
                height: 1024,
                width: 1024,
                steps: 30,
                samples: 1
            })
        });
        
        const data = await response.json();
        
        if (data.artifacts && data.artifacts.length > 0) {
            // Save the image and return URL
            const imageData = Buffer.from(data.artifacts[0].base64, 'base64');
            const filename = `artwork_${Date.now()}.png`;
            await fs.writeFile(path.join(__dirname, 'uploads', filename), imageData);
            
            res.json({ 
                success: true, 
                imageUrl: `/uploads/${filename}` 
            });
        } else {
            throw new Error('No image generated');
        }
    } catch (error) {
        console.error('Artwork generation error:', error);
        res.json({ success: false, error: error.message });
    }
});

// Video Generation
app.post('/api/generate-video', async (req, res) => {
    const { imageUrl, audioUrl, animationStyle, duration } = req.body;
    
    try {
        // This is a placeholder - you would integrate with a service like:
        // - RunwayML
        // - D-ID
        // - Synthesia
        // - Or use FFmpeg for simple animations
        
        // For now, we'll create a simple looping video with FFmpeg
        const exec = require('util').promisify(require('child_process').exec);
        const outputPath = path.join(__dirname, 'uploads', `video_${Date.now()}.mp4`);
        
        // Simple zoom effect with FFmpeg
        const ffmpegCommand = `ffmpeg -loop 1 -i ${imageUrl} -i ${audioUrl} -c:v libx264 -t ${duration} -pix_fmt yuv420p -vf "scale=1920:1080,zoompan=z='min(zoom+0.0015,1.5)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${duration * 25}" -c:a copy ${outputPath}`;
        
        await exec(ffmpegCommand);
        
        res.json({ 
            success: true, 
            videoUrl: `/uploads/${path.basename(outputPath)}` 
        });
        
    } catch (error) {
        console.error('Video generation error:', error);
        res.json({ success: false, error: error.message });
    }
});

// DistroKid Publishing (Placeholder)
app.post('/api/publish-distrokid', async (req, res) => {
    const { trackUrl, artworkUrl, artistName, albumName, releaseDate, releaseType, credits } = req.body;
    
    try {
        // DistroKid doesn't have a public API
        // You would need to either:
        // 1. Use their partner API (if available)
        // 2. Automate their web interface with Puppeteer
        // 3. Save the data and handle upload manually
        
        // For now, we'll save the release data
        const releaseData = {
            id: Date.now(),
            trackUrl,
            artworkUrl,
            artistName,
            albumName,
            releaseDate,
            releaseType,
            credits,
            timestamp: new Date().toISOString()
        };
        
        await fs.writeFile(
            path.join(__dirname, 'uploads', `release_${releaseData.id}.json`),
            JSON.stringify(releaseData, null, 2)
        );
        
        res.json({ 
            success: true, 
            message: 'Release data saved. Manual upload to DistroKid required.',
            releaseId: releaseData.id
        });
        
    } catch (error) {
        console.error('DistroKid publishing error:', error);
        res.json({ success: false, error: error.message });
    }
});

// YouTube Publishing
app.post('/api/publish-youtube', async (req, res) => {
    const { videoUrl, title, description, tags, category, privacy } = req.body;
    
    try {
        // You'll need to set up YouTube OAuth2
        // This is a simplified example
        
        const oauth2Client = new google.auth.OAuth2(
            process.env.YOUTUBE_CLIENT_ID,
            process.env.YOUTUBE_CLIENT_SECRET,
            process.env.YOUTUBE_REDIRECT_URL
        );
        
        // Set credentials (you'd get these from OAuth flow)
        oauth2Client.setCredentials({
            refresh_token: process.env.YOUTUBE_REFRESH_TOKEN
        });
        
        const youtube = google.youtube({
            version: 'v3',
            auth: oauth2Client
        });
        
        // Upload video
        const videoPath = path.join(__dirname, videoUrl);
        const fileSize = (await fs.stat(videoPath)).size;
        
        const response = await youtube.videos.insert({
            part: ['snippet', 'status'],
            requestBody: {
                snippet: {
                    title: title,
                    description: description,
                    tags: tags.split(',').map(t => t.trim()),
                    categoryId: category
                },
                status: {
                    privacyStatus: privacy
                }
            },
            media: {
                body: require('fs').createReadStream(videoPath)
            }
        });
        
        res.json({ 
            success: true, 
            videoId: response.data.id,
            url: `https://youtube.com/watch?v=${response.data.id}`
        });
        
    } catch (error) {
        console.error('YouTube publishing error:', error);
        
        // For now, return instructions for manual upload
        res.json({ 
            success: false, 
            error: 'YouTube API not configured. Please upload manually.',
            instructions: 'Visit youtube.com/upload to upload your video manually.'
        });
    }
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Create uploads directory if it doesn't exist
(async () => {
    try {
        await fs.mkdir(path.join(__dirname, 'uploads'), { recursive: true });
    } catch (error) {
        console.error('Error creating uploads directory:', error);
    }
})();

// Start server
app.listen(PORT, () => {
    console.log(`🎵 Lofi Music Studio running at http://localhost:${PORT}`);
});