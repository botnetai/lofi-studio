// Test video generation with debug output
async function testVideoGenerationDebug() {
  try {
    // Get artwork first
    const artworkResponse = await fetch('https://lofi-studio.botnet-599.workers.dev/api/artwork');
    const artworks = await artworkResponse.json();
    
    if (artworks.length === 0) {
      console.log('No artwork found.');
      return;
    }
    
    const artwork = artworks[0];
    console.log('Using artwork ID:', artwork.id);
    
    // Generate video
    console.log('\nGenerating video...');
    const videoResponse = await fetch('https://lofi-studio.botnet-599.workers.dev/api/video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageId: artwork.id,
        prompt: 'test debug video generation',
        model: 'kling-2.1',
        duration: 5,
        mode: 'standard',
        enableLoop: true
      })
    });
    
    const result = await videoResponse.json();
    console.log('Response:', JSON.stringify(result, null, 2));
    
    if (result.videoId) {
      // Check video status immediately
      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const videosResponse = await fetch('https://lofi-studio.botnet-599.workers.dev/api/videos');
        const videos = await videosResponse.json();
        
        const video = videos.find(v => v.id === result.videoId);
        if (video) {
          console.log(`\nCheck ${i + 1}: Status = ${video.status}, URL = ${video.url || 'empty'}`);
          if (video.status === 'completed') {
            console.log('Video completed!');
            break;
          }
        }
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testVideoGenerationDebug();