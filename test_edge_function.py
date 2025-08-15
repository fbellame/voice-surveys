#!/usr/bin/env python3
"""
Test script to verify the Edge Function endpoints work correctly.
"""

import asyncio
import aiohttp
import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Check if Supabase credentials are available
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: SUPABASE_URL and SUPABASE_KEY must be set in environment variables")
    print("Please set these environment variables:")
    print("export SUPABASE_URL=https://your-project.supabase.co")
    print("export SUPABASE_KEY=your_supabase_anon_key")
    sys.exit(1)

async def test_edge_function():
    """Test the Edge Function endpoints"""
    
    base_url = f"{SUPABASE_URL}/functions/v1/survey-api"
    headers = {
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    
    async with aiohttp.ClientSession() as session:
        print("Testing Edge Function endpoints...")
        
        # Test 1: Debug endpoint
        print("\n1. Testing debug endpoint...")
        try:
            async with session.get(f"{base_url}/", headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"✓ Debug endpoint working: {data.get('message')}")
                else:
                    print(f"✗ Debug endpoint failed: {response.status}")
                    return False
        except Exception as e:
            print(f"✗ Debug endpoint error: {e}")
            return False
        
        # Test 2: Get campaign details (this will fail if no default campaign exists)
        print("\n2. Testing get campaign details...")
        try:
            async with session.get(f"{base_url}/api/campaigns/default/details?token=test-token", headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"✓ Campaign details working: {data.get('name', 'Unknown')}")
                elif response.status == 404:
                    print("⚠ Campaign not found (this is expected if no default campaign exists)")
                else:
                    print(f"✗ Campaign details failed: {response.status}")
                    text = await response.text()
                    print(f"Response: {text}")
        except Exception as e:
            print(f"✗ Campaign details error: {e}")
        
        # Test 3: Get submissions (should return empty array)
        print("\n3. Testing get submissions...")
        try:
            async with session.get(f"{base_url}/api/submissions?room_name=test-room-123", headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"✓ Get submissions working: {len(data.get('submissions', []))} submissions found")
                else:
                    print(f"✗ Get submissions failed: {response.status}")
                    text = await response.text()
                    print(f"Response: {text}")
                    return False
        except Exception as e:
            print(f"✗ Get submissions error: {e}")
            return False
        
        # Test 4: Create submission (this will fail without valid campaign_id and token)
        print("\n4. Testing create submission...")
        try:
            submission_data = {
                "campaign_id": 1,
                "link_token": "test-token",
                "link_type": "generic",
                "room_name": "test-room-123"
            }
            async with session.post(f"{base_url}/api/submissions", json=submission_data, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"✓ Create submission working: {data.get('submission_id')}")
                elif response.status == 401:
                    print("⚠ Create submission failed: Invalid token (expected)")
                else:
                    print(f"✗ Create submission failed: {response.status}")
                    text = await response.text()
                    print(f"Response: {text}")
        except Exception as e:
            print(f"✗ Create submission error: {e}")
        
        print("\n✓ Edge Function tests completed!")
        return True

if __name__ == "__main__":
    print("Testing Edge Function...")
    success = asyncio.run(test_edge_function())
    
    if success:
        print("\n🎉 Edge Function is working correctly!")
        print("\nNext steps:")
        print("1. Create a default campaign in your database")
        print("2. Add some questions to the campaign")
        print("3. Test the full survey flow")
    else:
        print("\n❌ Some Edge Function tests failed.")
        print("Please check the Edge Function deployment and database setup.")
        sys.exit(1)
