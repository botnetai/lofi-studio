#!/usr/bin/env node

// Simple test for Kling 1.6 API
// Usage: FAL_KEY=your-key-here node test-kling-1.6.js

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) {
  console.error('Please set FAL_KEY environment variable');
  process.exit(1);
}

async function testKling16() {
  const testImageUrl = 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=640&h=640&fit=crop';
  
  console.log('Testing Kling 1.6 Video Generation...\n');
  
  // Test both standard and pro modes
  const tests = [
    {
      name: 'Kling 1.6 Standard',
      endpoint: 'https://fal.run/fal-ai/kling-video/v1.6/standard/image-to-video'
    },
    {
      name: 'Kling 1.6 Pro',
      endpoint: 'https://fal.run/fal-ai/kling-video/v1.6/pro/image-to-video'
    }
  ];
  
  for (const test of tests) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${test.name}`);
    console.log(`Endpoint: ${test.endpoint}`);
    console.log('-'.repeat(60));
    
    const requestBody = {
      image_url: testImageUrl,
      prompt: 'smooth camera movement, cinematic',
      duration: '5',
      cfg_scale: 0.5,
      seed: 12345
    };
    
    console.log('Request Body:', JSON.stringify(requestBody, null, 2));
    
    try {
      const response = await fetch(test.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${FAL_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      console.log(`\nStatus: ${response.status} ${response.statusText}`);
      
      const responseText = await response.text();
      
      try {
        const data = JSON.parse(responseText);
        console.log('\nResponse:', JSON.stringify(data, null, 2));
        
        if (response.ok) {
          if (data.request_id) {
            console.log('\n✅ Success! Got queue response.');
            console.log('Request ID:', data.request_id);
            console.log('Status URL:', data.status_url);
            console.log('\nTo check status:');
            console.log(`curl -H "Authorization: Key ${FAL_KEY}" "${data.status_url}"`);
          } else {
            console.log('\n✅ Success! Got direct response.');
            console.log('Video URL:', data.video_url || data.url || data.output || 'Not found');
          }
        } else {
          console.log('\n❌ Request failed!');
          console.log('Error:', data.detail || data.error || data.message || 'Unknown error');
        }
      } catch (e) {
        console.log('\nRaw response:', responseText);
      }
      
    } catch (error) {
      console.error('\n❌ Network error:', error.message);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Test completed!');
}

testKling16();