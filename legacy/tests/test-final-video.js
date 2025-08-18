// Final test of video generation
async function testFinalVideo() {
  try {
    // Get artwork
    const artworkResponse = await fetch('https://lofi-studio.botnet-599.workers.dev/api/artwork');
    const artworks = await artworkResponse.json();
    
    console.log('Total artworks:', artworks.length);
    const artwork = artworks[0];
    console.log('Using artwork:', artwork.id);
    
    // Generate video
    console.log('\nGenerating video...');
    const videoResponse = await fetch('https://lofi-studio.botnet-599.workers.dev/api/video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageId: artwork.id,
        prompt: 'smooth cinematic camera movement, peaceful vibes',
        model: 'kling-2.1',
        duration: 5,
        mode: 'standard',
        enableLoop: true
      })
    });
    
    const result = await videoResponse.json();
    console.log('Result:', JSON.stringify(result, null, 2));
    
    if (result.videoId) {
      // Check videos list
      console.log('\nChecking videos list...');
      const videosResponse = await fetch('https://lofi-studio.botnet-599.workers.dev/api/videos');
      const videos = await videosResponse.json();
      
      const completedVideos = videos.filter(v => v.status === 'completed');
      console.log('Total videos:', videos.length);
      console.log('Completed videos:', completedVideos.length);
      
      const newVideo = videos.find(v => v.id === result.videoId);
      if (newVideo) {
        console.log('\nNew video details:');
        console.log('- ID:', newVideo.id);
        console.log('- Status:', newVideo.status);
        console.log('- URL:', newVideo.url);
        console.log('- Created:', new Date(newVideo.created_at).toLocaleString());
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testFinalVideo();