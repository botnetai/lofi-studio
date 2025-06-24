#!/usr/bin/env python3
"""
Test UdioAPI.pro connection
"""

import urllib.request
import urllib.parse
import urllib.error
import json

API_KEY = "51bdc9d9-ba8f-45fa-a34c-d7d8aadc9a6a"
API_BASE_URL = "https://udioapi.pro/api"

def test_api():
    """Test the API with a simple request"""
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Try the simplest possible request - inspiration mode
    payload = {
        "gpt_description_prompt": "Create a chill lofi hip hop beat for studying",
        "make_instrumental": True,
        "model": "chirp-v3-5"
    }
    
    print(f"🔧 Testing UdioAPI...")
    print(f"📍 URL: {API_BASE_URL}/v2/generate")
    print(f"🔑 API Key: {API_KEY[:10]}...")
    print(f"📦 Payload: {json.dumps(payload, indent=2)}")
    
    try:
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            f"{API_BASE_URL}/v2/generate",
            data=data,
            headers=headers,
            method='POST'
        )
        
        print(f"\n📤 Sending request...")
        print(f"Headers: {headers}")
        
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))
            print(f"\n✅ Success! Response:")
            print(json.dumps(result, indent=2))
            return result
            
    except urllib.error.HTTPError as e:
        print(f"\n❌ HTTP Error {e.code}: {e.reason}")
        print(f"URL: {e.url}")
        print(f"Headers: {e.headers}")
        try:
            error_body = e.read().decode('utf-8')
            print(f"Response body: {error_body}")
            error_data = json.loads(error_body)
            print(f"Parsed error: {json.dumps(error_data, indent=2)}")
        except:
            pass
        return None
    except Exception as e:
        print(f"\n❌ Error: {type(e).__name__}: {e}")
        return None

if __name__ == "__main__":
    test_api()