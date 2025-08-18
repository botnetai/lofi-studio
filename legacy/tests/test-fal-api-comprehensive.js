#!/usr/bin/env node

// Comprehensive test script for Fal.ai API
// Usage: FAL_KEY=your-key-here node test-fal-api-comprehensive.js

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) {
  console.error('Please set FAL_KEY environment variable');
  process.exit(1);
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testAPI(name, url, body) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing: ${name}`);
  console.log(`URL: ${url}`);
  console.log(`Body:`, JSON.stringify(body, null, 2));
  console.log('-'.repeat(80));
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
      console.log('Response:', JSON.stringify(data, null, 2));
    } catch (e) {
      console.log('Response (raw):', responseText.substring(0, 500));
    }
    
    if (response.ok && data) {
      // Check if it's a queue response
      if (data.request_id && data.status_url) {
        console.log('\n✅ Queue response received!');
        console.log('Request ID:', data.request_id);
        console.log('Status URL:', data.status_url);
        
        // Try to poll the status once
        console.log('\nPolling status...');
        const statusResponse = await fetch(data.status_url, {
          headers: {
            'Authorization': `Key ${FAL_KEY}`
          }
        });
        
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          console.log('Status check result:', JSON.stringify(statusData, null, 2));
        }
      } else if (data.images || data.video || data.url || data.output) {
        console.log('\n✅ Direct response received!');
        console.log('Output type:', data.images ? 'images' : data.video ? 'video' : 'other');
      } else {
        console.log('\n⚠️  Unexpected response format');
      }
    } else {
      console.log('\n❌ Request failed');
    }
    
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
  }
}

async function runTests() {
  console.log('Fal.ai API Comprehensive Test');
  console.log('FAL_KEY:', FAL_KEY.substring(0, 20) + '...');
  
  // Test image URL
  const testImageUrl = 'https://images.unsplash.com/photo-1536599018102-9f803c140fc1?w=640&h=640&fit=crop';
  
  // Test 1: Image Generation (Flux Schnell)
  await testAPI(
    'Image Generation - Flux Schnell',
    'https://fal.run/fal-ai/flux/schnell',
    {
      prompt: 'lofi anime aesthetic, album cover art, high quality, detailed',
      image_size: 'square_hd',
      num_images: 1,
      enable_safety_checker: true
    }
  );
  
  await delay(2000);
  
  // Test 2: Kling Video 2.1 Standard (non-queue)
  await testAPI(
    'Kling 2.1 Standard - Direct',
    'https://fal.run/fal-ai/kling-video/v2.1/standard/image-to-video',
    {
      prompt: 'smooth camera movement, cinematic',
      image_url: testImageUrl,
      duration: '5',
      cfg_scale: 0.5,
      negative_prompt: 'blur, distort, and low quality'
    }
  );
  
  await delay(2000);
  
  // Test 3: Try with sync_mode parameter
  await testAPI(
    'Kling 2.1 Standard - Sync Mode',
    'https://fal.run/fal-ai/kling-video/v2.1/standard/image-to-video',
    {
      prompt: 'smooth camera movement, cinematic',
      image_url: testImageUrl,
      duration: '5',
      cfg_scale: 0.5,
      negative_prompt: 'blur, distort, and low quality',
      sync_mode: true
    }
  );
  
  await delay(2000);
  
  // Test 4: Test with webhookUrl (forces queue mode)
  await testAPI(
    'Kling 2.1 Standard - With Webhook',
    'https://fal.run/fal-ai/kling-video/v2.1/standard/image-to-video',
    {
      prompt: 'smooth camera movement, cinematic',
      image_url: testImageUrl,
      duration: '5',
      cfg_scale: 0.5,
      negative_prompt: 'blur, distort, and low quality',
      webhookUrl: 'https://example.com/webhook'
    }
  );
  
  await delay(2000);
  
  // Test 5: Kling 1.6 Pro
  await testAPI(
    'Kling 1.6 Pro',
    'https://fal.run/fal-ai/kling-video/v1.6/pro/image-to-video',
    {
      prompt: 'smooth camera movement, cinematic',
      image_url: testImageUrl,
      duration: '5',
      cfg_scale: 0.5
    }
  );
  
  console.log('\n' + '='.repeat(80));
  console.log('Tests completed!');
  console.log('\nKey findings:');
  console.log('1. Check if endpoints return queue responses or direct responses');
  console.log('2. Some endpoints may require webhookUrl to trigger queue mode');
  console.log('3. sync_mode parameter might force synchronous responses');
  console.log('4. Different models may have different default behaviors');
}

runTests();