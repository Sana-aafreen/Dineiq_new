"""
Startup initialization for Render deployment.
This file MUST be imported before any other application modules.
It decodes Base64 credentials from environment variables before any code tries to use them.
"""

import os

# Decode Base64 credentials if deploying to Render
# This MUST happen before any imports that use the JSON files
if os.getenv("SERVICE_ACCOUNT_JSON_BASE64"):
    try:
        from utilities.credentials import setup_credentials
        print("🔧 Decoding Base64 credentials for Render deployment...")
        setup_credentials()
        print("✅ Credentials decoded successfully")
    except Exception as e:
        print(f"❌ ERROR: Could not decode Base64 credentials: {e}")
        print("⚠️  Application may fail if it needs these credentials")
        # Don't raise - let the app try to start anyway
