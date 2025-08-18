#!/usr/bin/env node

// Test script for Fal.ai Kling API
// Usage: FAL_KEY=your-key-here node test-fal-kling.js

const FAL_KEY = process.env.FAL_KEY;

if (!FAL_KEY) {
  console.error('Please set FAL_KEY environment variable');
  process.exit(1);
}

async function testKlingAPI() {
  // Test image URL (you should replace with a real image)
  const testImageUrl = 'https://images.unsplash.com/photo-1536599018102-9f803c140fc1?w=640&h=640&fit=crop';
  
  console.log('Testing Fal.ai Kling Video Generation API...\n');
  
  // Test different endpoints
  const endpoints = [
    {
      name: 'Kling 2.1 Standard (without queue)',
      url: 'https://fal.run/fal-ai/kling-video/v2.1/standard/image-to-video',
      body: {
        prompt: 'smooth camera movement, cinematic',
        image_url: testImageUrl,
        duration: '5'
      }
    },
    {
      name: 'Kling 2.1 Standard (with queue)',
      url: 'https://queue.fal.run/fal-ai/kling-video/v2.1/standard/image-to-video',
      body: {
        prompt: 'smooth camera movement, cinematic',
        image_url: testImageUrl,
        duration: '5'
      }
    },
    {
      name: 'Kling 1.6 Pro',
      url: 'https://queue.fal.run/fal-ai/kling-video/v1.6/pro/image-to-video',
      body: {
        prompt: 'smooth camera movement, cinematic',
        image_url: testImageUrl,
        duration: '5',
        cfg_scale: 0.5
      }
    }
  ];
  
  for (const endpoint of endpoints) {
    console.log(`\nTesting: ${endpoint.name}`);
    console.log(`URL: ${endpoint.url}`);
    console.log(`Body:`, JSON.stringify(endpoint.body, null, 2));
    
    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${FAL_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(endpoint.body)
      });
      
      console.log(`Status: ${response.status} ${response.statusText}`);
      
      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
        console.log('Response:', JSON.stringify(data, null, 2));
      } catch (e) {
        console.log('Response (raw):', responseText);
      }
      
      if (response.ok && data) {
        // If we got a queue response, show how to poll
        if (data.request_id && data.status_url) {
          console.log('\nQueue response received!');
          console.log('Request ID:', data.request_id);
          console.log('Status URL:', data.status_url);
          console.log('\nTo check status, use:');
          console.log(`curl -H "Authorization: Key ${FAL_KEY}" "${data.status_url}"`);
        }
      }
      
    } catch (error) {
      console.error(`Error: ${error.message}`);
    }
    
    console.log('\n' + '-'.repeat(80));
  }
}

testKlingAPI();