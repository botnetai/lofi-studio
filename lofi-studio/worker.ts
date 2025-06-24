import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createStartHandler } from '@tanstack/start/server';
import { router } from './app/router';

export type Env = {
  DB: D1Database;
  R2: R2Bucket;
  AI: any;
  GOAPI_KEY: string;
  UDIOAPI_KEY: string;
  FAL_KEY: string;
};

const app = new Hono<{ Bindings: Env }>();

// Enable CORS
app.use('*', cors());

// API Routes
app.get('/api/songs', async (c) => {
  try {
    const songs = await c.env.DB.prepare('SELECT * FROM songs ORDER BY created_at DESC').all();
    return c.json(songs.results || []);
  } catch (error) {
    console.error('Error fetching songs:', error);
    return c.json({ error: 'Failed to fetch songs' }, 500);
  }
});

app.post('/api/songs', async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const metadata = JSON.parse(formData.get('metadata') as string || '{}');
    
    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }
    
    const id = crypto.randomUUID();
    const key = `songs/${id}.mp3`;
    
    // Upload to R2
    await c.env.R2.put(key, file.stream(), {
      httpMetadata: {
        contentType: 'audio/mpeg',
      },
    });
    
    // Save to database
    await c.env.DB.prepare(`
      INSERT INTO songs (id, name, url, metadata, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      id,
      metadata.name || file.name,
      `/files/${key}`,
      JSON.stringify(metadata),
      new Date().toISOString()
    ).run();
    
    return c.json({ 
      success: true, 
      id,
      url: `/files/${key}`
    });
  } catch (error) {
    console.error('Error uploading song:', error);
    return c.json({ error: 'Failed to upload song' }, 500);
  }
});

app.post('/api/generate-music', async (c) => {
  try {
    const body = await c.req.json();
    const { prompt = 'lofi beat', custom_mode = false, ...params } = body;
    
    // Create work ID
    const workId = crypto.randomUUID();
    
    // Create placeholder in DB immediately
    const songId = crypto.randomUUID();
    const placeholderKey = `songs/${songId}_placeholder.mp3`;
    
    await c.env.DB.prepare(`
      INSERT INTO songs (id, name, url, metadata, created_at, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      songId,
      `Generating: ${prompt.substring(0, 50)}...`,
      `/files/${placeholderKey}`,
      JSON.stringify({ 
        workId, 
        prompt,
        status: 'generating',
        source: 'udio',
        custom_mode,
        ...params
      }),
      new Date().toISOString(),
      'generating'
    ).run();
    
    // Start generation with AI Music API
    const response = await fetch('https://api.aimusicapi.com/v1/api/sendRequest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api_key': c.env.UDIOAPI_KEY
      },
      body: JSON.stringify({
        api_key: c.env.UDIOAPI_KEY,
        custom_mode,
        prompt,
        make_instrumental: params.make_instrumental ?? false,
        model: params.model || "chirp-v3.5",
        wait_audio: false,
        ...params
      })
    });
    
    const data = await response.json();
    
    if (data.status === 'error') {
      throw new Error(data.message || 'Generation failed');
    }
    
    // Update metadata with work ID
    await c.env.DB.prepare(`
      UPDATE songs 
      SET metadata = json_set(metadata, '$.workId', ?)
      WHERE id = ?
    `).bind(data.workId || workId, songId).run();
    
    return c.json({ 
      success: true, 
      workId: data.workId || workId,
      songId,
      message: 'Music generation started'
    });
  } catch (error) {
    console.error('Error generating music:', error);
    return c.json({ error: error.message || 'Failed to generate music' }, 500);
  }
});

app.get('/api/generate-music-status', async (c) => {
  try {
    const workId = c.req.query('workId');
    if (!workId) {
      return c.json({ error: 'Work ID required' }, 400);
    }
    
    // Check status with AI Music API
    const response = await fetch(`https://api.aimusicapi.com/v1/api/getRequest?api_key=${c.env.UDIOAPI_KEY}&workId=${workId}`, {
      headers: {
        'api_key': c.env.UDIOAPI_KEY
      }
    });
    
    const data = await response.json();
    
    if (data.status === 'completed' && data.audio_url) {
      // Find the song in DB
      const result = await c.env.DB.prepare(
        "SELECT * FROM songs WHERE json_extract(metadata, '$.workId') = ?"
      ).bind(workId).first();
      
      if (result) {
        // Download and save the audio file
        const audioResponse = await fetch(data.audio_url);
        const audioBlob = await audioResponse.blob();
        const audioKey = `songs/${result.id}.mp3`;
        
        await c.env.R2.put(audioKey, audioBlob.stream(), {
          httpMetadata: {
            contentType: 'audio/mpeg',
          },
        });
        
        // Update song record
        const metadata = JSON.parse(result.metadata as string || '{}');
        metadata.title = data.title || metadata.prompt;
        metadata.duration = data.duration;
        metadata.audio_url = data.audio_url;
        metadata.status = 'completed';
        
        await c.env.DB.prepare(`
          UPDATE songs 
          SET name = ?, 
              url = ?, 
              metadata = ?,
              status = 'completed'
          WHERE id = ?
        `).bind(
          data.title || metadata.prompt,
          `/files/${audioKey}`,
          JSON.stringify(metadata),
          result.id
        ).run();
      }
    }
    
    return c.json(data);
  } catch (error) {
    console.error('Error checking status:', error);
    return c.json({ error: 'Failed to check status' }, 500);
  }
});

app.post('/api/generate-artwork', async (c) => {
  try {
    const body = await c.req.json();
    const { prompt, model = 'flux-pro' } = body;
    
    if (!prompt) {
      return c.json({ error: 'Prompt required' }, 400);
    }
    
    const results = [];
    const aspectRatios = ['1:1', '16:9', '9:16'];
    
    // Generate all 3 aspect ratios
    for (const aspectRatio of aspectRatios) {
      const response = await fetch('https://fal.run/fal-ai/' + model, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${c.env.FAL_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          image_size: aspectRatio === '1:1' ? 'square' : aspectRatio === '16:9' ? 'landscape_16_9' : 'portrait_9_16',
          num_inference_steps: 28,
          guidance_scale: 3.5,
          num_images: 1,
          enable_safety_checker: true,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Fal.ai error: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (data.images && data.images[0]) {
        const imageUrl = data.images[0].url;
        const imageId = crypto.randomUUID();
        const key = `artwork/${imageId}_${aspectRatio.replace(':', 'x')}.jpg`;
        
        // Download and save to R2
        const imageResponse = await fetch(imageUrl);
        const imageBlob = await imageResponse.blob();
        
        await c.env.R2.put(key, imageBlob.stream(), {
          httpMetadata: {
            contentType: 'image/jpeg',
          },
        });
        
        // Save to DB
        await c.env.DB.prepare(`
          INSERT INTO artwork (id, prompt, model, model_params, file_key, file_type, fal_url, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          imageId,
          prompt,
          model,
          JSON.stringify({ aspectRatio }),
          key,
          'image/jpeg',
          imageUrl,
          new Date().toISOString()
        ).run();
        
        results.push({
          id: imageId,
          aspectRatio,
          url: `/files/${key}`,
          originalUrl: imageUrl
        });
      }
    }
    
    return c.json({ success: true, images: results });
  } catch (error) {
    console.error('Error generating artwork:', error);
    return c.json({ error: error.message || 'Failed to generate artwork' }, 500);
  }
});

// Serve R2 files
app.get('/files/*', async (c) => {
  const key = c.req.param('*');
  const object = await c.env.R2.get(key);
  
  if (!object) {
    return c.text('Not Found', 404);
  }
  
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=3600');
  
  return c.body(object.body, { headers });
});

// Serve the React app for all other routes
app.get('*', async (c) => {
  const startHandler = createStartHandler({ router });
  return startHandler(c.req.raw, c.env);
});

export default app;