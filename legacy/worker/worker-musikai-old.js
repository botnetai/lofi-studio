// Removed KV asset handler import as we're not using it

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Handle API routes
    if (url.pathname.startsWith('/api/')) {
      return handleAPI(request, env, url.pathname);
    }
    
    // Handle R2 file serving
    if (url.pathname.startsWith('/files/')) {
      const key = url.pathname.slice(7);
      const object = await env.R2.get(key);
      
      if (!object) {
        return new Response('Not Found', { status: 404 });
      }
      
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('Cache-Control', 'public, max-age=3600');
      
      return new Response(object.body, { headers });
    }
    
    // Serve the Musikai-style UI
    return new Response(getHTML(), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  },
};

async function handleAPI(request, env, pathname) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    // Get all songs
    if (pathname === '/api/songs' && request.method === 'GET') {
      const songs = await env.DB.prepare('SELECT * FROM songs ORDER BY created_at DESC').all();
      return new Response(JSON.stringify(songs.results || []), { headers });
    }
    
    // Add a song
    if (pathname === '/api/songs' && request.method === 'POST') {
      const formData = await request.formData();
      const file = formData.get('file');
      const metadata = JSON.parse(formData.get('metadata') || '{}');
      
      if (!file) {
        return new Response(JSON.stringify({ error: 'No file provided' }), { 
          status: 400, 
          headers 
        });
      }
      
      const id = crypto.randomUUID();
      const key = `songs/${id}.mp3`;
      
      // Upload to R2
      await env.R2.put(key, file.stream(), {
        httpMetadata: {
          contentType: 'audio/mpeg',
        },
      });
      
      // Save to database
      await env.DB.prepare(`
        INSERT INTO songs (id, name, url, metadata, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        id,
        metadata.name || file.name,
        `/files/${key}`,
        JSON.stringify(metadata),
        new Date().toISOString()
      ).run();
      
      return new Response(JSON.stringify({ 
        success: true, 
        id,
        url: `/files/${key}`
      }), { headers });
    }
    
    // Update song status
    if (pathname.match(/^\/api\/songs\/[^\/]+$/) && request.method === 'PUT') {
      const id = pathname.split('/').pop();
      const body = await request.json();
      
      await env.DB.prepare(`
        UPDATE songs 
        SET status = ?, metadata = ?
        WHERE id = ?
      `).bind(
        body.status || 'pending',
        JSON.stringify(body.metadata || {}),
        id
      ).run();
      
      return new Response(JSON.stringify({ success: true }), { headers });
    }
    
    // Get albums
    if (pathname === '/api/albums' && request.method === 'GET') {
      const albums = await env.DB.prepare('SELECT * FROM albums ORDER BY created_at DESC').all();
      return new Response(JSON.stringify(albums.results || []), { headers });
    }
    
    // Create album
    if (pathname === '/api/albums' && request.method === 'POST') {
      const body = await request.json();
      const id = crypto.randomUUID();
      
      await env.DB.prepare(`
        INSERT INTO albums (id, name, artist, songs, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        body.name,
        body.artist,
        JSON.stringify(body.songs || []),
        JSON.stringify(body.metadata || {}),
        new Date().toISOString()
      ).run();
      
      return new Response(JSON.stringify({ success: true, id }), { headers });
    }
    
    // Generate artwork using Fal.ai
    if (pathname === '/api/artwork' && request.method === 'POST') {
      const body = await request.json();
      const model = body.model || 'fal-ai/flux-pro/v1.1-ultra';
      const params = body.params || {};
      
      // Build request body based on model
      const requestBody = {
        prompt: `${body.prompt}, album cover art, high quality, professional design`,
        ...params
      };
      
      // Ensure we have required params for each model
      if (!requestBody.aspect_ratio) requestBody.aspect_ratio = '1:1';
      if (model.includes('flux-pro')) {
        requestBody.output_format = 'jpeg';
        requestBody.num_images = 1;
      }
      
      // Call Fal.ai API
      const falResponse = await fetch(`https://fal.run/${model}`, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${env.FAL_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!falResponse.ok) {
        const error = await falResponse.text();
        return new Response(JSON.stringify({ error: `Fal.ai error: ${error}` }), { 
          status: falResponse.status, 
          headers 
        });
      }
      
      const falData = await falResponse.json();
      
      // Download the generated image and upload to R2
      if (falData.images && falData.images[0]) {
        const imageUrl = falData.images[0].url;
        const imageResponse = await fetch(imageUrl);
        const imageBlob = await imageResponse.blob();
        
        const id = crypto.randomUUID();
        const key = `artwork/${id}.jpg`;
        
        await env.R2.put(key, imageBlob.stream(), {
          httpMetadata: {
            contentType: 'image/jpeg',
          },
        });
        
        return new Response(JSON.stringify({ 
          success: true,
          url: `/files/${key}`,
          falUrl: imageUrl
        }), { headers });
      }
      
      return new Response(JSON.stringify({ error: 'No image generated' }), { 
        status: 500, 
        headers 
      });
    }
    
    // Generate video using Fal.ai
    if (pathname === '/api/video' && request.method === 'POST') {
      const body = await request.json();
      const model = body.model || 'fal-ai/stable-video';
      const params = body.params || {};
      
      // Build request body based on model
      const requestBody = {
        image_url: body.imageUrl,
        ...params
      };
      
      // For video loops, ensure seamless looping
      if (body.createLoop) {
        requestBody.num_frames = params.fps * (params.duration || 3); // 3 second default
        requestBody.loop = true;
      }
      
      // Call Fal.ai API
      const falResponse = await fetch(`https://fal.run/${model}`, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${env.FAL_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!falResponse.ok) {
        const error = await falResponse.text();
        return new Response(JSON.stringify({ error: `Fal.ai error: ${error}` }), { 
          status: falResponse.status, 
          headers 
        });
      }
      
      const falData = await falResponse.json();
      
      // Download the generated video and upload to R2
      if (falData.video && falData.video.url) {
        const videoUrl = falData.video.url;
        const videoResponse = await fetch(videoUrl);
        const videoBlob = await videoResponse.blob();
        
        const id = crypto.randomUUID();
        const key = body.createLoop ? `video-loops/${id}.mp4` : `videos/${id}.mp4`;
        
        await env.R2.put(key, videoBlob.stream(), {
          httpMetadata: {
            contentType: 'video/mp4',
          },
        });
        
        // If creating a loop, save to video_loops table
        if (body.createLoop) {
          await env.DB.prepare(`
            INSERT INTO video_loops (id, name, source_artwork_id, file_key, url, duration, fps, seamless)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            id,
            body.name || 'Untitled Loop',
            body.artworkId || null,
            key,
            `/files/${key}`,
            params.duration || 3,
            params.fps || 24,
            1
          ).run();
        }
        
        return new Response(JSON.stringify({ 
          success: true,
          id,
          url: `/files/${key}`,
          falUrl: videoUrl,
          isLoop: body.createLoop || false
        }), { headers });
      }
      
      return new Response(JSON.stringify({ error: 'No video generated' }), { 
        status: 500, 
        headers 
      });
    }
    
    // Get all video loops
    if (pathname === '/api/video-loops' && request.method === 'GET') {
      const loops = await env.DB.prepare('SELECT * FROM video_loops ORDER BY created_at DESC').all();
      return new Response(JSON.stringify(loops.results || []), { headers });
    }
    
    // Create compilation
    if (pathname === '/api/compilations' && request.method === 'POST') {
      const body = await request.json();
      const id = crypto.randomUUID();
      
      // Calculate total duration
      let totalDuration = 0;
      const tracklist = [];
      
      for (let i = 0; i < body.songs.length; i++) {
        const song = body.songs[i];
        const songData = await env.DB.prepare('SELECT * FROM songs WHERE id = ?').bind(song.id).first();
        
        const trackInfo = {
          position: i + 1,
          song_id: song.id,
          name: songData.name,
          start_time: totalDuration,
          duration: songData.duration || 120 // default 2 minutes if not set
        };
        
        tracklist.push(trackInfo);
        totalDuration += trackInfo.duration;
      }
      
      // Create compilation record
      await env.DB.prepare(`
        INSERT INTO compilations (
          id, title, description, total_duration, video_loop_id, 
          thumbnail_id, tracklist, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        body.title,
        body.description || '',
        totalDuration,
        body.videoLoopId || null,
        body.thumbnailId || null,
        JSON.stringify(tracklist),
        'draft'
      ).run();
      
      // Insert track relationships
      for (const track of tracklist) {
        await env.DB.prepare(`
          INSERT INTO compilation_tracks (compilation_id, song_id, position, start_time, end_time)
          VALUES (?, ?, ?, ?, ?)
        `).bind(
          id,
          track.song_id,
          track.position,
          track.start_time,
          track.start_time + track.duration
        ).run();
      }
      
      return new Response(JSON.stringify({ 
        success: true, 
        id,
        totalDuration,
        trackCount: tracklist.length
      }), { headers });
    }
    
    // Get compilations
    if (pathname === '/api/compilations' && request.method === 'GET') {
      const compilations = await env.DB.prepare(`
        SELECT * FROM compilations 
        ORDER BY created_at DESC
      `).all();
      
      return new Response(JSON.stringify(compilations.results || []), { headers });
    }
    
    // Process compilation (create audio/video)
    if (pathname.match(/^\/api\/compilations\/[^\/]+\/process$/) && request.method === 'POST') {
      const id = pathname.split('/')[3];
      
      // Create processing job
      const jobId = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO processing_queue (id, type, compilation_id, status, input_data)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        jobId,
        'final_video',
        id,
        'pending',
        JSON.stringify({ compilationId: id })
      ).run();
      
      // Update compilation status
      await env.DB.prepare(`
        UPDATE compilations SET status = 'processing' WHERE id = ?
      `).bind(id).run();
      
      // In production, this would trigger an external service
      // For now, return job info
      return new Response(JSON.stringify({ 
        success: true,
        jobId,
        message: 'Compilation processing started. This will combine audio and create the final video.'
      }), { headers });
    }
    
    return new Response(JSON.stringify({ error: 'Not found' }), { 
      status: 404, 
      headers 
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: error.message 
    }), { 
      status: 500, 
      headers 
    });
  }
}

function getHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lofi Studio - Musikai Edition</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css">
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js" defer></script>
    <style>
        body { background-color: #1a1a1a; color: #e0e0e0; }
        .navbar { background-color: #2a2a2a !important; }
        .card { background-color: #2a2a2a; border: 1px solid #3a3a3a; }
        .btn-primary { background-color: #6f42c1; border-color: #6f42c1; }
        .btn-primary:hover { background-color: #5a32a3; border-color: #5a32a3; }
        .table-dark { background-color: #2a2a2a; }
        audio { width: 100%; }
        .badge-approved { background-color: #28a745; }
        .badge-rejected { background-color: #dc3545; }
        .badge-pending { background-color: #6c757d; }
    </style>
</head>
<body>
    <nav class="navbar navbar-dark">
        <div class="container-fluid">
            <span class="navbar-brand mb-0 h1">🎵 Lofi Studio</span>
            <ul class="nav nav-pills" id="main-tabs">
                <li class="nav-item">
                    <a class="nav-link active" data-bs-toggle="pill" href="#step1">
                        <span class="badge bg-secondary rounded-circle me-2">1</span>Upload Music
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" data-bs-toggle="pill" href="#step2">
                        <span class="badge bg-secondary rounded-circle me-2">2</span>Create Visuals
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" data-bs-toggle="pill" href="#step3">
                        <span class="badge bg-secondary rounded-circle me-2">3</span>Organize Albums
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" data-bs-toggle="pill" href="#step4">
                        <span class="badge bg-secondary rounded-circle me-2">4</span>Create Compilation
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" data-bs-toggle="pill" href="#step5">
                        <span class="badge bg-secondary rounded-circle me-2">5</span>Publish
                    </a>
                </li>
            </ul>
        </div>
    </nav>

    <div class="container-fluid mt-4">
        <div class="tab-content">
            <!-- Step 1: Upload Music -->
            <div class="tab-pane fade show active" id="step1" x-data="songsApp()">
                <!-- Guide Section -->
                <div class="row mb-4">
                    <div class="col">
                        <div class="alert alert-info">
                            <h5 class="alert-heading">📤 Step 1: Upload Your Music</h5>
                            <p>Start by uploading your lofi tracks. You can upload up to 30 songs at once. After uploading, listen to each track and approve the ones you want to release.</p>
                            <hr>
                            <p class="mb-0"><strong>Tip:</strong> Name your files descriptively before uploading (e.g., "Midnight Rain - Lofi Beat.mp3")</p>
                        </div>
                    </div>
                </div>

                <div class="row mb-4">
                    <div class="col">
                        <h2>Your Music Library</h2>
                    </div>
                    <div class="col text-end">
                        <input type="file" id="file-input" multiple accept="audio/*" style="display: none;" 
                               @change="uploadFiles($event)">
                        <button class="btn btn-primary btn-lg" onclick="document.getElementById('file-input').click()">
                            <i class="bi bi-cloud-upload"></i> Upload Songs
                        </button>
                    </div>
                </div>

                <!-- Upload Stats -->
                <div class="row mb-4" x-show="songs.length > 0">
                    <div class="col">
                        <div class="card bg-dark">
                            <div class="card-body">
                                <div class="row text-center">
                                    <div class="col-md-3">
                                        <h3 class="text-primary" x-text="songs.length"></h3>
                                        <p class="text-muted">Total Tracks</p>
                                    </div>
                                    <div class="col-md-3">
                                        <h3 class="text-success" x-text="songs.filter(s => s.status === 'approved').length"></h3>
                                        <p class="text-muted">Approved</p>
                                    </div>
                                    <div class="col-md-3">
                                        <h3 class="text-warning" x-text="songs.filter(s => !s.status || s.status === 'pending').length"></h3>
                                        <p class="text-muted">Pending</p>
                                    </div>
                                    <div class="col-md-3">
                                        <h3 class="text-danger" x-text="songs.filter(s => s.status === 'rejected').length"></h3>
                                        <p class="text-muted">Rejected</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="row mb-3">
                    <div class="col-md-4">
                        <select class="form-select" x-model="filter.status" @change="loadSongs()">
                            <option value="">All Status</option>
                            <option value="pending">Pending Review</option>
                            <option value="approved">Approved for Release</option>
                            <option value="rejected">Rejected</option>
                        </select>
                    </div>
                    <div class="col-md-8 text-end" x-show="songs.length > 0">
                        <button class="btn btn-outline-success" @click="approveAll()">
                            <i class="bi bi-check-all"></i> Approve All
                        </button>
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="table table-dark table-hover">
                        <thead>
                            <tr>
                                <th>Track Name</th>
                                <th>Preview</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <template x-for="song in songs" :key="song.id">
                                <tr>
                                    <td x-text="song.name"></td>
                                    <td>
                                        <audio controls :src="song.url" preload="none" style="height: 30px;"></audio>
                                    </td>
                                    <td>
                                        <span class="badge" :class="{
                                            'bg-success': song.status === 'approved',
                                            'bg-danger': song.status === 'rejected',
                                            'bg-secondary': !song.status || song.status === 'pending'
                                        }" x-text="song.status || 'pending'"></span>
                                    </td>
                                    <td>
                                        <button class="btn btn-sm btn-success" @click="updateStatus(song.id, 'approved')"
                                                x-show="song.status !== 'approved'">
                                            <i class="bi bi-check"></i> Approve
                                        </button>
                                        <button class="btn btn-sm btn-danger" @click="updateStatus(song.id, 'rejected')"
                                                x-show="song.status !== 'rejected'">
                                            <i class="bi bi-x"></i> Reject
                                        </button>
                                    </td>
                                </tr>
                            </template>
                        </tbody>
                    </table>
                </div>

                <!-- Next Step -->
                <div class="row mt-5" x-show="songs.filter(s => s.status === 'approved').length > 0">
                    <div class="col text-center">
                        <div class="alert alert-success">
                            <h5>✅ Ready for Next Step!</h5>
                            <p>You have <strong x-text="songs.filter(s => s.status === 'approved').length"></strong> approved tracks ready for visual content.</p>
                            <button class="btn btn-success btn-lg" @click="document.querySelector('[href=\'#step2\']').click()">
                                Continue to Create Visuals →
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Step 2: Create Visuals -->
            <div class="tab-pane fade" id="step2" x-data="artworkApp()">
                <!-- Guide Section -->
                <div class="row mb-4">
                    <div class="col">
                        <div class="alert alert-info">
                            <h5 class="alert-heading">🎨 Step 2: Create Visual Content</h5>
                            <p>Generate stunning album artwork and convert them into music videos. This helps your music stand out on streaming platforms and social media.</p>
                            <hr>
                            <p class="mb-0"><strong>Pro tip:</strong> Generate multiple artworks and pick your favorite. Then create videos for YouTube (16:9) and TikTok (9:16).</p>
                        </div>
                    </div>
                </div>

                <!-- Image Generation Section -->
                <div class="row mb-4">
                    <div class="col-12">
                        <h3 class="mb-3">🎨 Album Artwork Generation</h3>
                    </div>
                    <div class="col-md-6">
                        <div class="card">
                            <div class="card-body">
                                <h5 class="card-title">Generate Artwork with AI</h5>
                                
                                <!-- Model Selector -->
                                <div class="mb-3">
                                    <label class="form-label">Select Model</label>
                                    <select class="form-select" x-model="selectedModel" @change="updateModelParams()">
                                        <option value="fal-ai/flux-pro/v1.1-ultra">FLUX Pro Ultra (Best Quality)</option>
                                        <option value="fal-ai/flux/dev">FLUX Dev (Fast)</option>
                                        <option value="fal-ai/flux/schnell">FLUX Schnell (Fastest)</option>
                                        <option value="fal-ai/stable-diffusion-xl">Stable Diffusion XL</option>
                                        <option value="fal-ai/stable-diffusion-v3-medium">Stable Diffusion 3</option>
                                    </select>
                                </div>

                                <!-- Prompt -->
                                <div class="mb-3">
                                    <label class="form-label">Describe your album cover</label>
                                    <textarea class="form-control" rows="4" x-model="prompt" 
                                              placeholder="lofi aesthetic, cozy room, warm lighting, vinyl player, plants, nostalgic vibe"></textarea>
                                </div>

                                <!-- Model-specific parameters -->
                                <div x-show="modelParams.aspect_ratio !== undefined" class="mb-3">
                                    <label class="form-label">Aspect Ratio</label>
                                    <select class="form-select" x-model="modelParams.aspect_ratio">
                                        <option value="1:1">1:1 (Square - Album Cover)</option>
                                        <option value="16:9">16:9 (YouTube)</option>
                                        <option value="9:16">9:16 (TikTok/Shorts)</option>
                                        <option value="4:3">4:3</option>
                                        <option value="3:2">3:2</option>
                                    </select>
                                </div>

                                <div x-show="modelParams.num_inference_steps !== undefined" class="mb-3">
                                    <label class="form-label">Quality Steps: <span x-text="modelParams.num_inference_steps"></span></label>
                                    <input type="range" class="form-range" min="20" max="50" x-model="modelParams.num_inference_steps">
                                </div>

                                <div x-show="modelParams.guidance_scale !== undefined" class="mb-3">
                                    <label class="form-label">Guidance Scale: <span x-text="modelParams.guidance_scale"></span></label>
                                    <input type="range" class="form-range" min="1" max="20" step="0.5" x-model="modelParams.guidance_scale">
                                </div>

                                <button class="btn btn-primary w-100" @click="generateArtwork()" 
                                        :disabled="!prompt || isGenerating">
                                    <span x-show="!isGenerating">Generate Artwork</span>
                                    <span x-show="isGenerating">Generating...</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card">
                            <div class="card-body">
                                <h5 class="card-title">Preview</h5>
                                <div class="text-center">
                                    <img x-show="generatedUrl" :src="generatedUrl" class="img-fluid rounded" 
                                         style="max-height: 400px;">
                                    <p x-show="!generatedUrl" class="text-muted">No artwork generated yet</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Image to Video Section -->
                <div class="row mb-4" x-show="artworkHistory.length > 0">
                    <div class="col-12">
                        <h3 class="mb-3">🎬 Create Music Videos</h3>
                    </div>
                    <div class="col-md-6">
                        <div class="card">
                            <div class="card-body">
                                <h5 class="card-title">Image to Video</h5>
                                
                                <!-- Video Model Selector -->
                                <div class="mb-3">
                                    <label class="form-label">Select Video Model</label>
                                    <select class="form-select" x-model="selectedVideoModel" @change="updateVideoModelParams()">
                                        <option value="fal-ai/stable-video">Stable Video Diffusion</option>
                                        <option value="fal-ai/animatediff-v2v">AnimateDiff v2v</option>
                                        <option value="fal-ai/img2vid">Image2Video</option>
                                    </select>
                                </div>

                                <!-- Image Selection -->
                                <div class="mb-3">
                                    <label class="form-label">Select Image</label>
                                    <div class="row g-2" style="max-height: 200px; overflow-y: auto;">
                                        <template x-for="(art, index) in artworkHistory" :key="index">
                                            <div class="col-4">
                                                <img :src="art.url" 
                                                     class="img-fluid rounded cursor-pointer"
                                                     :class="{'border border-primary border-3': selectedImage === art.url}"
                                                     @click="selectedImage = art.url"
                                                     style="cursor: pointer;">
                                            </div>
                                        </template>
                                    </div>
                                </div>

                                <!-- Video Model Parameters -->
                                <div x-show="videoModelParams.motion_bucket_id !== undefined" class="mb-3">
                                    <label class="form-label">Motion Amount: <span x-text="videoModelParams.motion_bucket_id"></span></label>
                                    <input type="range" class="form-range" min="1" max="255" x-model="videoModelParams.motion_bucket_id">
                                </div>

                                <div x-show="videoModelParams.fps !== undefined" class="mb-3">
                                    <label class="form-label">FPS: <span x-text="videoModelParams.fps"></span></label>
                                    <input type="range" class="form-range" min="10" max="30" x-model="videoModelParams.fps">
                                </div>

                                <div x-show="videoModelParams.loop !== undefined" class="mb-3">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" x-model="videoModelParams.loop" id="loopCheck">
                                        <label class="form-check-label" for="loopCheck">
                                            Loop Video
                                            <span class="text-muted" title="Creates a seamless loop for continuous playback">(ℹ️)</span>
                                        </label>
                                    </div>
                                </div>

                                <button class="btn btn-success w-100" @click="generateVideo()" 
                                        :disabled="!selectedImage || isGeneratingVideo">
                                    <span x-show="!isGeneratingVideo">Generate Video</span>
                                    <span x-show="isGeneratingVideo">Generating Video...</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card">
                            <div class="card-body">
                                <h5 class="card-title">Video Preview</h5>
                                <div class="text-center">
                                    <video x-show="generatedVideoUrl" :src="generatedVideoUrl" controls class="img-fluid rounded" 
                                           style="max-height: 400px;"></video>
                                    <p x-show="!generatedVideoUrl" class="text-muted">No video generated yet</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Gallery -->
                <div class="row mt-4" x-show="artworkHistory.length > 0">
                    <div class="col">
                        <h4>Recent Artwork</h4>
                        <div class="row">
                            <template x-for="art in artworkHistory" :key="art.url">
                                <div class="col-md-3 mb-3">
                                    <img :src="art.url" class="img-fluid rounded cursor-pointer" 
                                         @click="generatedUrl = art.url"
                                         style="cursor: pointer;">
                                </div>
                            </template>
                        </div>
                    </div>
                </div>

                <!-- Next Step -->
                <div class="row mt-5" x-show="artworkHistory.length > 0">
                    <div class="col text-center">
                        <div class="alert alert-success">
                            <h5>✅ Visuals Ready!</h5>
                            <p>You have created artwork and videos for your music. Time to organize them into albums!</p>
                            <button class="btn btn-success btn-lg" @click="document.querySelector('[href=\'#step3\']').click()">
                                Continue to Organize Albums →
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Step 3: Organize Albums -->
            <div class="tab-pane fade" id="step3" x-data="albumsApp()">
                <!-- Guide Section -->
                <div class="row mb-4">
                    <div class="col">
                        <div class="alert alert-info">
                            <h5 class="alert-heading">💿 Step 3: Organize Into Albums</h5>
                            <p>Group your approved tracks into albums or singles. Each album needs a name, artist name, and cover artwork.</p>
                            <hr>
                            <p class="mb-0"><strong>Strategy:</strong> Consider releasing singles first to build momentum, then compile them into EPs or full albums.</p>
                        </div>
                    </div>
                </div>

                <div class="row mb-4">
                    <div class="col">
                        <h2>Your Albums</h2>
                    </div>
                    <div class="col text-end">
                        <button class="btn btn-primary btn-lg" @click="showCreateModal = true">
                            <i class="bi bi-plus-circle"></i> Create Album
                        </button>
                    </div>
                </div>

                <div class="row">
                    <template x-for="album in albums" :key="album.id">
                        <div class="col-md-4 mb-4">
                            <div class="card">
                                <div class="card-body">
                                    <h5 class="card-title" x-text="album.name"></h5>
                                    <p class="card-text" x-text="album.artist"></p>
                                    <p class="card-text">
                                        <small class="text-muted" x-text="album.songs ? album.songs.length + ' tracks' : '0 tracks'"></small>
                                    </p>
                                    <button class="btn btn-sm btn-primary">Edit</button>
                                    <button class="btn btn-sm btn-success">Publish</button>
                                </div>
                            </div>
                        </div>
                    </template>
                </div>

                <!-- Create Album Modal -->
                <div class="modal" :class="{ 'show d-block': showCreateModal }" x-show="showCreateModal">
                    <div class="modal-dialog">
                        <div class="modal-content bg-dark">
                            <div class="modal-header">
                                <h5 class="modal-title">Create Album</h5>
                                <button class="btn-close btn-close-white" @click="showCreateModal = false"></button>
                            </div>
                            <div class="modal-body">
                                <div class="mb-3">
                                    <label class="form-label">Album Name</label>
                                    <input type="text" class="form-control" x-model="newAlbum.name">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Artist Name</label>
                                    <input type="text" class="form-control" x-model="newAlbum.artist">
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button class="btn btn-secondary" @click="showCreateModal = false">Cancel</button>
                                <button class="btn btn-primary" @click="createAlbum()">Create</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Next Step -->
                <div class="row mt-5" x-show="albums.length > 0">
                    <div class="col text-center">
                        <div class="alert alert-success">
                            <h5>✅ Albums Organized!</h5>
                            <p>You have <strong x-text="albums.length"></strong> albums ready. Time to publish your music!</p>
                            <button class="btn btn-success btn-lg" @click="document.querySelector('[href=\'#step4\']').click()">
                                Continue to Create Compilation →
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Step 4: Create Compilation -->
            <div class="tab-pane fade" id="step4" x-data="compilationApp()">
                <div class="container-fluid">
                    <!-- Guide Section -->
                    <div class="row mb-4">
                        <div class="col">
                            <div class="alert alert-info">
                                <h5 class="alert-heading">🎬 Step 4: Create Lofi Compilation Video</h5>
                                <p>Combine your tracks into a lofi hip hop mix with a seamless video loop - perfect for YouTube!</p>
                                <hr>
                                <p class="mb-0"><strong>Goal:</strong> Create a video like "lofi hip hop radio - beats to relax/study to" with your selected tracks and a calming visual loop.</p>
                            </div>
                        </div>
                    </div>

                    <h2 class="mb-4">Compilation Builder</h2>
                    
                    <!-- Compilation Details -->
                    <div class="row mb-4">
                        <div class="col-md-6">
                            <div class="card">
                                <div class="card-body">
                                    <h5 class="card-title">Compilation Details</h5>
                                    <div class="mb-3">
                                        <label class="form-label">Title</label>
                                        <input type="text" class="form-control" x-model="compilation.title" 
                                               placeholder="lofi hip hop radio - beats to relax/study to">
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Description</label>
                                        <textarea class="form-control" rows="4" x-model="compilation.description"
                                                  placeholder="1 hour of lofi hip hop beats perfect for studying, relaxing, or just chilling."></textarea>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="card">
                                <div class="card-body">
                                    <h5 class="card-title">Compilation Stats</h5>
                                    <div class="row text-center">
                                        <div class="col-6">
                                            <h3 class="text-primary" x-text="selectedSongs.length"></h3>
                                            <p class="text-muted">Tracks Selected</p>
                                        </div>
                                        <div class="col-6">
                                            <h3 class="text-success" x-text="formatDuration(totalDuration)"></h3>
                                            <p class="text-muted">Total Duration</p>
                                        </div>
                                    </div>
                                    <div class="progress mt-3" style="height: 20px;">
                                        <div class="progress-bar" :style="'width: ' + (totalDuration / 3600 * 100) + '%'">
                                            <span x-text="Math.round(totalDuration / 3600 * 100) + '%'"></span>
                                        </div>
                                    </div>
                                    <small class="text-muted">Target: 60 minutes</small>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Video Loop Selection -->
                    <div class="row mb-4">
                        <div class="col-12">
                            <h4 class="mb-3">Select Video Loop</h4>
                            <div class="card">
                                <div class="card-body">
                                    <div class="row">
                                        <div class="col-md-6">
                                            <h6>Create New Loop</h6>
                                            <p class="text-muted">Generate a 2-5 second seamless loop from your artwork</p>
                                            <button class="btn btn-primary" @click="showLoopModal = true">
                                                <i class="bi bi-plus-circle"></i> Create Video Loop
                                            </button>
                                        </div>
                                        <div class="col-md-6">
                                            <h6>Existing Loops</h6>
                                            <div class="row g-2" style="max-height: 200px; overflow-y: auto;">
                                                <template x-for="loop in videoLoops" :key="loop.id">
                                                    <div class="col-4">
                                                        <div class="position-relative cursor-pointer" 
                                                             @click="compilation.videoLoopId = loop.id"
                                                             :class="{'border border-primary border-3': compilation.videoLoopId === loop.id}">
                                                            <video :src="loop.url" class="img-fluid rounded" 
                                                                   autoplay muted loop style="cursor: pointer;"></video>
                                                            <span class="badge bg-dark position-absolute bottom-0 end-0 m-1" 
                                                                  x-text="loop.duration + 's'"></span>
                                                        </div>
                                                    </div>
                                                </template>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Track Selection -->
                    <div class="row mb-4">
                        <div class="col-12">
                            <h4 class="mb-3">Select Tracks</h4>
                            <div class="card">
                                <div class="card-body">
                                    <div class="table-responsive">
                                        <table class="table table-dark table-hover">
                                            <thead>
                                                <tr>
                                                    <th width="50">
                                                        <input type="checkbox" @change="selectAll($event)">
                                                    </th>
                                                    <th>Track Name</th>
                                                    <th>Duration</th>
                                                    <th>Order</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <template x-for="song in approvedSongs" :key="song.id">
                                                    <tr>
                                                        <td>
                                                            <input type="checkbox" :value="song.id" 
                                                                   @change="toggleSong(song)"
                                                                   :checked="selectedSongs.some(s => s.id === song.id)">
                                                        </td>
                                                        <td x-text="song.name"></td>
                                                        <td x-text="formatDuration(song.duration || 120)"></td>
                                                        <td>
                                                            <span x-show="selectedSongs.some(s => s.id === song.id)" 
                                                                  class="badge bg-primary"
                                                                  x-text="selectedSongs.findIndex(s => s.id === song.id) + 1"></span>
                                                        </td>
                                                    </tr>
                                                </template>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Create Compilation Button -->
                    <div class="row">
                        <div class="col text-center">
                            <button class="btn btn-success btn-lg" @click="createCompilation()" 
                                    :disabled="selectedSongs.length === 0 || !compilation.videoLoopId || isCreating">
                                <span x-show="!isCreating">
                                    <i class="bi bi-play-circle"></i> Create Compilation (<span x-text="formatDuration(totalDuration)"></span>)
                                </span>
                                <span x-show="isCreating">Creating Compilation...</span>
                            </button>
                            <p class="text-muted mt-2">
                                <span x-show="selectedSongs.length === 0">Select tracks to create your compilation</span>
                                <span x-show="selectedSongs.length > 0 && !compilation.videoLoopId">Select a video loop</span>
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Video Loop Creation Modal -->
                <div class="modal" :class="{ 'show d-block': showLoopModal }" x-show="showLoopModal">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content bg-dark">
                            <div class="modal-header">
                                <h5 class="modal-title">Create Video Loop</h5>
                                <button class="btn-close btn-close-white" @click="showLoopModal = false"></button>
                            </div>
                            <div class="modal-body">
                                <p>Select an artwork to animate into a seamless 2-5 second loop:</p>
                                <div class="row g-2">
                                    <template x-for="art in $store.artworkHistory" :key="art.url">
                                        <div class="col-md-3">
                                            <img :src="art.url" class="img-fluid rounded cursor-pointer"
                                                 :class="{'border border-primary border-3': selectedArtwork === art.url}"
                                                 @click="selectedArtwork = art.url"
                                                 style="cursor: pointer;">
                                        </div>
                                    </template>
                                </div>
                                <div class="mt-3">
                                    <label class="form-label">Loop Duration (seconds)</label>
                                    <input type="range" class="form-range" min="2" max="5" step="0.5" x-model="loopDuration">
                                    <span x-text="loopDuration + ' seconds'"></span>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button class="btn btn-secondary" @click="showLoopModal = false">Cancel</button>
                                <button class="btn btn-primary" @click="createVideoLoop()" :disabled="!selectedArtwork">
                                    Create Loop
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Next Step -->
                <div class="row mt-5" x-show="compilations.length > 0">
                    <div class="col text-center">
                        <div class="alert alert-success">
                            <h5>✅ Compilation Ready!</h5>
                            <p>Your 1-hour lofi compilation is ready to publish!</p>
                            <button class="btn btn-success btn-lg" @click="document.querySelector('[href=\'#step5\']').click()">
                                Continue to Publish →
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Step 5: Publish -->
            <div class="tab-pane fade" id="step5">
                <div class="container-fluid">
                    <!-- Guide Section -->
                    <div class="row mb-4">
                        <div class="col">
                            <div class="alert alert-info">
                                <h5 class="alert-heading">🚀 Step 5: Publish Your Compilation</h5>
                                <p>Your 1-hour lofi mix is ready! Publish it to YouTube to reach millions of listeners.</p>
                                <hr>
                                <p class="mb-0"><strong>Format:</strong> 60-minute video with looping visuals and continuous audio - perfect for the lofi hip hop community!</p>
                            </div>
                        </div>
                    </div>

                    <h2 class="mb-4">Publishing Options</h2>
                    
                    <div class="row">
                        <!-- DistroKid Publishing -->
                        <div class="col-lg-4 mb-4">
                            <div class="card h-100">
                                <div class="card-body">
                                    <h3 class="card-title text-primary">
                                        <i class="bi bi-music-note-list"></i> DistroKid
                                    </h3>
                                    <p class="card-text">Release your 30-track album on all streaming platforms.</p>
                                    
                                    <h5>What you'll publish:</h5>
                                    <ul>
                                        <li>1 album with 30 tracks</li>
                                        <li>Album artwork (1:1 ratio)</li>
                                        <li>Total ~60 minutes</li>
                                        <li>Auto-distributed globally</li>
                                    </ul>
                                    
                                    <pre class="bg-dark p-2 rounded small">cd /Users/jeremycai/Projects/lofi-music/musikai
./musikai publish --config ../configs/publish.yaml</pre>
                                    
                                    <div class="alert alert-info mt-3">
                                        <small>
                                            <strong>Platforms:</strong> Spotify, Apple Music, YouTube Music + 150 more
                                        </small>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- YouTube Publishing -->
                        <div class="col-lg-4 mb-4">
                            <div class="card h-100">
                                <div class="card-body">
                                    <h3 class="card-title text-danger">
                                        <i class="bi bi-youtube"></i> YouTube
                                    </h3>
                                    <p class="card-text">Upload your 60-minute lofi compilation with looping visuals.</p>
                                    
                                    <h5>What you'll publish:</h5>
                                    <ul>
                                        <li>1-hour video (30 tracks)</li>
                                        <li>Seamless 2-5 second visual loop</li>
                                        <li>Timestamps in description</li>
                                        <li>Links to streaming platforms</li>
                                    </ul>
                                    
                                    <button class="btn btn-danger w-100" onclick="alert('YouTube integration coming soon! For now, download your compilation and upload manually.')">
                                        Upload Compilation to YouTube
                                    </button>
                                    
                                    <div class="alert alert-warning mt-3">
                                        <small>
                                            <strong>Format:</strong> "lofi hip hop mix - beats to study/relax to [1 HOUR]"
                                        </small>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- TikTok Publishing -->
                        <div class="col-lg-4 mb-4">
                            <div class="card h-100">
                                <div class="card-body">
                                    <h3 class="card-title">
                                        <i class="bi bi-tiktok"></i> TikTok
                                    </h3>
                                    <p class="card-text">Create a short preview to promote your full compilation.</p>
                                    
                                    <h5>What you'll create:</h5>
                                    <ul>
                                        <li>30-60 second preview</li>
                                        <li>Best track highlight</li>
                                        <li>9:16 vertical loop</li>
                                        <li>Link to full YouTube video</li>
                                    </ul>
                                    
                                    <button class="btn btn-dark w-100" onclick="alert('TikTok preview generator coming soon! For now, create a short clip manually.')">
                                        Create TikTok Preview
                                    </button>
                                    
                                    <div class="alert alert-info mt-3">
                                        <small>
                                            <strong>Strategy:</strong> "POV: you need music to study to" + link to full mix
                                        </small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Publishing Strategy -->
                    <div class="row mt-4">
                        <div class="col">
                            <div class="card">
                                <div class="card-body">
                                    <h4 class="card-title">📈 Multi-Platform Strategy</h4>
                                    <div class="row">
                                        <div class="col-md-4">
                                            <h5>1. Audio First (DistroKid)</h5>
                                            <p>Release on streaming platforms to establish your music catalog and earn royalties.</p>
                                        </div>
                                        <div class="col-md-4">
                                            <h5>2. Visual Content (YouTube)</h5>
                                            <p>Create music videos with your generated artwork to increase discovery and engagement.</p>
                                        </div>
                                        <div class="col-md-4">
                                            <h5>3. Social Media (TikTok)</h5>
                                            <p>Share snippets and loops to go viral and drive traffic to your full releases.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Guide Tab -->
            <div class="tab-pane fade" id="guide">
                <div class="container-fluid">
                    <h2 class="mb-4">📚 Complete Guide to Publishing Your Lofi Music</h2>
                    
                    <div class="row">
                        <div class="col-lg-8 mx-auto">
                            <!-- Overview -->
                            <div class="card mb-4">
                                <div class="card-body">
                                    <h3 class="card-title text-primary">🎯 Overview</h3>
                                    <p>This platform helps you organize and publish your lofi music to major streaming platforms through DistroKid. Follow this step-by-step guide to go from raw audio files to published albums on Spotify, Apple Music, and more.</p>
                                    <div class="alert alert-info">
                                        <strong>What you'll need:</strong>
                                        <ul class="mb-0">
                                            <li>Your lofi music files (MP3, WAV, or FLAC format)</li>
                                            <li>Creative ideas for album artwork</li>
                                            <li>Album and artist information</li>
                                            <li>Musikai installed locally for DistroKid publishing</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            <!-- Step 1: Upload Songs -->
                            <div class="card mb-4">
                                <div class="card-body">
                                    <h3 class="card-title text-primary">📤 Step 1: Upload Your Songs</h3>
                                    <ol>
                                        <li class="mb-3">
                                            <strong>Navigate to the Songs tab</strong>
                                            <p>Click on "Songs" in the navigation bar at the top of the page.</p>
                                        </li>
                                        <li class="mb-3">
                                            <strong>Upload your tracks</strong>
                                            <p>Click the "Upload Songs" button and select your audio files. You can upload multiple files at once (up to 30 tracks).</p>
                                            <div class="alert alert-warning">
                                                <strong>Supported formats:</strong> MP3, WAV, FLAC<br>
                                                <strong>Pro tip:</strong> Name your files descriptively before uploading (e.g., "Midnight Rain - Lofi Beat.mp3")
                                            </div>
                                        </li>
                                        <li class="mb-3">
                                            <strong>Review uploaded tracks</strong>
                                            <p>Once uploaded, you'll see all your tracks listed with audio players. Listen to each track to ensure they uploaded correctly.</p>
                                        </li>
                                        <li class="mb-3">
                                            <strong>Approve tracks for release</strong>
                                            <p>Click the "Approve" button for tracks you want to include in your release. You can also "Reject" tracks you don't want to use.</p>
                                        </li>
                                    </ol>
                                </div>
                            </div>

                            <!-- Step 2: Generate Artwork -->
                            <div class="card mb-4">
                                <div class="card-body">
                                    <h3 class="card-title text-primary">🎨 Step 2: Create Album Artwork</h3>
                                    <ol>
                                        <li class="mb-3">
                                            <strong>Go to the Artwork tab</strong>
                                            <p>Click on "Artwork" in the navigation bar.</p>
                                        </li>
                                        <li class="mb-3">
                                            <strong>Describe your vision</strong>
                                            <p>In the text area, describe the album cover you want. Be specific about mood, colors, and elements.</p>
                                            <div class="alert alert-success">
                                                <strong>Example prompts:</strong>
                                                <ul class="mb-0">
                                                    <li>"Cozy bedroom with warm fairy lights, vinyl player, rainy window, lofi aesthetic"</li>
                                                    <li>"Japanese street at night, neon signs, rain reflections, anime style, purple and blue tones"</li>
                                                    <li>"Minimalist coffee shop interior, plants, soft morning light, muted colors"</li>
                                                </ul>
                                            </div>
                                        </li>
                                        <li class="mb-3">
                                            <strong>Generate artwork</strong>
                                            <p>Click "Generate with FLUX Pro Ultra" and wait for your high-quality artwork to be created. This uses advanced AI to create professional album covers.</p>
                                        </li>
                                        <li class="mb-3">
                                            <strong>Save your favorites</strong>
                                            <p>Generate multiple options and click on any artwork in the history to select it as your current choice.</p>
                                        </li>
                                    </ol>
                                </div>
                            </div>

                            <!-- Step 3: Create Albums -->
                            <div class="card mb-4">
                                <div class="card-body">
                                    <h3 class="card-title text-primary">💿 Step 3: Organize into Albums</h3>
                                    <ol>
                                        <li class="mb-3">
                                            <strong>Navigate to Albums</strong>
                                            <p>Click on "Albums" in the navigation bar.</p>
                                        </li>
                                        <li class="mb-3">
                                            <strong>Create a new album</strong>
                                            <p>Click "Create Album" and enter:</p>
                                            <ul>
                                                <li><strong>Album Name:</strong> Choose a memorable title</li>
                                                <li><strong>Artist Name:</strong> Your artist or producer name</li>
                                            </ul>
                                        </li>
                                        <li class="mb-3">
                                            <strong>Add approved tracks</strong>
                                            <p>Select which approved tracks to include in this album. You can create multiple albums or singles.</p>
                                        </li>
                                        <li class="mb-3">
                                            <strong>Assign artwork</strong>
                                            <p>Link your generated artwork to the album.</p>
                                        </li>
                                    </ol>
                                </div>
                            </div>

                            <!-- Step 4: Publish -->
                            <div class="card mb-4">
                                <div class="card-body">
                                    <h3 class="card-title text-primary">🚀 Step 4: Publish to Streaming Platforms</h3>
                                    <ol>
                                        <li class="mb-3">
                                            <strong>Ensure Musikai is set up</strong>
                                            <p>Make sure you have Musikai installed and configured with your DistroKid credentials.</p>
                                        </li>
                                        <li class="mb-3">
                                            <strong>Update publish configuration</strong>
                                            <p>Edit <code>/Users/jeremycai/Projects/lofi-music/configs/publish.yaml</code> with your information:</p>
                                            <pre class="bg-dark p-2 rounded">first-name: Your
last-name: Name
record-label: Your Label Name</pre>
                                        </li>
                                        <li class="mb-3">
                                            <strong>Run the publish command</strong>
                                            <p>Open your terminal and run:</p>
                                            <pre class="bg-dark p-2 rounded">cd /Users/jeremycai/Projects/lofi-music/musikai
./musikai publish --config ../configs/publish.yaml</pre>
                                        </li>
                                        <li class="mb-3">
                                            <strong>Monitor the process</strong>
                                            <p>Musikai will automatically:</p>
                                            <ul>
                                                <li>Create releases on DistroKid</li>
                                                <li>Upload your tracks and artwork</li>
                                                <li>Set metadata and distribution options</li>
                                                <li>Submit to all major platforms</li>
                                            </ul>
                                        </li>
                                    </ol>
                                    <div class="alert alert-info">
                                        <strong>Distribution Timeline:</strong> After publishing, it typically takes:
                                        <ul class="mb-0">
                                            <li>Spotify: 2-5 days</li>
                                            <li>Apple Music: 24-48 hours</li>
                                            <li>YouTube Music: 1-2 days</li>
                                            <li>Other platforms: 1-2 weeks</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            <!-- Tips -->
                            <div class="card mb-4">
                                <div class="card-body">
                                    <h3 class="card-title text-primary">💡 Pro Tips</h3>
                                    <ul>
                                        <li class="mb-2"><strong>Batch Processing:</strong> Upload all 30 songs at once, then organize them into multiple EPs or albums.</li>
                                        <li class="mb-2"><strong>Consistent Branding:</strong> Use similar artwork styles across releases for brand recognition.</li>
                                        <li class="mb-2"><strong>Metadata Matters:</strong> Ensure track names are clean and properly capitalized before publishing.</li>
                                        <li class="mb-2"><strong>Release Strategy:</strong> Consider releasing singles first to build momentum, then compile into albums.</li>
                                        <li class="mb-2"><strong>Artwork Resolution:</strong> FLUX Pro Ultra generates high-quality images perfect for streaming platforms.</li>
                                    </ul>
                                </div>
                            </div>

                            <!-- Troubleshooting -->
                            <div class="card mb-4">
                                <div class="card-body">
                                    <h3 class="card-title text-primary">🔧 Troubleshooting</h3>
                                    <h5>Common Issues:</h5>
                                    <ul>
                                        <li class="mb-3">
                                            <strong>Upload fails:</strong>
                                            <p>Check file format and size. Files should be under 100MB each.</p>
                                        </li>
                                        <li class="mb-3">
                                            <strong>Artwork generation fails:</strong>
                                            <p>Try a simpler prompt or check the Fal.ai API status.</p>
                                        </li>
                                        <li class="mb-3">
                                            <strong>Musikai publish errors:</strong>
                                            <p>Ensure DistroKid credentials are correct in your Musikai configuration.</p>
                                        </li>
                                        <li class="mb-3">
                                            <strong>Tracks not appearing:</strong>
                                            <p>Refresh the page and check the filter status (pending/approved/rejected).</p>
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            <!-- Next Steps -->
                            <div class="card">
                                <div class="card-body">
                                    <h3 class="card-title text-primary">🎯 Ready to Start?</h3>
                                    <p>Now that you understand the process, head to the <a href="#songs" onclick="document.querySelector('[href=\'#songs\']').click()">Songs tab</a> to begin uploading your music!</p>
                                    <div class="alert alert-success">
                                        <strong>Remember:</strong> This platform handles the organization and preparation of your music. The actual publishing to DistroKid happens through Musikai on your local machine, giving you full control over the process.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Initialize Alpine store for sharing data between components
        document.addEventListener('alpine:init', () => {
            Alpine.store('artworkHistory', []);
        });
        
        function songsApp() {
            return {
                songs: [],
                filter: { status: '' },
                
                async init() {
                    await this.loadSongs();
                },
                
                async loadSongs() {
                    const response = await fetch('/api/songs');
                    const data = await response.json();
                    this.songs = data;
                    
                    if (this.filter.status) {
                        this.songs = this.songs.filter(s => s.status === this.filter.status);
                    }
                },
                
                async uploadFiles(event) {
                    const files = event.target.files;
                    for (const file of files) {
                        const formData = new FormData();
                        formData.append('file', file);
                        formData.append('metadata', JSON.stringify({
                            name: file.name.replace(/\.[^/.]+$/, ''),
                            size: file.size,
                            type: file.type
                        }));
                        
                        await fetch('/api/songs', {
                            method: 'POST',
                            body: formData
                        });
                    }
                    await this.loadSongs();
                    event.target.value = '';
                },
                
                async updateStatus(id, status) {
                    await fetch(\`/api/songs/\${id}\`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status })
                    });
                    await this.loadSongs();
                },
                
                async approveAll() {
                    const pendingSongs = this.songs.filter(s => !s.status || s.status === 'pending');
                    for (const song of pendingSongs) {
                        await this.updateStatus(song.id, 'approved');
                    }
                }
            };
        }
        
        function artworkApp() {
            return {
                prompt: '',
                isGenerating: false,
                generatedUrl: '',
                artworkHistory: [],
                selectedModel: 'fal-ai/flux-pro/v1.1-ultra',
                modelParams: {
                    aspect_ratio: '1:1',
                    num_inference_steps: 28,
                    guidance_scale: 3.5
                },
                
                // Video generation
                selectedVideoModel: 'fal-ai/stable-video',
                selectedImage: '',
                isGeneratingVideo: false,
                generatedVideoUrl: '',
                videoModelParams: {
                    motion_bucket_id: 127,
                    fps: 25,
                    loop: false
                },
                
                updateModelParams() {
                    // Reset params based on selected model
                    switch(this.selectedModel) {
                        case 'fal-ai/flux-pro/v1.1-ultra':
                            this.modelParams = {
                                aspect_ratio: '1:1'
                            };
                            break;
                        case 'fal-ai/flux/dev':
                        case 'fal-ai/flux/schnell':
                            this.modelParams = {
                                aspect_ratio: '1:1',
                                num_inference_steps: 28,
                                guidance_scale: 3.5
                            };
                            break;
                        case 'fal-ai/stable-diffusion-xl':
                        case 'fal-ai/stable-diffusion-v3-medium':
                            this.modelParams = {
                                aspect_ratio: '1:1',
                                num_inference_steps: 30,
                                guidance_scale: 7.5
                            };
                            break;
                    }
                },
                
                updateVideoModelParams() {
                    switch(this.selectedVideoModel) {
                        case 'fal-ai/stable-video':
                            this.videoModelParams = {
                                motion_bucket_id: 127,
                                fps: 25,
                                loop: false
                            };
                            break;
                        case 'fal-ai/animatediff-v2v':
                            this.videoModelParams = {
                                num_inference_steps: 25,
                                guidance_scale: 7.5,
                                loop: true
                            };
                            break;
                        case 'fal-ai/img2vid':
                            this.videoModelParams = {
                                fps: 24,
                                duration: 4,
                                loop: false
                            };
                            break;
                    }
                },
                
                async generateArtwork() {
                    if (!this.prompt || this.isGenerating) return;
                    
                    this.isGenerating = true;
                    try {
                        const response = await fetch('/api/artwork', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                prompt: this.prompt,
                                model: this.selectedModel,
                                params: this.modelParams
                            })
                        });
                        
                        const data = await response.json();
                        if (data.success) {
                            this.generatedUrl = data.url;
                            this.artworkHistory.unshift({ url: data.url, prompt: this.prompt });
                            if (this.artworkHistory.length > 12) {
                                this.artworkHistory = this.artworkHistory.slice(0, 12);
                            }
                            // Update Alpine store
                            Alpine.store('artworkHistory', this.artworkHistory);
                        } else {
                            alert('Failed to generate artwork: ' + (data.error || 'Unknown error'));
                        }
                    } catch (error) {
                        alert('Error generating artwork: ' + error.message);
                    }
                    this.isGenerating = false;
                },
                
                async generateVideo() {
                    if (!this.selectedImage || this.isGeneratingVideo) return;
                    
                    this.isGeneratingVideo = true;
                    try {
                        const response = await fetch('/api/video', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                imageUrl: this.selectedImage,
                                model: this.selectedVideoModel,
                                params: this.videoModelParams
                            })
                        });
                        
                        const data = await response.json();
                        if (data.success) {
                            this.generatedVideoUrl = data.url;
                        } else {
                            alert('Failed to generate video: ' + (data.error || 'Unknown error'));
                        }
                    } catch (error) {
                        alert('Error generating video: ' + error.message);
                    }
                    this.isGeneratingVideo = false;
                }
            };
        }
        
        function albumsApp() {
            return {
                albums: [],
                showCreateModal: false,
                newAlbum: { name: '', artist: '' },
                
                async init() {
                    await this.loadAlbums();
                },
                
                async loadAlbums() {
                    const response = await fetch('/api/albums');
                    this.albums = await response.json();
                },
                
                async createAlbum() {
                    await fetch('/api/albums', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(this.newAlbum)
                    });
                    this.showCreateModal = false;
                    this.newAlbum = { name: '', artist: '' };
                    await this.loadAlbums();
                }
            };
        }
        
        function compilationApp() {
            return {
                compilation: {
                    title: 'lofi hip hop radio - beats to relax/study to',
                    description: '1 hour of lofi hip hop beats perfect for studying, relaxing, or just chilling.',
                    videoLoopId: null
                },
                approvedSongs: [],
                selectedSongs: [],
                videoLoops: [],
                compilations: [],
                totalDuration: 0,
                isCreating: false,
                showLoopModal: false,
                selectedArtwork: '',
                loopDuration: 3,
                
                async init() {
                    // Load approved songs
                    const songsResponse = await fetch('/api/songs');
                    const allSongs = await songsResponse.json();
                    this.approvedSongs = allSongs.filter(s => s.status === 'approved');
                    
                    // Load video loops
                    const loopsResponse = await fetch('/api/video-loops');
                    this.videoLoops = await loopsResponse.json();
                    
                    // Load existing compilations
                    const compilationsResponse = await fetch('/api/compilations');
                    this.compilations = await compilationsResponse.json();
                    
                    // Make artwork history available
                    this.$store = {
                        artworkHistory: Alpine.store('artworkHistory') || []
                    };
                },
                
                toggleSong(song) {
                    const index = this.selectedSongs.findIndex(s => s.id === song.id);
                    if (index > -1) {
                        this.selectedSongs.splice(index, 1);
                    } else {
                        this.selectedSongs.push(song);
                    }
                    this.calculateDuration();
                },
                
                selectAll(event) {
                    if (event.target.checked) {
                        this.selectedSongs = [...this.approvedSongs];
                    } else {
                        this.selectedSongs = [];
                    }
                    this.calculateDuration();
                },
                
                calculateDuration() {
                    this.totalDuration = this.selectedSongs.reduce((total, song) => {
                        return total + (song.duration || 120); // default 2 minutes
                    }, 0);
                },
                
                formatDuration(seconds) {
                    const minutes = Math.floor(seconds / 60);
                    const secs = seconds % 60;
                    return minutes + ':' + secs.toString().padStart(2, '0');
                },
                
                async createVideoLoop() {
                    if (!this.selectedArtwork) return;
                    
                    const response = await fetch('/api/video', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            imageUrl: this.selectedArtwork,
                            createLoop: true,
                            name: 'Compilation Loop',
                            model: 'fal-ai/stable-video',
                            params: {
                                duration: this.loopDuration,
                                fps: 24,
                                loop: true
                            }
                        })
                    });
                    
                    const data = await response.json();
                    if (data.success) {
                        // Reload video loops
                        const loopsResponse = await fetch('/api/video-loops');
                        this.videoLoops = await loopsResponse.json();
                        this.compilation.videoLoopId = data.id;
                        this.showLoopModal = false;
                    }
                },
                
                async createCompilation() {
                    if (this.selectedSongs.length === 0 || !this.compilation.videoLoopId) return;
                    
                    this.isCreating = true;
                    try {
                        // Create compilation
                        const response = await fetch('/api/compilations', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                title: this.compilation.title,
                                description: this.compilation.description,
                                songs: this.selectedSongs,
                                videoLoopId: this.compilation.videoLoopId,
                                thumbnailId: this.selectedArtwork
                            })
                        });
                        
                        const data = await response.json();
                        if (data.success) {
                            // Trigger processing
                            await fetch('/api/compilations/' + data.id + '/process', {
                                method: 'POST'
                            });
                            
                            alert('Compilation created! Total duration: ' + this.formatDuration(data.totalDuration) + '. Processing will combine audio and create the final video.');
                            
                            // Reload compilations
                            const compilationsResponse = await fetch('/api/compilations');
                            this.compilations = await compilationsResponse.json();
                        }
                    } catch (error) {
                        alert('Error creating compilation: ' + error.message);
                    }
                    this.isCreating = false;
                }
            };
        }
    </script>
</body>
</html>`;
}