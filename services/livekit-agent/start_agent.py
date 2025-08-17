#!/usr/bin/env python3
"""
Startup script for the LiveKit agent
"""
import os
import sys
import asyncio
import logging
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def check_environment():
    """Check if required environment variables are set"""
    required_vars = [
        'SUPABASE_URL',
        'SUPABASE_KEY',
        'LIVEKIT_URL',
        'LIVEKIT_API_KEY',
        'LIVEKIT_API_SECRET',
        'OPENAI_API_KEY'
    ]
    
    missing_vars = []
    for var in required_vars:
        if not os.getenv(var) or os.getenv(var) == f'your_{var.lower()}':
            missing_vars.append(var)
    
    if missing_vars:
        logger.error(f"❌ Missing or unconfigured environment variables: {', '.join(missing_vars)}")
        logger.error("Please edit the .env file and add your actual API keys")
        return False
    
    logger.info("✅ Environment variables configured")
    return True

def check_supabase():
    """Check if Supabase is running"""
    import aiohttp
    import asyncio
    
    async def test_connection():
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{os.getenv('SUPABASE_URL')}/functions/v1/survey-api"
                headers = {"Authorization": f"Bearer {os.getenv('SUPABASE_KEY')}"}
                
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        return True
                    else:
                        logger.error(f"❌ Supabase edge function returned status {response.status}")
                        return False
        except Exception as e:
            logger.error(f"❌ Cannot connect to Supabase: {e}")
            return False
    
    try:
        result = asyncio.run(test_connection())
        if result:
            logger.info("✅ Supabase connection successful")
        return result
    except Exception as e:
        logger.error(f"❌ Error testing Supabase connection: {e}")
        return False

def main():
    """Main startup function"""
    logger.info("🚀 Starting LiveKit Agent Setup")
    logger.info("=" * 50)
    
    # Check environment
    if not check_environment():
        logger.error("❌ Environment not properly configured")
        sys.exit(1)
    
    # Check Supabase
    if not check_supabase():
        logger.error("❌ Supabase not accessible")
        logger.error("Make sure Supabase is running: supabase start")
        sys.exit(1)
    
    logger.info("✅ All checks passed!")
    logger.info("")
    logger.info("📋 Next steps:")
    logger.info("1. Make sure LiveKit server is running")
    logger.info("2. Run: python main.py")
    logger.info("")
    logger.info("🔧 To start LiveKit server locally:")
    logger.info("   livekit-server --dev")
    logger.info("")
    logger.info("🔧 Or use LiveKit Cloud:")
    logger.info("   - Sign up at https://cloud.livekit.io")
    logger.info("   - Update LIVEKIT_URL in .env file")

if __name__ == "__main__":
    main()
