// Test the video generation API endpoint
async function testVideoGeneration() {
  try {
    // First get an artwork to use for video generation
    const artworkResponse = await fetch('https://lofi-studio.botnet-599.workers.dev/api/artwork');
    const artworks = await artworkResponse.json();
    
    if (artworks.length === 0) {
      console.log('No artwork found. Please generate some artwork first.');
      return;
    }
    
    const firstArtwork = artworks[0];
    console.log('Using artwork:', firstArtwork.id);
    
    // Test video generation
    console.log('\nTesting video generation...');
    const videoResponse = await fetch('https://lofi-studio.botnet-599.workers.dev/api/video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        imageId: firstArtwork.id,
        prompt: 'smooth camera movement, cinematic',
        model: 'kling-2.1',
        duration: 5,
        mode: 'standard',
        enableLoop: true
      })
    });
    
    const videoResult = await videoResponse.json();
    console.log('Video generation response:', JSON.stringify(videoResult, null, 2));
    
    if (videoResult.videoId) {
      console.log('\nVideo generation started successfully!');
      console.log('Video ID:', videoResult.videoId);
      
      // Wait a moment then check videos
      console.log('\nWaiting 2 seconds before checking videos...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check videos list
      const videosResponse = await fetch('https://lofi-studio.botnet-599.workers.dev/api/videos');
      const videos = await videosResponse.json();
      
      console.log('\nTotal videos:', videos.length);
      
      // Find our video
      const ourVideo = videos.find(v => v.id === videoResult.videoId);
      if (ourVideo) {
        console.log('\nFound our video:');
        console.log('- ID:', ourVideo.id);
        console.log('- Status:', ourVideo.status);
        console.log('- URL:', ourVideo.url);
        console.log('- Created:', ourVideo.created_at);
        console.log('- Metadata:', JSON.parse(ourVideo.metadata || '{}'));
      } else {
        console.log('\nVideo not found in list yet. It may still be processing.');
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testVideoGeneration();