async function testVideoGeneration() {
  // First, get an artwork ID
  const artworkResponse = await fetch('https://lofi-studio.botnet-599.workers.dev/api/artwork');
  const artworks = await artworkResponse.json();
  
  if (artworks.length === 0) {
    console.log('No artwork found. Please generate some artwork first.');
    return;
  }
  
  const artworkId = artworks[0].id;
  console.log('Using artwork ID:', artworkId);
  
  // Generate a video
  console.log('Generating video...');
  const videoResponse = await fetch('https://lofi-studio.botnet-599.workers.dev/api/video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageId: artworkId,
      prompt: 'slow motion, cinematic',
      model: 'kling-2.1',
      duration: 5,
      mode: 'standard',
      enableLoop: false
    })
  });
  
  const result = await videoResponse.json();
  console.log('Video generation result:', result);
  
  // Wait a bit then check videos
  console.log('Waiting 5 seconds then checking videos...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  const videosResponse = await fetch('https://lofi-studio.botnet-599.workers.dev/api/videos');
  const videos = await videosResponse.json();
  console.log('Videos in database:', videos);
}

testVideoGeneration().catch(console.error);