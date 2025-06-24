// Test script to check video insertion
async function testVideoInsert() {
  try {
    // Test the video generation endpoint with minimal data
    const response = await fetch('https://lofi-studio.botnet-599.workers.dev/api/test-video-insert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        test: true
      })
    });
    
    const result = await response.json();
    console.log('Test insert result:', result);
    
    // Now check if it's in the database
    const videosResponse = await fetch('https://lofi-studio.botnet-599.workers.dev/api/videos');
    const videos = await videosResponse.json();
    console.log('Videos in database:', videos);
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testVideoInsert();