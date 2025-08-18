// Test sync video generation to see errors
async function testSyncGeneration() {
  try {
    // First check debug info for a stuck video
    const debugResponse = await fetch('https://lofi-studio.botnet-599.workers.dev/api/debug/video/e49835dc-961f-4845-b1d1-7b324c3d9da7');
    const debugInfo = await debugResponse.json();
    console.log('Video debug info:', JSON.stringify(debugInfo, null, 2));
    
    // Now try to generate it synchronously
    console.log('\nTrying sync generation...');
    const response = await fetch('https://lofi-studio.botnet-599.workers.dev/api/test/generate-video-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId: 'e49835dc-961f-4845-b1d1-7b324c3d9da7'
      })
    });
    
    const result = await response.json();
    console.log('\nSync generation result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

testSyncGeneration();