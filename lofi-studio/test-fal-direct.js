// Test Fal.ai API directly
const FAL_KEY = 'f5d1c93d-5364-4117-96f8-a33699e70eb0:4953396aac7b5bd14673003cea767c28';

async function testFalDirect() {
  try {
    console.log('Testing Fal.ai Kling video generation...\n');
    
    const response = await fetch('https://fal.run/fal-ai/kling-video/v2.1/standard/image-to-video', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image_url: 'https://lofi-studio.botnet-599.workers.dev/files/artwork/3175c096-6272-43b5-bd77-b4b9fd164752.png',
        prompt: 'smooth camera movement, cinematic',
        duration: '5',
        cfg_scale: 0.5,
        negative_prompt: 'blur, distort, and low quality',
        seed: 12345
      })
    });
    
    const responseText = await response.text();
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers));
    console.log('Response body:', responseText);
    
    if (response.ok) {
      const data = JSON.parse(responseText);
      console.log('\nParsed response:', JSON.stringify(data, null, 2));
      
      // If we got a queue response, show how to poll it
      if (data.request_id) {
        console.log('\nThis is a queued request. To poll for results:');
        console.log(`Status URL: ${data.status_url}`);
        console.log(`Request ID: ${data.request_id}`);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testFalDirect();