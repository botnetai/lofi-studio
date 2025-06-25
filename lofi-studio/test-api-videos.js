// Test the videos API endpoint
async function testVideosAPI() {
  try {
    const response = await fetch('https://lofi-studio.botnet-599.workers.dev/api/videos');
    const videos = await response.json();
    console.log('Videos API response:');
    console.log(JSON.stringify(videos, null, 2));
    console.log('\nTotal videos:', videos.length);
    
    if (videos.length > 0) {
      console.log('\nFirst video:');
      console.log('- ID:', videos[0].id);
      console.log('- URL:', videos[0].url);
      console.log('- Status:', videos[0].status);
      console.log('- Created:', videos[0].created_at);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testVideosAPI();