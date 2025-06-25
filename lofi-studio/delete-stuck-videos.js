// Delete stuck test videos
async function deleteStuckVideos() {
  try {
    // Video IDs that are stuck in "generating" status
    const stuckVideoIds = [
      'c1dac432-3cef-4a0a-9592-495981ddda71',
      'e49835dc-961f-4845-b1d1-7b324c3d9da7',
      'bb5fee81-477e-4250-bae2-603c5c9e9162',
      'e22b4d83-2350-4024-911a-762cd2edc5f7'
    ];
    
    console.log('Deleting stuck videos...\n');
    
    for (const videoId of stuckVideoIds) {
      console.log(`Deleting video ${videoId}...`);
      
      const response = await fetch(`https://lofi-studio.botnet-599.workers.dev/api/videos/${videoId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        console.log(`✓ Successfully deleted ${videoId}`);
      } else {
        const error = await response.text();
        console.log(`✗ Failed to delete ${videoId}: ${error}`);
      }
    }
    
    console.log('\nChecking remaining videos...');
    const videosResponse = await fetch('https://lofi-studio.botnet-599.workers.dev/api/videos');
    const videos = await videosResponse.json();
    
    console.log(`\nRemaining videos: ${videos.length}`);
    const stillStuck = videos.filter(v => v.status === 'generating');
    console.log(`Videos still stuck: ${stillStuck.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

deleteStuckVideos();