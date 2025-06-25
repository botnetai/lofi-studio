// Cleanup stuck test videos
async function cleanupStuckVideos() {
  try {
    // First, let's see what videos we have
    const response = await fetch('https://lofi-studio.botnet-599.workers.dev/api/videos');
    const videos = await response.json();
    
    console.log('Total videos:', videos.length);
    console.log('\nVideos by status:');
    
    const stuck = videos.filter(v => v.status === 'generating');
    const completed = videos.filter(v => v.status === 'completed');
    const failed = videos.filter(v => v.status === 'failed');
    
    console.log('- Generating (stuck):', stuck.length);
    console.log('- Completed:', completed.length);
    console.log('- Failed:', failed.length);
    
    if (stuck.length > 0) {
      console.log('\nStuck videos to be removed:');
      stuck.forEach(v => {
        const metadata = JSON.parse(v.metadata || '{}');
        const age = Math.floor((Date.now() - new Date(v.created_at).getTime()) / 1000 / 60);
        console.log(`- ID: ${v.id}`);
        console.log(`  Prompt: ${metadata.prompt || v.prompt}`);
        console.log(`  Age: ${age} minutes`);
        console.log(`  Created: ${v.created_at}`);
      });
      
      console.log('\nThese videos are stuck in "generating" status and should be removed.');
      console.log('To remove them, we need to add a delete endpoint to the API.');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

cleanupStuckVideos();