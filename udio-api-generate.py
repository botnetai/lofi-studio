#!/usr/bin/env python3
"""
Generate lofi music using UdioAPI.pro
"""

import urllib.request
import urllib.parse
import urllib.error
import json
import time
import sys
import os
from datetime import datetime

API_KEY = "51bdc9d9-ba8f-45fa-a34c-d7d8aadc9a6a"
API_BASE_URL = "https://udioapi.pro/api"

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

def generate_music(prompt_data, model="chirp-v4-5"):
    """Generate music using custom mode"""
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    payload = {
        "prompt": prompt_data["prompt"],
        "title": prompt_data["title"],
        "tags": prompt_data["tags"],
        "make_instrumental": True,  # Lofi is typically instrumental
        "model": model
    }
    
    print(f"\n📝 Generating: {prompt_data['title']}")
    print(f"   Model: {model}")
    print(f"   Prompt: {prompt_data['prompt'][:80]}...")
    
    try:
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            f"{API_BASE_URL}/v2/generate",
            data=data,
            headers=headers
        )
        
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))
            
        if result.get("code") == 200:
            work_id = result.get("workId")
            print(f"✅ Generation started! Work ID: {work_id}")
            return work_id
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

def check_status(work_id):
    """Check the status of a generation job"""
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    try:
        url = f"{API_BASE_URL}/v2/feed?workId={work_id}"
        req = urllib.request.Request(url, headers=headers)
        
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            
        return data
        
    except urllib.error.URLError as e:
        print(f"❌ Status check failed: {e}")
        return None

def wait_for_completion(work_id, max_wait=300):
    """Wait for generation to complete"""
    print(f"\n⏳ Waiting for generation to complete...")
    
    # Initial wait
    time.sleep(10)
    
    start_time = time.time()
    while time.time() - start_time < max_wait:
        result = check_status(work_id)
        
        if result and result.get("code") == 200:
            data = result.get("data", {})
            status_type = data.get("type")
            
            if status_type == "SUCCESS":
                response_data = data.get("response_data", [])
                
                # Check if we have completed audio
                completed_tracks = []
                for track in response_data:
                    if track.get("audio_url") and track.get("duration"):
                        completed_tracks.append(track)
                
                if len(completed_tracks) >= 2:  # Udio typically generates 2 variations
                    print(f"✅ Generation completed! Got {len(completed_tracks)} tracks")
                    return completed_tracks
                else:
                    print(f"⏳ Generating audio... ({len(completed_tracks)}/2 tracks ready)")
            
            elif status_type == "FAILED":
                print(f"❌ Generation failed!")
                return None
        
        # Wait before next check
        time.sleep(30)
    
    print(f"❌ Timeout: Generation took longer than {max_wait} seconds")
    return None

def download_track(track, output_dir):
    """Download a generated track"""
    audio_url = track.get("audio_url")
    track_id = track.get("id")
    title = track.get("title", "untitled").replace(" ", "_")
    
    if not audio_url:
        print(f"❌ No audio URL for track {track_id}")
        return None
    
    filename = f"{title}_{track_id}.mp3"
    filepath = os.path.join(output_dir, filename)
    
    print(f"📥 Downloading: {filename}")
    
    try:
        with urllib.request.urlopen(audio_url) as response:
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
    
    print("🎵 Udio Lofi Music Generator")
    print(f"📁 Output directory: {output_dir}")
    
    # Select model
    model = "chirp-v4-5"  # Latest model
    
    # Generate tracks
    for i, prompt_data in enumerate(LOFI_PROMPTS[:1]):  # Start with just one
        print(f"\n{'='*60}")
        print(f"Track {i+1}/{len(LOFI_PROMPTS)}")
        
        # Generate music
        work_id = generate_music(prompt_data, model)
        if not work_id:
            continue
        
        # Wait for completion
        tracks = wait_for_completion(work_id)
        if not tracks:
            continue
        
        # Download tracks
        print(f"\n📥 Downloading {len(tracks)} tracks...")
        for track in tracks:
            download_track(track, output_dir)
        
        # Brief pause between generations
        if i < len(LOFI_PROMPTS) - 1:
            print("\n⏸️  Pausing before next generation...")
            time.sleep(10)
    
    print(f"\n✅ All done! Check {output_dir} for your lofi tracks")

if __name__ == "__main__":
    main()