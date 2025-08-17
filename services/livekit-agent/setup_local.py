#!/usr/bin/env python3
"""
Setup script for running the LiveKit agent locally with Supabase
"""
import os
import sys
from pathlib import Path

def create_env_file():
    """Create a .env file with local development settings"""
    env_content = """# Supabase Configuration (Local)
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0

# LiveKit Configuration
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret

# OpenAI Configuration (for TTS and LLM)
OPENAI_API_KEY=your_openai_api_key

# AWS S3 Configuration (for recording storage)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your_s3_bucket_name

# Deepgram Configuration (for STT)
DEEPGRAM_API_KEY=your_deepgram_api_key

# Optional: Twilio Configuration (if using phone calls)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
"""
    
    env_path = Path(".env")
    if env_path.exists():
        print("⚠️  .env file already exists. Backing up to .env.backup")
        env_path.rename(".env.backup")
    
    with open(".env", "w") as f:
        f.write(env_content)
    
    print("✅ Created .env file with local development settings")
    print("📝 Please edit the .env file and add your actual API keys")

def check_dependencies():
    """Check if required dependencies are installed"""
    try:
        import livekit.agents
        print("✅ LiveKit agents package is installed")
    except ImportError as e:
        print(f"❌ Missing LiveKit dependency: {e}")
        print("Run: pip install livekit-agents --no-deps")
        return False
    
    try:
        import aiohttp
        print("✅ aiohttp package is installed")
    except ImportError as e:
        print(f"❌ Missing aiohttp dependency: {e}")
        return False
    
    try:
        import boto3
        print("✅ boto3 package is installed")
    except ImportError as e:
        print(f"⚠️  boto3 not installed (optional for S3 recording): {e}")
    
    print("✅ Core dependencies are available")
    return True

def main():
    print("🚀 Setting up LiveKit Agent for local development")
    print("=" * 50)
    
    # Check dependencies
    if not check_dependencies():
        sys.exit(1)
    
    # Create .env file
    create_env_file()
    
    print("\n📋 Next steps:")
    print("1. Start Supabase locally: supabase start")
    print("2. Start LiveKit server locally")
    print("3. Edit .env file with your API keys")
    print("4. Run the agent: python main.py")
    
    print("\n🔧 Required services:")
    print("- Supabase (database + edge functions): http://127.0.0.1:54321")
    print("- LiveKit server: ws://localhost:7880")
    print("- Supabase Studio: http://127.0.0.1:54323")

if __name__ == "__main__":
    main()
