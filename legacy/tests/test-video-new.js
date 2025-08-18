// Generate a new video and monitor logs
async function testNewVideo() {
  try {
    const artworkResponse = await fetch('https://lofi-studio.botnet-599.workers.dev/api/artwork');
    const artworks = await artworkResponse.json();
    
    const artwork = artworks[0];
    console.log('Using artwork:', artwork.id);
    
    const response = await fetch('https://lofi-studio.botnet-599.workers.dev/api/video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageId: artwork.id,
        prompt: 'DEBUG TEST ' + new Date().toISOString(),
        model: 'kling-2.1',
        duration: 5,
        mode: 'standard',
        enableLoop: true
      })
    });
    
    const result = await response.json();
    console.log('Response:', result);
    console.log('\nVideo ID to monitor in logs:', result.videoId);
  } catch (error) {
    console.error('Error:', error);
  }
}

testNewVideo();