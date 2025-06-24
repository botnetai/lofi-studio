#!/usr/bin/env python3
"""
Generate lofi music using GoAPI.ai
"""

import urllib.request
import urllib.parse
import urllib.error
import json
import time
import sys
import os
from datetime import datetime

API_KEY = "c3ba91c7503bb8b8d3c4e6f41292af00e910a8e1067b6d20c4a2661017c9e7da"
API_BASE_URL = "https://api.goapi.ai/api/udio/v1"

# Lofi music prompts
LOFI_PROMPTS = [
    {
        "title": "Midnight Study",
        "prompt": "chill lofi hip hop beat perfect for late night studying, mellow piano melody, soft vinyl crackle, gentle rain sounds",
        "tags": "lofi, study, chill, instrumental"
    },
    {
        "title": "Coffee Shop",
        "prompt": "warm jazzy lofi beat with cafe ambience, soft saxophone, brushed drums, cozy atmosphere",
        "tags": "lofi, jazz, cafe, relaxing"
    },
    {
        "title": "Rainy Window",
        "prompt": "melancholic lofi track with rain sounds, nostalgic piano chords, soft beats, contemplative mood",
        "tags": "lofi, rain, melancholic, ambient"
    },
    {
        "title": "Tokyo Nights",
        "prompt": "japanese-inspired lofi beat with koto samples, city sounds, neon atmosphere, chill hop rhythm",
        "tags": "lofi, japanese, urban, chill"
    },
    {
        "title": "Sunset Drive",
        "prompt": "smooth lofi beat for driving, warm bass line, dreamy guitar, golden hour vibes",
        "tags": "lofi, driving, sunset, smooth"
    }
]

def create_task(prompt_data):
    """Create a music generation task"""
    headers = {
        "X-API-Key": API_KEY,
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    # GoAPI uses a different format
    payload = {
        "custom_mode": True,
        "prompt": prompt_data["prompt"],
        "title": prompt_data["title"],
        "tags": prompt_data["tags"],
        "make_instrumental": True
    }
    
    print(f"\n📝 Creating task: {prompt_data['title']}")
    print(f"   Prompt: {prompt_data['prompt'][:80]}...")
    
    try:
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            f"{API_BASE_URL}/music-generation",
            data=data,
            headers=headers
        )
        
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))
            
        if result.get("success"):
            task_id = result.get("data", {}).get("task_id")
            print(f"✅ Task created! ID: {task_id}")
            return task_id
        else:
            print(f"❌ Error: {result.get('message', 'Unknown error')}")
            return None
            
    except urllib.error.HTTPError as e:
        print(f"❌ HTTP Error {e.code}: {e.reason}")
        try:
            error_data = json.loads(e.read().decode('utf-8'))
            print(f"   Error details: {error_data}")
        except:
            pass
        return None
    except urllib.error.URLError as e:
        print(f"❌ Request failed: {e}")
        return None

def check_task(task_id):
    """Check the status of a generation task"""
    headers = {
        "X-API-Key": API_KEY,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    try:
        url = f"{API_BASE_URL}/tasks/{task_id}"
        req = urllib.request.Request(url, headers=headers)
        
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            
        return data
        
    except urllib.error.URLError as e:
        print(f"❌ Status check failed: {e}")
        return None

def wait_for_completion(task_id, max_wait=300):
    """Wait for generation to complete"""
    print(f"\n⏳ Waiting for generation to complete...")
    
    # Initial wait
    time.sleep(10)
    
    start_time = time.time()
    while time.time() - start_time < max_wait:
        result = check_task(task_id)
        
        if result and result.get("success"):
            data = result.get("data", {})
            status = data.get("status")
            
            if status == "completed":
                output = data.get("output", {})
                tracks = output.get("audio_urls", [])
                
                if tracks:
                    print(f"✅ Generation completed! Got {len(tracks)} tracks")
                    return tracks
                else:
                    print(f"⏳ Generation in progress...")
            
            elif status == "failed":
                print(f"❌ Generation failed: {data.get('error', 'Unknown error')}")
                return None
        
        # Wait before next check
        time.sleep(30)
    
    print(f"❌ Timeout: Generation took longer than {max_wait} seconds")
    return None

def download_track(track_url, track_num, title, output_dir):
    """Download a generated track"""
    filename = f"{title}_{track_num}.mp3"
    filepath = os.path.join(output_dir, filename)
    
    print(f"📥 Downloading: {filename}")
    
    try:
        with urllib.request.urlopen(track_url) as response:
            with open(filepath, 'wb') as f:
                f.write(response.read())
        
        print(f"✅ Saved to: {filepath}")
        return filepath
        
    except urllib.error.URLError as e:
        print(f"❌ Download failed: {e}")
        return None

def main():
    # Create output directory
    output_dir = "/Users/jeremycai/Projects/lofi-music/generated"
    os.makedirs(output_dir, exist_ok=True)
    
    print("🎵 GoAPI Lofi Music Generator")
    print(f"📁 Output directory: {output_dir}")
    
    # Generate tracks
    for i, prompt_data in enumerate(LOFI_PROMPTS[:1]):  # Start with just one
        print(f"\n{'='*60}")
        print(f"Track {i+1}/{len(LOFI_PROMPTS)}")
        
        # Create task
        task_id = create_task(prompt_data)
        if not task_id:
            continue
        
        # Wait for completion
        tracks = wait_for_completion(task_id)
        if not tracks:
            continue
        
        # Download tracks
        print(f"\n📥 Downloading {len(tracks)} tracks...")
        title = prompt_data["title"].replace(" ", "_")
        for j, track_url in enumerate(tracks):
            download_track(track_url, j+1, title, output_dir)
        
        # Brief pause between generations
        if i < len(LOFI_PROMPTS) - 1:
            print("\n⏸️  Pausing before next generation...")
            time.sleep(10)
    
    print(f"\n✅ All done! Check {output_dir} for your lofi tracks")

if __name__ == "__main__":
    main()