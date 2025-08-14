#!/usr/bin/env python3
"""
Test script for Supabase Edge Function integration
This script tests the new API client functionality with your Supabase Edge Functions

Before running this script:
1. Set your environment variables:
   - SUPABASE_URL=https://rpgpwailndlmpgufmfzi.supabase.co
   - SUPABASE_KEY=your_supabase_anon_key (store anon key in SUPABASE_KEY)
2. Ensure your Supabase Edge Functions are deployed and running
3. Update the test data with actual values from your database

Note: SUPABASE_KEY should contain your anon key value, not the service role key!
"""

import asyncio
import logging
import os
from dotenv import load_dotenv
from api_client import SurveyAPIClient, cleanup_api_client

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

async def test_api_connection():
    """Test basic API connection"""
    logger.info("Testing API connection...")
    
    try:
        client = SurveyAPIClient()
        session = await client._get_session()
        logger.info("✅ API client session created successfully")
        await client.close()
        return True
    except Exception as e:
        logger.error(f"❌ Failed to create API client session: {e}")
        return False

async def test_campaign_details():
    """Test getting campaign details"""
    logger.info("Testing campaign details retrieval...")
    
    try:
        client = SurveyAPIClient()
        
        # Test with sample campaign URI and token
        # Replace these with actual values from your Supabase project
        campaign_uri = "default"  # or your actual campaign URI
        link_token = "test-token-123"  # or your actual link token
        
        try:
            campaign_data = await client.get_campaign_details(campaign_uri, link_token)
            logger.info(f"✅ Retrieved campaign data: {campaign_data}")
            return True
        except Exception as e:
            logger.warning(f"⚠️  Campaign details test failed (expected if API not running): {e}")
            return False
        finally:
            await client.close()
            
    except Exception as e:
        logger.error(f"❌ Failed to test campaign details: {e}")
        return False

async def test_submission_creation():
    """Test creating a submission"""
    logger.info("Testing submission creation...")
    
    try:
        client = SurveyAPIClient()
        
        # Test data
        test_data = {
            "campaign_id": 1,  # Replace with actual campaign ID from your database
            "link_token": "test-token-123",
            "link_type": "generic",
            "room_name": "test-room-123",
            "s3_recording_url": None
        }
        
        try:
            response = await client.create_submission(**test_data)
            logger.info(f"✅ Created submission: {response}")
            return True
        except Exception as e:
            logger.warning(f"⚠️  Submission creation test failed (expected if API not running): {e}")
            return False
        finally:
            await client.close()
            
    except Exception as e:
        logger.error(f"❌ Failed to test submission creation: {e}")
        return False

async def test_answer_submission():
    """Test submitting answers"""
    logger.info("Testing answer submission...")
    
    try:
        client = SurveyAPIClient()
        
        # Test data
        submission_id = "test-submission-id"  # Replace with actual submission ID
        answers = [
            {
                "question_id": 1,  # Replace with actual question IDs from your database
                "answer_text": "Test answer 1"
            },
            {
                "question_id": 2,  # Replace with actual question IDs from your database
                "answer_text": "Test answer 2"
            }
        ]
        
        try:
            response = await client.submit_answers(submission_id, answers)
            logger.info(f"✅ Submitted answers: {response}")
            return True
        except Exception as e:
            logger.warning(f"⚠️  Answer submission test failed (expected if API not running): {e}")
            return False
        finally:
            await client.close()
            
    except Exception as e:
        logger.error(f"❌ Failed to test answer submission: {e}")
        return False

async def test_environment_configuration():
    """Test environment configuration"""
    logger.info("Testing environment configuration...")
    
    supabase_url = os.getenv("SUPABASE_URL")
    api_key = os.getenv("SUPABASE_KEY")  # Use SUPABASE_KEY for anon key
    
    logger.info(f"SUPABASE_URL: {supabase_url}")
    logger.info(f"SUPABASE_KEY (contains anon key): {'Set' if api_key else 'Not set'}")
    
    if not supabase_url:
        logger.error("❌ SUPABASE_URL not set")
        return False
    
    if not api_key:
        logger.error("❌ SUPABASE_KEY not set (should contain anon key)")
        return False
    
    # Construct the API base URL
    api_base_url = f"{supabase_url}/functions/v1/survey-api"
    logger.info(f"Constructed API_BASE_URL: {api_base_url}")
    
    logger.info("✅ Environment configuration looks good")
    return True

async def main():
    """Run all tests"""
    logger.info("Starting API integration tests...")
    
    tests = [
        ("Environment Configuration", test_environment_configuration),
        ("API Connection", test_api_connection),
        ("Campaign Details", test_campaign_details),
        ("Submission Creation", test_submission_creation),
        ("Answer Submission", test_answer_submission),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        logger.info(f"\n--- Running {test_name} Test ---")
        try:
            result = await test_func()
            results.append((test_name, result))
        except Exception as e:
            logger.error(f"❌ {test_name} test failed with exception: {e}")
            results.append((test_name, False))
    
    # Summary
    logger.info("\n" + "="*50)
    logger.info("TEST SUMMARY")
    logger.info("="*50)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        logger.info(f"{test_name}: {status}")
        if result:
            passed += 1
    
    logger.info(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        logger.info("🎉 All tests passed! API integration is ready.")
    else:
        logger.warning("⚠️  Some tests failed. Check your API configuration.")
    
    # Cleanup
    await cleanup_api_client()

if __name__ == "__main__":
    asyncio.run(main())
