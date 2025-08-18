// Test video generation after fixing videoId bug
async function testVideoFixed() {
  try {
    // Get artwork
    const artworkResponse = await fetch('https://lofi-studio.botnet-599.workers.dev/api/artwork');
    const artworks = await artworkResponse.json();
    
    const artwork = artworks[0];
    console.log('Using artwork:', artwork.id);
    
    // Generate video with sync mode for immediate testing
    console.log('\nGenerating video in sync mode...');
    const syncResponse = await fetch('https://lofi-studio.botnet-599.workers.dev/api/video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageId: artwork.id,
        prompt: 'FIXED TEST ' + new Date().toISOString(),
        model: 'kling-2.1',
        duration: 5,
        mode: 'standard',
        enableLoop: true,
        async: false // Sync mode for testing
      })
    });
    
    const syncResult = await syncResponse.json();
    console.log('Sync result:', JSON.stringify(syncResult, null, 2));
    
    if (syncResult.videoId) {
      // Check the video
      const debugResponse = await fetch(`https://lofi-studio.botnet-599.workers.dev/api/debug/video/${syncResult.videoId}`);
      const debugInfo = await debugResponse.json();
      console.log('\nVideo info:', JSON.stringify(debugInfo, null, 2));
    }
    
    // Also test async mode
    console.log('\n\nNow testing async mode...');
    const asyncResponse = await fetch('https://lofi-studio.botnet-599.workers.dev/api/video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageId: artwork.id,
        prompt: 'ASYNC TEST ' + new Date().toISOString(),
        model: 'kling-2.1',
        duration: 5,
        mode: 'standard',
        enableLoop: true,
        async: true
      })
    });
    
    const asyncResult = await asyncResponse.json();
    console.log('Async result:', JSON.stringify(asyncResult, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testVideoFixed();