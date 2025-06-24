// Modern Lofi Studio Worker with clean UI

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
    
    // Serve the modern UI
    return new Response(getModernHTML(), {
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
      console.log('Songs from DB:', songs.results?.length || 0);
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
    
    // Generate music using AI Music API (Udio)
    if (pathname === '/api/generate-music' && request.method === 'POST') {
      const body = await request.json();
      
      // Prepare request for AI Music API
      const generateRequest = {
        gpt_description_prompt: body.prompt || "lofi, jazzy, relaxing, calm, 90s hip hop",
        make_instrumental: body.instrumental !== false, // default to true for lofi
        model: body.model || "chirp-v4-5"
      };
      
      // If using custom mode
      if (body.customMode) {
        delete generateRequest.gpt_description_prompt;
        generateRequest.prompt = body.prompt;
        generateRequest.title = body.title;
        generateRequest.tags = body.tags;
      }
      
      // Call AI Music API
      const udioResponse = await fetch('https://udioapi.pro/api/v2/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.UDIOAPI_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(generateRequest)
      });
      
      if (!udioResponse.ok) {
        const error = await udioResponse.text();
        return new Response(JSON.stringify({ error: `AI Music API error: ${error}` }), { 
          status: udioResponse.status, 
          headers 
        });
      }
      
      const udioData = await udioResponse.json();
      
      // Create a placeholder entry in the database immediately
      const placeholderId = crypto.randomUUID();
      const placeholderTitle = body.customMode && body.title ? body.title : 'AI Generation in Progress';
      
      await env.DB.prepare(`
        INSERT INTO songs (id, name, url, duration, status, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        placeholderId,
        placeholderTitle,
        '', // No URL yet
        0,  // Duration unknown
        'generating', // New status
        JSON.stringify({
          source: 'ai-music-api',
          workId: udioData.workId,
          model: body.model || 'chirp-v4-5',
          prompt: body.prompt,
          tags: body.tags || '',
          customMode: body.customMode || false,
          generating: true
        }),
        new Date().toISOString()
      ).run();
      
      return new Response(JSON.stringify({ 
        success: true,
        workId: udioData.workId,
        placeholderId: placeholderId,
        message: 'Music generation started.'
      }), { headers });
    }
    
    // Check music generation status
    if (pathname === '/api/generate-music-status' && request.method === 'GET') {
      const url = new URL(request.url);
      const workId = url.searchParams.get('workId');
      
      if (!workId) {
        return new Response(JSON.stringify({ error: 'workId parameter required' }), { 
          status: 400, 
          headers 
        });
      }
      
      // Call AI Music API feed endpoint
      const statusResponse = await fetch(`https://udioapi.pro/api/v2/feed?workId=${workId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${env.UDIOAPI_KEY}`
        }
      });
      
      if (!statusResponse.ok) {
        const error = await statusResponse.text();
        return new Response(JSON.stringify({ error: `AI Music API error: ${error}` }), { 
          status: statusResponse.status, 
          headers 
        });
      }
      
      const statusData = await statusResponse.json();
      
      // Log the response for debugging
      console.log('AI Music API Status Response:', JSON.stringify(statusData));
      
      // Process tracks based on status
      // The API can return: IN_PROGRESS, SUCCESS, COMPLETED, etc.
      if (statusData.data) {
        const tracks = statusData.data.response_data || [];
        const completedTracks = [];
        
        console.log('Status check - Type:', statusData.data.type, 'Tracks:', tracks.length);
        
        for (const track of tracks) {
          console.log('Processing track:', JSON.stringify(track));
          
          // Check various status fields that might indicate completion
          const isComplete = track.status === 'complete' || 
                           track.status === 'SUCCESS' || 
                           track.status === 'streaming' ||
                           (track.audio_url && !track.status); // Sometimes status might be missing
                           
          if (track.audio_url && isComplete) {
            // First check if we have a placeholder for this workId
            const placeholder = await env.DB.prepare(
              'SELECT id FROM songs WHERE metadata LIKE ? AND status = ?'
            ).bind(`%"workId":"${workId}"%`, 'generating').first();
            
            // Also check if this track URL is already saved
            const existingByUrl = await env.DB.prepare(
              'SELECT id FROM songs WHERE metadata LIKE ?'
            ).bind(`%"originalUrl":"${track.audio_url}"%`).first();
            
            const existing = placeholder || existingByUrl;
            
            if (existing) {
              console.log('Track already exists:', track.audio_url);
              // Track already saved, just add to completed list
              const existingSong = await env.DB.prepare(
                'SELECT * FROM songs WHERE id = ?'
              ).bind(existing.id).first();
              
              completedTracks.push({
                id: existing.id,
                name: existingSong.name,
                url: existingSong.url,
                duration: existingSong.duration,
                alreadyExisted: true
              });
            } else {
              console.log('Saving new track:', track.title || 'Untitled');
              
              // Download and store the audio file
              try {
                const audioResponse = await fetch(track.audio_url);
                if (!audioResponse.ok) {
                  console.error('Failed to download audio:', audioResponse.status);
                  continue;
                }
                
                const audioBlob = await audioResponse.blob();
                
                // Use existing ID if we have a placeholder, otherwise generate new
                const id = placeholder ? placeholder.id : crypto.randomUUID();
                const key = `songs/${id}.mp3`;
                
                await env.R2.put(key, audioBlob.stream(), {
                  httpMetadata: {
                    contentType: 'audio/mpeg',
                  },
                });
                
                // Parse duration if it's a string like "109.8 s"
                let duration = track.duration;
                if (typeof duration === 'string' && duration.includes(' s')) {
                  duration = parseFloat(duration.split(' ')[0]);
                } else if (!duration) {
                  duration = 120; // default
                }
                
                if (placeholder) {
                  // Update the existing placeholder
                  await env.DB.prepare(`
                    UPDATE songs 
                    SET name = ?, url = ?, duration = ?, status = ?, metadata = ?
                    WHERE id = ?
                  `).bind(
                    track.title || 'AI Generated Track',
                    `/files/${key}`,
                    Math.round(duration),
                    'approved',
                    JSON.stringify({
                      source: 'ai-music-api',
                      workId: workId,
                      originalUrl: track.audio_url,
                      model: track.model_name || track.model,
                      prompt: track.prompt,
                      tags: track.tags,
                      trackId: track.id,
                      createdAt: track.created_at,
                      generating: false
                    }),
                    id
                  ).run();
                } else {
                  // Create new entry
                  await env.DB.prepare(`
                    INSERT INTO songs (id, name, url, duration, status, metadata, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                  `).bind(
                    id,
                    track.title || 'AI Generated Track',
                    `/files/${key}`,
                    Math.round(duration),
                    'approved',
                    JSON.stringify({
                      source: 'ai-music-api',
                      workId: workId,
                      originalUrl: track.audio_url,
                      model: track.model_name || track.model,
                      prompt: track.prompt,
                      tags: track.tags,
                      trackId: track.id,
                      createdAt: track.created_at
                    }),
                    track.created_at || new Date().toISOString()
                  ).run();
                }
                
                completedTracks.push({
                  id,
                  name: track.title || 'AI Generated Track',
                  url: `/files/${key}`,
                  duration: Math.round(duration),
                  newlySaved: true
                });
                
                console.log('Successfully saved track:', track.title);
              } catch (saveError) {
                console.error('Error saving track:', saveError);
              }
            }
          }
        }
        
        // Return results regardless of status type
        return new Response(JSON.stringify({ 
          success: true,
          status: statusData.data.type || statusData.data.status,
          tracks: completedTracks,
          summary: {
            totalTracks: tracks.length,
            savedTracks: completedTracks.filter(t => t.newlySaved).length,
            existingTracks: completedTracks.filter(t => t.alreadyExisted).length,
            statusType: statusData.data.type
          },
          rawData: statusData.data
        }), { headers });
      }
      
      // Still processing or other status
      const tracks = statusData.data?.response_data || [];
      const debugInfo = {
        responseType: statusData.data?.type,
        tracksFound: tracks.length,
        trackStatuses: tracks.map(t => ({ 
          title: t.title, 
          status: t.status,
          hasAudio: !!t.audio_url 
        }))
      };
      
      console.log('Generation still in progress:', debugInfo);
      
      return new Response(JSON.stringify({ 
        success: true,
        status: statusData.data?.type || 'PROCESSING',
        message: 'Still generating...',
        rawData: statusData.data,
        debug: debugInfo
      }), { headers });
    }
    
    // Sync all music from AI Music API
    if (pathname === '/api/sync-ai-music' && request.method === 'POST') {
      const body = await request.json();
      
      try {
        const syncedTracks = [];
        let workIdsToCheck = [];
        
        // First, let's check if there's a logs endpoint at the root
        // The docs show the API is at udioapi.pro, not udioapi.pro/api
        const logsUrl = 'https://udioapi.pro/logs';
        console.log('Trying logs endpoint:', logsUrl);
        
        const logsResponse = await fetch(logsUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${env.UDIOAPI_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('Logs API response status:', logsResponse.status);
        console.log('Logs API headers:', Object.fromEntries(logsResponse.headers));
        
        if (logsResponse.ok) {
          try {
            const logsText = await logsResponse.text();
            console.log('Logs API raw response:', logsText);
            
            if (logsText) {
              const logsData = JSON.parse(logsText);
              // Try different possible response structures
              if (logsData.data && Array.isArray(logsData.data)) {
                workIdsToCheck = logsData.data
                  .filter(log => log.workId)
                  .map(log => log.workId);
              } else if (Array.isArray(logsData)) {
                workIdsToCheck = logsData
                  .filter(log => log.workId)
                  .map(log => log.workId);
              } else if (logsData.logs && Array.isArray(logsData.logs)) {
                workIdsToCheck = logsData.logs
                  .filter(log => log.workId || log.work_id)
                  .map(log => log.workId || log.work_id);
              }
            }
          } catch (parseError) {
            console.error('Error parsing logs response:', parseError);
          }
        } else {
          const errorText = await logsResponse.text();
          console.log('Logs API error response:', errorText);
          
          // Return debug info about the API
          return new Response(JSON.stringify({ 
            success: false,
            error: `Logs endpoint returned ${logsResponse.status}`,
            debug: {
              triedUrl: logsUrl,
              status: logsResponse.status,
              response: errorText.substring(0, 200)
            }
          }), { headers });
        }
        
        // Also check any locally stored work IDs
        const localWorkIds = body.workIds || [];
        workIdsToCheck = [...new Set([...workIdsToCheck, ...localWorkIds])];
        
        console.log('Work IDs from logs:', workIdsToCheck);
        console.log('Work IDs from request:', localWorkIds);
        console.log('Total work IDs to check:', workIdsToCheck.length);
        
        if (workIdsToCheck.length === 0) {
          return new Response(JSON.stringify({ 
            success: true,
            message: 'No generations found to sync. The AI Music API logs endpoint may not be available.',
            tracks: [],
            debug: {
              logsEndpointStatus: logsResponse.status,
              localWorkIds: localWorkIds,
              hint: 'Try using the debug tool below with a work ID from your email receipt'
            }
          }), { headers });
        }
          
          // Check each work ID
          for (const workId of workIdsToCheck) {
            const statusResponse = await fetch(`https://udioapi.pro/api/v2/feed?workId=${workId}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${env.UDIOAPI_KEY}`
              }
            });
            
            if (statusResponse.ok) {
              const statusData = await statusResponse.json();
              if (statusData.data && statusData.data.type === 'SUCCESS') {
                const tracks = statusData.data.response_data || [];
                
                for (const track of tracks) {
                  const isComplete = track.status === 'complete' || 
                                   track.status === 'SUCCESS' || 
                                   track.status === 'streaming' ||
                                   (track.audio_url && !track.status);
                                   
                  if (track.audio_url && isComplete) {
                    // Check if already exists
                    const existing = await env.DB.prepare(
                      'SELECT id FROM songs WHERE metadata LIKE ?'
                    ).bind(`%"originalUrl":"${track.audio_url}"%`).first();
                    
                    if (!existing) {
                      // Download and save
                      const audioResponse = await fetch(track.audio_url);
                      const audioBlob = await audioResponse.blob();
                      
                      const id = crypto.randomUUID();
                      const key = `songs/${id}.mp3`;
                      
                      await env.R2.put(key, audioBlob.stream(), {
                        httpMetadata: {
                          contentType: 'audio/mpeg',
                        },
                      });
                      
                      await env.DB.prepare(`
                        INSERT INTO songs (id, name, url, duration, status, metadata, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                      `).bind(
                        id,
                        track.title || 'AI Generated Track',
                        `/files/${key}`,
                        track.duration || 120,
                        'approved',
                        JSON.stringify({
                          source: 'ai-music-api',
                          workId: workId,
                          originalUrl: track.audio_url,
                          model: track.model_name,
                          prompt: track.prompt,
                          tags: track.tags,
                          syncedAt: new Date().toISOString()
                        }),
                        track.created_at || new Date().toISOString()
                      ).run();
                      
                      syncedTracks.push({
                        id,
                        name: track.title || 'AI Generated Track',
                        url: `/files/${key}`
                      });
                    }
                  }
                }
              }
            }
          }
          
        return new Response(JSON.stringify({ 
          success: true,
          message: `Synced ${syncedTracks.length} new tracks from ${workIdsToCheck.length} generations`,
          tracks: syncedTracks,
          checkedWorkIds: workIdsToCheck
        }), { headers });
        
      } catch (error) {
        return new Response(JSON.stringify({ 
          error: `Sync error: ${error.message}` 
        }), { 
          status: 500, 
          headers 
        });
      }
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
      const baseParams = body.params || {};
      
      // Generate all 3 aspect ratios
      const aspectRatios = [
        { ratio: '1:1', label: 'album' },      // Album cover
        { ratio: '16:9', label: 'youtube' },    // YouTube
        { ratio: '9:16', label: 'tiktok' }      // TikTok
      ];
      
      const generatedImages = [];
      
      // Generate images for each aspect ratio
      for (const aspect of aspectRatios) {
        // Build request body based on model
        const requestBody = {
          prompt: `${body.prompt}, album cover art, high quality, professional design`,
          ...baseParams,
          aspect_ratio: aspect.ratio
        };
        
        // Ensure we have required params for each model
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
          console.error(`Fal.ai error for ${aspect.ratio}: ${error}`);
          continue; // Skip this aspect ratio
        }
        
        const falData = await falResponse.json();
        
        // Download the generated image and upload to R2
        if (falData.images && falData.images[0]) {
          const imageUrl = falData.images[0].url;
          const imageResponse = await fetch(imageUrl);
          const imageBlob = await imageResponse.blob();
          
          const id = crypto.randomUUID();
          const key = `artwork/${id}-${aspect.label}.jpg`;
          
          await env.R2.put(key, imageBlob.stream(), {
            httpMetadata: {
              contentType: 'image/jpeg',
            },
          });
          
          generatedImages.push({
            aspectRatio: aspect.ratio,
            label: aspect.label,
            url: `/files/${key}`,
            falUrl: imageUrl
          });
        }
      }
      
      if (generatedImages.length > 0) {
        return new Response(JSON.stringify({ 
          success: true,
          images: generatedImages,
          // Keep backward compatibility
          url: generatedImages.find(img => img.label === 'album')?.url || generatedImages[0].url,
          falUrl: generatedImages.find(img => img.label === 'album')?.falUrl || generatedImages[0].falUrl
        }), { headers });
      }
      
      return new Response(JSON.stringify({ error: 'No images generated' }), { 
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
          thumbnail_id, tracklist, status, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        body.title,
        body.description || '',
        totalDuration,
        body.videoLoopId || null,
        body.thumbnailId || null,
        JSON.stringify(tracklist),
        'draft',
        JSON.stringify({ artist: body.artist || 'Unknown Artist' })
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

function getModernHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lofi Studio</title>
    <script src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js" defer></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        :root {
            --bg: #0a0a0a;
            --bg-secondary: #141414;
            --bg-tertiary: #1a1a1a;
            --border: #262626;
            --text: #fafafa;
            --text-muted: #a3a3a3;
            --primary: #fafafa;
            --success: #22c55e;
            --danger: #ef4444;
            --warning: #f59e0b;
            --info: #3b82f6;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: var(--bg);
            color: var(--text);
            line-height: 1.6;
            -webkit-font-smoothing: antialiased;
        }
        
        /* Layout */
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 1rem;
        }
        
        /* Navigation */
        nav {
            background: rgba(10, 10, 10, 0.8);
            backdrop-filter: blur(10px);
            border-bottom: 1px solid var(--border);
            position: sticky;
            top: 0;
            z-index: 100;
        }
        
        .nav-content {
            display: flex;
            align-items: center;
            justify-content: space-between;
            height: 64px;
            padding: 0 2rem;
        }
        
        .nav-brand {
            font-size: 1.25rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .nav-tabs {
            display: flex;
            gap: 0.5rem;
            list-style: none;
        }
        
        .nav-tab {
            padding: 0.5rem 1rem;
            border-radius: 0.5rem;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: var(--text-muted);
            font-size: 0.875rem;
            font-weight: 500;
            background: transparent;
            border: none;
        }
        
        .nav-tab:hover {
            background: var(--bg-secondary);
            color: var(--text);
        }
        
        .nav-tab.active {
            background: var(--bg-secondary);
            color: var(--text);
        }
        
        .step-badge {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: var(--bg-tertiary);
            color: var(--text-muted);
            font-size: 0.75rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .nav-tab.active .step-badge {
            background: var(--primary);
            color: var(--bg);
        }
        
        /* Main content */
        main {
            padding: 2rem 0;
        }
        
        .tab-content {
            display: none;
        }
        
        .tab-content.active {
            display: block;
        }
        
        /* Cards */
        .card {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 0.75rem;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
        }
        
        .card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 1rem;
        }
        
        .card-title {
            font-size: 1.125rem;
            font-weight: 600;
        }
        
        /* Buttons */
        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            border-radius: 0.5rem;
            font-size: 0.875rem;
            font-weight: 500;
            border: none;
            cursor: pointer;
            transition: all 0.2s;
            text-decoration: none;
        }
        
        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .btn-primary {
            background: var(--primary);
            color: var(--bg);
        }
        
        .btn-primary:hover:not(:disabled) {
            background: #e5e5e5;
        }
        
        .btn-secondary {
            background: var(--bg-tertiary);
            color: var(--text);
            border: 1px solid var(--border);
        }
        
        .btn-secondary:hover:not(:disabled) {
            background: var(--border);
        }
        
        .btn-success {
            background: var(--success);
            color: white;
        }
        
        .btn-danger {
            background: var(--danger);
            color: white;
        }
        
        .btn-lg {
            padding: 0.75rem 1.5rem;
            font-size: 1rem;
        }
        
        .btn-sm {
            padding: 0.375rem 0.75rem;
            font-size: 0.8125rem;
        }
        
        /* Remove focus outlines */
        .btn:focus,
        .btn:focus-visible,
        button:focus,
        button:focus-visible,
        input:focus,
        select:focus,
        textarea:focus {
            outline: none !important;
            box-shadow: none !important;
        }
        
        /* Forms */
        .form-group {
            margin-bottom: 1rem;
        }
        
        .form-label {
            display: block;
            margin-bottom: 0.5rem;
            font-size: 0.875rem;
            font-weight: 500;
        }
        
        .form-control {
            width: 100%;
            padding: 0.5rem 0.75rem;
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 0.5rem;
            color: var(--text);
            font-size: 0.875rem;
            transition: all 0.2s;
        }
        
        .form-control:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(250, 250, 250, 0.1);
        }
        
        textarea.form-control {
            resize: vertical;
            min-height: 100px;
        }
        
        /* Tables */
        .table-container {
            overflow-x: auto;
            border: 1px solid var(--border);
            border-radius: 0.75rem;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
        }
        
        th {
            text-align: left;
            padding: 1rem;
            background: var(--bg-tertiary);
            font-size: 0.875rem;
            font-weight: 500;
            color: var(--text-muted);
            border-bottom: 1px solid var(--border);
        }
        
        td {
            padding: 1rem;
            font-size: 0.875rem;
            border-bottom: 1px solid var(--border);
        }
        
        tr:hover {
            background: var(--bg-tertiary);
        }
        
        /* Status badges */
        .status-badge {
            display: inline-flex;
            align-items: center;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 500;
        }
        
        .status-approved {
            background: rgba(34, 197, 94, 0.2);
            color: #22c55e;
        }
        
        .status-pending {
            background: rgba(163, 163, 163, 0.2);
            color: #a3a3a3;
        }
        
        .status-rejected {
            background: rgba(239, 68, 68, 0.2);
            color: #ef4444;
        }
        
        .status-generating {
            background: rgba(59, 130, 246, 0.2);
            color: #3b82f6;
        }
        
        /* Alert */
        .alert {
            padding: 1rem;
            border-radius: 0.5rem;
            margin-bottom: 1rem;
            background: var(--bg-secondary);
            border: 1px solid var(--border);
        }
        
        .alert-info {
            background: rgba(59, 130, 246, 0.1);
            border-color: rgba(59, 130, 246, 0.3);
            color: #93bbfc;
        }
        
        .alert-success {
            background: rgba(34, 197, 94, 0.1);
            border-color: rgba(34, 197, 94, 0.3);
            color: #86efac;
        }
        
        /* Grid */
        .grid {
            display: grid;
            gap: 1rem;
        }
        
        .grid-2 {
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        }
        
        .grid-3 {
            grid-template-columns: repeat(3, 1fr);
        }
        
        .grid-4 {
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        }
        
        /* Stats */
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }
        
        .stat-card {
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 0.5rem;
            padding: 1.5rem;
            text-align: center;
        }
        
        .stat-value {
            font-size: 2rem;
            font-weight: 700;
            margin-bottom: 0.25rem;
        }
        
        .stat-label {
            font-size: 0.875rem;
            color: var(--text-muted);
        }
        
        /* Progress */
        .progress {
            height: 0.5rem;
            background: var(--bg-tertiary);
            border-radius: 9999px;
            overflow: hidden;
            margin-top: 0.5rem;
        }
        
        .progress-bar {
            height: 100%;
            background: var(--primary);
            transition: width 0.3s;
        }
        
        /* Modal */
        .modal {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.8);
            z-index: 200;
            padding: 2rem;
        }
        
        .modal.show {
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .modal-content {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 0.75rem;
            max-width: 600px;
            width: 100%;
            max-height: 80vh;
            overflow-y: auto;
        }
        
        .modal-header {
            padding: 1.5rem;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        
        .modal-body {
            padding: 1.5rem;
        }
        
        .modal-footer {
            padding: 1.5rem;
            border-top: 1px solid var(--border);
            display: flex;
            gap: 0.5rem;
            justify-content: flex-end;
        }
        
        /* Audio */
        audio {
            width: 100%;
            height: 32px;
            filter: invert(1);
        }
        
        /* Utilities */
        .text-center { text-align: center; }
        .text-muted { color: var(--text-muted); }
        .mt-4 { margin-top: 1rem; }
        .mb-4 { margin-bottom: 1rem; }
        .flex { display: flex; }
        .items-center { align-items: center; }
        .justify-between { justify-content: space-between; }
        .gap-2 { gap: 0.5rem; }
        .gap-4 { gap: 1rem; }
        
        /* Image gallery */
        .image-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 0.75rem;
        }
        
        .image-item {
            position: relative;
            aspect-ratio: 1;
            border-radius: 0.5rem;
            overflow: hidden;
            cursor: pointer;
            border: 2px solid transparent;
            transition: all 0.2s;
        }
        
        .image-item:hover {
            border-color: var(--border);
        }
        
        .image-item.selected {
            border-color: var(--primary);
        }
        
        .image-item img,
        .image-item video {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        /* Loading */
        .loading {
            display: inline-block;
            width: 1rem;
            height: 1rem;
            border: 2px solid var(--text);
            border-radius: 50%;
            border-top-color: transparent;
            animation: spin 0.8s linear infinite;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        /* Responsive */
        @media (max-width: 768px) {
            .nav-content {
                padding: 0 1rem;
            }
            
            .nav-tabs {
                overflow-x: auto;
                -webkit-overflow-scrolling: touch;
            }
            
            .stats {
                grid-template-columns: 1fr 1fr;
            }
        }
    </style>
</head>
<body>
    <nav>
        <div class="nav-content">
            <div class="nav-brand">
                <i class="fas fa-music"></i>
                Lofi Studio
            </div>
            <div class="nav-tabs">
                <button class="nav-tab active" onclick="switchTab('step1')">
                    <span class="step-badge">1</span>
                    Upload
                </button>
                <button class="nav-tab" onclick="switchTab('step2')">
                    <span class="step-badge">2</span>
                    Visuals
                </button>
                <button class="nav-tab" onclick="switchTab('step3')">
                    <span class="step-badge">3</span>
                    Create Release
                </button>
                <button class="nav-tab" onclick="switchTab('step4')">
                    <span class="step-badge">4</span>
                    Publish
                </button>
            </div>
        </div>
    </nav>

    <main class="container">
        <!-- Step 1: Upload Music -->
        <div id="step1" class="tab-content active" x-data="songsApp()">
            <div class="alert alert-info">
                <h3 style="margin-bottom: 0.5rem;">📤 Step 1: Upload Your Music</h3>
                <p>Upload your lofi tracks. Name them descriptively for best results.</p>
            </div>

            <div class="stats">
                <div class="stat-card">
                    <div class="stat-value" x-text="songs.length"></div>
                    <div class="stat-label">Total Tracks</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" x-text="songs.filter(s => s.status === 'approved').length"></div>
                    <div class="stat-label">Approved</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" x-text="songs.filter(s => !s.status || s.status === 'pending').length"></div>
                    <div class="stat-label">Pending</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" x-text="songs.filter(s => s.status === 'rejected').length"></div>
                    <div class="stat-label">Rejected</div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Music Library</h2>
                    <div class="flex gap-2">
                        <button class="btn btn-secondary" @click="loadSongs()">
                            <i class="fas fa-refresh"></i>
                            Refresh
                        </button>
                        <button class="btn btn-secondary" x-show="songs.length > 0" @click="approveAll()">
                            <i class="fas fa-check-double"></i>
                            Approve All
                        </button>
                        <input type="file" id="file-input" multiple accept="audio/*" style="display: none;" @change="uploadFiles($event)">
                        <button class="btn btn-primary" onclick="document.getElementById('file-input').click()">
                            <i class="fas fa-upload"></i>
                            Upload Songs
                        </button>
                        <button class="btn btn-secondary" @click="syncAIMusic()" :disabled="isSyncing">
                            <span x-show="!isSyncing">
                                <i class="fas fa-sync"></i> Sync AI Music
                            </span>
                            <span x-show="isSyncing">
                                <span class="loading"></span> Syncing...
                            </span>
                        </button>
                    </div>
                </div>

                <div class="table-container">
                    <table>
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
                                        <audio controls :src="song.url" preload="none"></audio>
                                    </td>
                                    <td>
                                        <span class="status-badge" :class="'status-' + (song.status || 'pending')">
                                            <span x-show="song.status !== 'generating'" x-text="song.status || 'pending'"></span>
                                            <span x-show="song.status === 'generating'">
                                                <span class="loading" style="width: 0.75rem; height: 0.75rem; margin-right: 0.25rem;"></span>
                                                generating
                                            </span>
                                        </span>
                                    </td>
                                    <td>
                                        <button class="btn btn-success btn-sm" @click="updateStatus(song.id, 'approved')" x-show="song.status !== 'approved'">
                                            <i class="fas fa-check"></i>
                                            Approve
                                        </button>
                                        <button class="btn btn-danger btn-sm" @click="updateStatus(song.id, 'rejected')" x-show="song.status !== 'rejected'">
                                            <i class="fas fa-times"></i>
                                            Reject
                                        </button>
                                    </td>
                                </tr>
                            </template>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- AI Music Generation -->
            <div class="card mt-4">
                <div class="card-header">
                    <h2 class="card-title">
                        <i class="fas fa-robot"></i> Generate Music with AI
                    </h2>
                    <span class="text-muted">Powered by Udio AI</span>
                </div>
                
                <div class="form-group">
                            <label class="form-label">Generation Mode</label>
                            <select class="form-control" x-model="musicGen.mode" @change="musicGen.customMode = $event.target.value === 'custom'">
                                <option value="inspiration">Inspiration Mode (Quick)</option>
                                <option value="custom">Custom Mode (Precise)</option>
                            </select>
                            <p class="text-muted" style="font-size: 0.8125rem; margin-top: 0.25rem;">
                                <strong>Inspiration:</strong> Quick generation with AI choosing title<br>
                                <strong>Custom:</strong> Full control over title, prompt, and tags
                            </p>
                        </div>

                        <div class="form-group">
                            <label class="form-label">AI Model</label>
                            <select class="form-control" x-model="musicGen.model">
                                <option value="chirp-v4-5">Chirp v4.5 (Latest)</option>
                                <option value="chirp-v4-0">Chirp v4.0</option>
                                <option value="chirp-v3-5">Chirp v3.5</option>
                            </select>
                            <p class="text-muted" style="font-size: 0.8125rem; margin-top: 0.25rem;">
                                Newer models produce higher quality music
                            </p>
                        </div>

                        <div class="form-group">
                            <label class="form-label">
                                <input type="checkbox" x-model="musicGen.instrumental" checked>
                                Instrumental Only
                            </label>
                            <p class="text-muted" style="font-size: 0.8125rem; margin-top: 0.25rem;">
                                Remove vocals for pure instrumental tracks (recommended for lofi)
                            </p>
                        </div>

                        <!-- Inspiration Mode -->
                        <div x-show="musicGen.mode === 'inspiration'">
                            <div class="form-group">
                                <label class="form-label">Describe the music you want</label>
                                <textarea class="form-control" x-model="musicGen.prompt" 
                                          placeholder="lofi, jazzy, relaxing, calm, 90s hip hop"
                                          rows="3"></textarea>
                                <p class="text-muted" style="font-size: 0.8125rem; margin-top: 0.5rem;">
                                    <strong>Tips:</strong> Describe mood, style, and instruments<br>
                                    <strong>Examples:</strong> "lofi hip hop with vinyl crackle", "jazzy piano beats", "ambient study music"<br>
                                    AI will generate a title based on your description
                                </p>
                            </div>
                        </div>

                        <!-- Custom Mode -->
                        <div x-show="musicGen.mode === 'custom'">
                            <div class="form-group">
                                <label class="form-label">Title (max 5 words)</label>
                                <input type="text" class="form-control" x-model="musicGen.title" 
                                       placeholder="Midnight Coffee Vibes">
                                <p class="text-muted" style="font-size: 0.8125rem; margin-top: 0.25rem;">
                                    The track name that will appear in your library<br>
                                    <strong>Examples:</strong> "Rainy Day Dreams", "Tokyo Sunset", "Study Session"
                                </p>
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label">Detailed Prompt</label>
                                <textarea class="form-control" x-model="musicGen.prompt" 
                                          placeholder="A relaxing lofi hip hop beat with jazzy piano chords, vinyl crackle, and soft drums"
                                          rows="3"></textarea>
                                <p class="text-muted" style="font-size: 0.8125rem; margin-top: 0.5rem;">
                                    Be specific about instruments, tempo, and mood<br>
                                    <strong>Good:</strong> "Slow tempo lofi beat with warm piano, soft brushed drums, vinyl texture"<br>
                                    <strong>Better:</strong> "90 BPM lofi hip hop with Rhodes piano, muted trumpet, rain sounds"
                                </p>
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label">Tags (comma-separated, 3-5 tags)</label>
                                <input type="text" class="form-control" x-model="musicGen.tags" 
                                       placeholder="lofi, jazz, chill, study, relaxing">
                                <p class="text-muted" style="font-size: 0.8125rem; margin-top: 0.5rem;">
                                    Guide the AI with style and mood keywords<br>
                                    <strong>Style:</strong> lofi, jazz, ambient, boom bap, chillhop<br>
                                    <strong>Mood:</strong> relaxing, nostalgic, dreamy, melancholic<br>
                                    <strong>Use:</strong> study, sleep, focus, meditation
                                </p>
                            </div>
                        </div>
                
                <button class="btn btn-primary" @click="generateMusic()" style="margin-top: 1rem; display: block;"
                                :disabled="musicGen.isGenerating">
                            <span x-show="!musicGen.isGenerating">
                                <i class="fas fa-music"></i> Generate Music
                            </span>
                            <span x-show="musicGen.isGenerating">
                                <span class="loading"></span> Generating...
                            </span>
                </button>
                
                <!-- Debug: Check specific work ID -->
                <div x-show="songs.some(s => s.status === 'generating')" style="margin-top: 1rem; padding: 0.75rem; background: var(--bg); border: 1px solid var(--border); border-radius: 0.5rem;">
                    <p style="font-size: 0.8125rem; margin-bottom: 0.5rem; color: var(--text-muted);">
                        <strong>Stuck generation?</strong> Check status manually:
                    </p>
                    <div style="display: flex; gap: 0.5rem;">
                        <input type="text" class="form-control" x-model="debugWorkId" 
                               placeholder="Work ID (e.g. c349f672-8d05-4785-ae04-001d66943142)" 
                               style="flex: 1; font-size: 0.8125rem;">
                        <button class="btn btn-secondary btn-sm" @click="checkDebugWorkId()">
                            Check Status
                        </button>
                    </div>
                </div>
            </div>

            <div class="alert alert-success mt-4" x-show="songs.filter(s => s.status === 'approved').length > 0">
                <h4>✅ Ready for Next Step!</h4>
                <p>You have <strong x-text="songs.filter(s => s.status === 'approved').length"></strong> approved tracks.</p>
                <button class="btn btn-primary" onclick="switchTab('step2')">
                    Continue to Create Visuals →
                </button>
            </div>
        </div>

        <!-- Step 2: Create Visuals -->
        <div id="step2" class="tab-content" x-data="artworkApp()">
            <div class="alert alert-info">
                <h3 style="margin-bottom: 0.5rem;">🎨 Step 2: Create Visual Content</h3>
                <p>Generate album artwork and convert them into seamless video loops.</p>
            </div>

            <div class="grid grid-2">
                <div class="card">
                    <h3 class="card-title">Generate Artwork</h3>
                    
                    <div class="form-group">
                        <label class="form-label">AI Model</label>
                        <select class="form-control" x-model="selectedModel">
                            <option value="fal-ai/flux-pro/v1.1-ultra">FLUX Pro Ultra (Best Quality)</option>
                            <option value="fal-ai/flux/dev">FLUX Dev (Fast)</option>
                            <option value="fal-ai/flux/schnell">FLUX Schnell (Fastest)</option>
                            <option value="fal-ai/stable-diffusion-xl">Stable Diffusion XL</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Describe your album cover</label>
                        <textarea class="form-control" x-model="prompt" placeholder="lofi aesthetic, cozy room, warm lighting, vinyl player"></textarea>
                    </div>

                    <button class="btn btn-primary" @click="generateArtwork()" :disabled="!prompt || isGenerating">
                        <span x-show="!isGenerating">
                            <i class="fas fa-magic"></i> Generate All Formats
                        </span>
                        <span x-show="isGenerating">
                            <span class="loading"></span> Generating 3 formats...
                        </span>
                    </button>
                    <p class="text-muted" style="font-size: 0.8125rem; margin-top: 0.5rem;">
                        Automatically generates: Album (1:1), YouTube (16:9), TikTok (9:16)
                    </p>
                </div>

                <div class="card">
                    <h3 class="card-title">Generated Artwork</h3>
                    <div x-show="!generatedImages || generatedImages.length === 0" class="text-center text-muted">
                        <i class="fas fa-image" style="font-size: 3rem; opacity: 0.3;"></i>
                        <p>No artwork generated yet</p>
                    </div>
                    <div x-show="generatedImages && generatedImages.length > 0" class="space-y-2">
                        <template x-for="img in generatedImages" :key="img.url">
                            <div style="margin-bottom: 1rem;">
                                <h4 style="font-size: 0.875rem; margin-bottom: 0.5rem; text-transform: capitalize;">
                                    <span x-text="img.label"></span> 
                                    <span class="text-muted" x-text="'(' + img.aspectRatio + ')'"></span>
                                </h4>
                                <img :src="img.url" style="width: 100%; border-radius: 0.5rem; border: 1px solid var(--border);">
                            </div>
                        </template>
                    </div>
                </div>
            </div>

            <div class="card mt-4" x-show="artworkHistory.length > 0">
                <h3 class="card-title">Recent Artwork Sets</h3>
                <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                    <template x-for="(artSet, index) in artworkHistory.slice(0, 3)" :key="artSet.timestamp">
                        <div style="border: 1px solid var(--border); border-radius: 0.5rem; padding: 1rem;">
                            <p class="text-muted" style="font-size: 0.875rem; margin-bottom: 0.75rem;" x-text="artSet.prompt"></p>
                            <div class="grid grid-3" style="gap: 0.5rem;">
                                <template x-for="img in artSet.images" :key="img.url">
                                    <div @click="selectArtworkSet(artSet)" style="cursor: pointer;">
                                        <p style="font-size: 0.75rem; text-align: center; margin-bottom: 0.25rem;" x-text="img.label"></p>
                                        <img :src="img.url" style="width: 100%; border-radius: 0.25rem; border: 1px solid var(--border);">
                                    </div>
                                </template>
                            </div>
                        </div>
                    </template>
                </div>
            </div>

            <div class="alert alert-success mt-4" x-show="artworkHistory.length > 0">
                <h4>✅ Visuals Ready!</h4>
                <p>Continue to create your release.</p>
                <button class="btn btn-primary" onclick="switchTab('step3')">
                    Continue to Create Release →
                </button>
            </div>
        </div>

        <!-- Step 3: Create Release -->
        <div id="step3" class="tab-content" x-data="releaseApp()">
            <div class="alert alert-info">
                <h3 style="margin-bottom: 0.5rem;">💿 Step 3: Create Your Release</h3>
                <p>Package your tracks into a release that can be published everywhere - streaming platforms, YouTube, and social media.</p>
            </div>

            <div class="grid grid-2">
                <div class="card">
                    <h3 class="card-title">Release Information</h3>
                    <div class="form-group">
                        <label class="form-label">Release Title</label>
                        <input type="text" class="form-control" x-model="release.title" 
                               placeholder="lofi hip hop radio - beats to relax/study to">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Artist Name</label>
                        <input type="text" class="form-control" x-model="release.artist" 
                               placeholder="Your Artist Name">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Description</label>
                        <textarea class="form-control" x-model="release.description" rows="3"
                                  placeholder="Lofi hip hop beats perfect for studying, working, or relaxing..."></textarea>
                    </div>
                </div>

                <div class="card">
                    <h3 class="card-title">Release Overview</h3>
                    <div class="stats">
                        <div class="stat-card">
                            <div class="stat-value" x-text="selectedSongs.length"></div>
                            <div class="stat-label">Tracks</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value" x-text="formatDuration(totalDuration)"></div>
                            <div class="stat-label">Duration</div>
                        </div>
                    </div>
                    <div class="progress">
                        <div class="progress-bar" :style="'width: ' + Math.min(100, (totalDuration / 3600 * 100)) + '%'"></div>
                    </div>
                    <p class="text-muted text-center mt-2">
                        <span x-text="Math.round(totalDuration / 60)"></span> minutes
                    </p>
                </div>
            </div>

            <!-- Track Selection -->
            <div class="card mt-4">
                <div class="card-header">
                    <h3 class="card-title">Select Tracks</h3>
                    <button class="btn btn-secondary btn-sm" @click="selectAll($event.target)">
                        <i class="fas fa-check-square"></i> Select All
                    </button>
                </div>
                <div class="table-container">
                    <table>
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
                                        <input type="checkbox" @change="toggleSong(song)" 
                                               :checked="selectedSongs.some(s => s.id === song.id)">
                                    </td>
                                    <td x-text="song.name"></td>
                                    <td x-text="formatDuration(song.duration || 120)"></td>
                                    <td>
                                        <span x-show="selectedSongs.some(s => s.id === song.id)" 
                                              class="status-badge status-approved"
                                              x-text="selectedSongs.findIndex(s => s.id === song.id) + 1">
                                        </span>
                                    </td>
                                </tr>
                            </template>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Visual Selection -->
            <div class="grid grid-2 mt-4">
                <div class="card">
                    <h3 class="card-title">Select Artwork</h3>
                    <p class="text-muted">Choose artwork for your release</p>
                    <div style="display: flex; flex-direction: column; gap: 1rem;">
                        <template x-for="artSet in artworkHistory" :key="artSet.timestamp">
                            <div style="border: 1px solid var(--border); border-radius: 0.5rem; padding: 0.75rem;"
                                 :style="selectedArtworkSet && selectedArtworkSet.timestamp === artSet.timestamp ? 'border-color: var(--primary);' : ''">
                                <p class="text-muted" style="font-size: 0.8125rem; margin-bottom: 0.5rem;" x-text="artSet.prompt"></p>
                                <div class="grid grid-3" style="gap: 0.25rem;">
                                    <template x-for="img in artSet.images" :key="img.url">
                                        <div @click="selectArtworkSet(artSet)" style="cursor: pointer; position: relative;">
                                            <img :src="img.url" style="width: 100%; border-radius: 0.25rem;">
                                            <span style="position: absolute; bottom: 2px; left: 2px; background: rgba(0,0,0,0.7); color: white; padding: 2px 4px; border-radius: 2px; font-size: 0.625rem;" x-text="img.label"></span>
                                        </div>
                                    </template>
                                </div>
                            </div>
                        </template>
                    </div>
                    <p x-show="!artworkHistory.length" class="text-muted text-center">
                        No artwork available. Go back to Step 2 to generate some.
                    </p>
                </div>

                <div class="card">
                    <h3 class="card-title">Video Loop (Optional)</h3>
                    <p class="text-muted">For YouTube/TikTok releases</p>
                    <div x-show="!release.createVideoLoop" class="text-center">
                        <button class="btn btn-secondary" @click="release.createVideoLoop = true">
                            <i class="fas fa-video"></i> Add Video Loop
                        </button>
                    </div>
                    <div x-show="release.createVideoLoop">
                        <div class="form-group">
                            <label class="form-label">Loop Duration (seconds)</label>
                            <input type="range" class="form-control" min="2" max="5" step="0.5" 
                                   x-model="release.loopDuration">
                            <p class="text-center text-muted" x-text="release.loopDuration + ' seconds'"></p>
                        </div>
                        <button class="btn btn-primary" @click="generateVideoLoop()" 
                                :disabled="!release.artworkUrl || isGeneratingLoop">
                            <span x-show="!isGeneratingLoop">Generate Loop</span>
                            <span x-show="isGeneratingLoop">
                                <span class="loading"></span> Generating...
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Create Release Button -->
            <div class="text-center mt-4">
                <button class="btn btn-primary btn-lg" @click="createRelease()" 
                        :disabled="selectedSongs.length === 0 || !release.title || !release.artist || isCreating">
                    <i class="fas fa-compact-disc"></i>
                    Create Release (<span x-text="formatDuration(totalDuration)"></span>)
                </button>
                <p class="text-muted mt-2" x-show="!release.title || !release.artist">
                    Please fill in all release information
                </p>
            </div>

            <div class="alert alert-success mt-4" x-show="releases.length > 0">
                <h4>✅ Release Created!</h4>
                <p>Your release is ready to publish to all platforms.</p>
                <button class="btn btn-primary" onclick="switchTab('step4')">
                    Continue to Publish →
                </button>
            </div>
        </div>

        <!-- Step 4: Publish -->
        <div id="step4" class="tab-content">
            <div class="alert alert-info">
                <h3 style="margin-bottom: 0.5rem;">🚀 Step 4: Publish Your Release</h3>
                <p>Your release is ready! Publish it to streaming platforms, YouTube, and social media.</p>
            </div>

            <div class="grid grid-3">
                <div class="card">
                    <h3 class="card-title">
                        <i class="fas fa-music"></i> DistroKid
                    </h3>
                    <p>Release your album on all streaming platforms.</p>
                    <ul style="margin: 1rem 0; padding-left: 1.5rem;">
                        <li>1 album with all tracks</li>
                        <li>Album artwork (1:1)</li>
                        <li>Global distribution</li>
                    </ul>
                    <pre style="background: var(--bg-tertiary); padding: 0.75rem; border-radius: 0.5rem; font-size: 0.8125rem;">cd /Users/jeremycai/Projects/lofi-music/musikai
./musikai publish --config ../configs/publish.yaml</pre>
                </div>

                <div class="card">
                    <h3 class="card-title">
                        <i class="fab fa-youtube" style="color: #ff0000;"></i> YouTube
                    </h3>
                    <p>Upload your compilation video.</p>
                    <ul style="margin: 1rem 0; padding-left: 1.5rem;">
                        <li>Single compilation video</li>
                        <li>Looping visuals</li>
                        <li>Timestamps in description</li>
                    </ul>
                    <button class="btn btn-danger">
                        Upload to YouTube
                    </button>
                </div>

                <div class="card">
                    <h3 class="card-title">
                        <i class="fab fa-tiktok"></i> TikTok
                    </h3>
                    <p>Create a short preview for social media.</p>
                    <ul style="margin: 1rem 0; padding-left: 1.5rem;">
                        <li>30-60 second preview</li>
                        <li>Vertical format (9:16)</li>
                        <li>Link to full video</li>
                    </ul>
                    <button class="btn btn-secondary">
                        Create TikTok Preview
                    </button>
                </div>
            </div>
        </div>
    </main>

    <script>
        // Tab switching
        function switchTab(tabId) {
            // Update nav tabs
            document.querySelectorAll('.nav-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            event.target.closest('.nav-tab').classList.add('active');
            
            // Update content
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(tabId).classList.add('active');
        }

        // Alpine.js components
        document.addEventListener('alpine:init', () => {
            Alpine.store('artworkHistory', []);
        });

        function songsApp() {
            return {
                songs: [],
                isSyncing: false,
                debugWorkId: '',
                musicGen: {
                    mode: 'inspiration',
                    customMode: false,
                    model: 'chirp-v4-5',
                    instrumental: true,
                    prompt: 'lofi, jazzy, relaxing, calm, 90s hip hop',
                    title: '',
                    tags: '',
                    isGenerating: false,
                    workId: null,
                    status: null,
                    generatedTracks: [],
                    pollInterval: null,
                    debugInfo: {},
                    rawData: null
                },
                
                async init() {
                    await this.loadSongs();
                },
                
                async loadSongs() {
                    try {
                        const response = await fetch('/api/songs');
                        if (!response.ok) {
                            console.error('Failed to load songs:', response.status);
                            return;
                        }
                        const songs = await response.json();
                        this.songs = songs;
                        console.log('Loaded songs:', songs.length);
                    } catch (error) {
                        console.error('Error loading songs:', error);
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
                    await fetch('/api/songs/' + id, {
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
                },
                
                async generateMusic() {
                    if (this.musicGen.isGenerating) return;
                    
                    this.musicGen.isGenerating = true;
                    this.musicGen.status = null;
                    this.musicGen.generatedTracks = [];
                    
                    try {
                        const requestBody = {
                            prompt: this.musicGen.prompt,
                            instrumental: this.musicGen.instrumental,
                            model: this.musicGen.model,
                            customMode: this.musicGen.mode === 'custom'
                        };
                        
                        if (this.musicGen.mode === 'custom') {
                            requestBody.title = this.musicGen.title;
                            requestBody.tags = this.musicGen.tags;
                        }
                        
                        const response = await fetch('/api/generate-music', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(requestBody)
                        });
                        
                        const data = await response.json();
                        if (data.success) {
                            this.musicGen.workId = data.workId;
                            
                            // Store work ID in localStorage for sync
                            const workIds = JSON.parse(localStorage.getItem('aiMusicWorkIds') || '[]');
                            workIds.push(data.workId);
                            localStorage.setItem('aiMusicWorkIds', JSON.stringify(workIds));
                            
                            // Immediately refresh the songs list to show the placeholder
                            await this.loadSongs();
                            
                            // Start polling after 10 seconds
                            setTimeout(() => this.pollMusicStatus(), 10000);
                        } else {
                            alert('Error: ' + (data.error || 'Failed to start generation'));
                            this.musicGen.isGenerating = false;
                        }
                    } catch (error) {
                        alert('Error: ' + error.message);
                        this.musicGen.isGenerating = false;
                    }
                },
                
                async pollMusicStatus() {
                    if (!this.musicGen.workId) return;
                    
                    try {
                        const response = await fetch('/api/generate-music-status?workId=' + this.musicGen.workId);
                        const data = await response.json();
                        
                        if (data.success) {
                            this.musicGen.status = data.status;
                            
                            // Store debug info for display
                            this.musicGen.debugInfo = data.debug || {};
                            this.musicGen.rawData = data.rawData;
                            
                            // Check if any tracks were saved (regardless of status)
                            if (data.tracks && data.tracks.length > 0) {
                                this.musicGen.generatedTracks = data.tracks;
                                this.musicGen.isGenerating = false;
                                await this.loadSongs(); // Refresh song list
                                console.log('Tracks saved:', data.tracks.length);
                                
                                // Clear work ID after a delay
                                setTimeout(() => {
                                    this.musicGen.workId = null;
                                    this.musicGen.status = null;
                                }, 5000);
                            } else if (data.status === 'IN_PROGRESS' || data.status === 'PROCESSING') {
                                // Continue polling
                                console.log('Still processing, polling again in 30s...');
                                setTimeout(() => this.pollMusicStatus(), 30000);
                            } else if (data.status === 'SUCCESS' || data.status === 'COMPLETED') {
                                // Generation completed but no tracks found
                                console.error('Generation completed but no tracks saved. Check logs.');
                                console.log('Raw data:', data.rawData);
                                this.musicGen.isGenerating = false;
                                
                                // Update any placeholder to failed status
                                await this.updatePlaceholderStatus('failed');
                            } else {
                                // Unknown status
                                console.log('Unknown status:', data.status);
                                setTimeout(() => this.pollMusicStatus(), 30000);
                            }
                        }
                    } catch (error) {
                        console.error('Polling error:', error);
                        // Retry polling after 30 seconds
                        setTimeout(() => this.pollMusicStatus(), 30000);
                    }
},
                
                async syncAIMusic() {
                    this.isSyncing = true;
                    try {
                        // First, let's check localStorage for any work IDs we've generated
                        const storedWorkIds = JSON.parse(localStorage.getItem('aiMusicWorkIds') || '[]');
                        console.log('Work IDs from localStorage:', storedWorkIds);
                        
                        const response = await fetch('/api/sync-ai-music', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ workIds: storedWorkIds })
                        });
                        
                        const data = await response.json();
                        console.log('Sync response:', data);
                        
                        if (data.success) {
                            await this.loadSongs();
                            alert(data.message || 'Sync complete!');
                            if (data.checkedWorkIds) {
                                console.log('Checked work IDs:', data.checkedWorkIds);
                            }
                        } else {
                            alert('Sync issue: ' + (data.error || data.message || 'Check console for details'));
                            if (data.debug) {
                                console.log('Debug info:', data.debug);
                            }
                        }
                    } catch (error) {
                        alert('Sync error: ' + error.message);
                    }
                    this.isSyncing = false;
                },
                
                async updatePlaceholderStatus(newStatus) {
                    // Find and update any generating placeholders for this work ID
                    const placeholders = this.songs.filter(s => 
                        s.status === 'generating' && 
                        s.metadata && 
                        JSON.parse(s.metadata).workId === this.musicGen.workId
                    );
                    
                    for (const placeholder of placeholders) {
                        await fetch('/api/songs/' + placeholder.id, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: newStatus })
                        });
                    }
                    
                    await this.loadSongs();
                },
                
                async checkDebugWorkId() {
                    if (!this.debugWorkId) return;
                    
                    try {
                        const response = await fetch('/api/generate-music-status?workId=' + this.debugWorkId);
                        const data = await response.json();
                        
                        console.log('Debug check result:', data);
                        
                        if (data.tracks && data.tracks.length > 0) {
                            await this.loadSongs();
                            alert('Found ' + data.tracks.length + ' tracks! Check your library.');
                        } else {
                            alert('Status: ' + (data.status || 'Unknown') + '\n\nCheck console for details.');
                        }
                    } catch (error) {
                        alert('Error: ' + error.message);
                    }
                }
            };
        }

        function artworkApp() {
            return {
                prompt: '',
                isGenerating: false,
                generatedUrl: '',
                generatedImages: [],
                artworkHistory: [],
                selectedModel: 'fal-ai/flux-pro/v1.1-ultra',
                modelParams: {},
                
                async generateArtwork() {
                    if (!this.prompt || this.isGenerating) return;
                    
                    this.isGenerating = true;
                    this.generatedImages = [];
                    
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
                        if (data.success && data.images) {
                            this.generatedImages = data.images;
                            // Set the album cover as the primary generated URL for backward compatibility
                            this.generatedUrl = data.url;
                            
                            // Add all generated images to history
                            const historyEntry = {
                                url: data.url,
                                images: data.images,
                                prompt: this.prompt,
                                timestamp: Date.now()
                            };
                            
                            this.artworkHistory.unshift(historyEntry);
                            if (this.artworkHistory.length > 12) {
                                this.artworkHistory = this.artworkHistory.slice(0, 12);
                            }
                            Alpine.store('artworkHistory', this.artworkHistory);
                        } else if (data.error) {
                            alert('Error: ' + data.error);
                        }
                    } catch (error) {
                        alert('Error: ' + error.message);
                    }
                    this.isGenerating = false;
                },
                
                selectArtworkSet(artSet) {
                    this.generatedImages = artSet.images;
                    this.generatedUrl = artSet.url;
                    // Trigger visual feedback
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            };
        }

        function releaseApp() {
            return {
                release: {
                    title: '',
                    artist: '',
                    description: 'Lofi hip hop beats perfect for studying, relaxing, or just chilling.',
                    artworkUrl: '',
                    createVideoLoop: false,
                    loopDuration: 3,
                    videoLoopId: null
                },
                approvedSongs: [],
                selectedSongs: [],
                totalDuration: 0,
                isCreating: false,
                isGeneratingLoop: false,
                releases: [],
                artworkHistory: [],
                selectedArtworkSet: null,
                
                async init() {
                    // Load approved songs
                    const response = await fetch('/api/songs');
                    const allSongs = await response.json();
                    this.approvedSongs = allSongs.filter(s => s.status === 'approved');
                    
                    // Load artwork history from Alpine store
                    this.artworkHistory = Alpine.store('artworkHistory') || [];
                    
                    // Load existing releases
                    const releasesResponse = await fetch('/api/compilations');
                    this.releases = await releasesResponse.json();
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
                
                selectArtworkSet(artSet) {
                    this.selectedArtworkSet = artSet;
                    this.release.artworkUrl = artSet.url; // Use album cover URL for backward compatibility
                    // Store all artwork URLs for later use
                    this.release.artworkSet = artSet;
                },
                
                calculateDuration() {
                    this.totalDuration = this.selectedSongs.reduce((total, song) => {
                        return total + (song.duration || 120);
                    }, 0);
                },
                
                formatDuration(seconds) {
                    const minutes = Math.floor(seconds / 60);
                    const secs = seconds % 60;
                    return minutes + ':' + secs.toString().padStart(2, '0');
                },
                
                async generateVideoLoop() {
                    if (!this.release.artworkUrl || this.isGeneratingLoop) return;
                    
                    this.isGeneratingLoop = true;
                    try {
                        const response = await fetch('/api/video', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                imageUrl: this.release.artworkUrl,
                                createLoop: true,
                                name: this.release.title + ' - Loop',
                                model: 'fal-ai/stable-video',
                                params: {
                                    duration: this.release.loopDuration,
                                    fps: 24,
                                    loop: true
                                }
                            })
                        });
                        
                        const data = await response.json();
                        if (data.success) {
                            this.release.videoLoopId = data.id;
                            alert('Video loop generated successfully!');
                        }
                    } catch (error) {
                        alert('Error generating video loop: ' + error.message);
                    }
                    this.isGeneratingLoop = false;
                },
                
                async createRelease() {
                    if (this.selectedSongs.length === 0 || !this.release.title || !this.release.artist) return;
                    
                    this.isCreating = true;
                    try {
                        const response = await fetch('/api/compilations', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                title: this.release.title,
                                description: this.release.description,
                                artist: this.release.artist,
                                songs: this.selectedSongs,
                                videoLoopId: this.release.videoLoopId,
                                thumbnailId: this.release.artworkUrl
                            })
                        });
                        
                        const data = await response.json();
                        if (data.success) {
                            this.releases.push(data);
                            alert('Release created successfully! Total duration: ' + this.formatDuration(data.totalDuration));
                        }
                    } catch (error) {
                        alert('Error creating release: ' + error.message);
                    }
                    this.isCreating = false;
                }
            };
        }
    </script>
</body>
</html>`;
}