# =======================
# Configuration File
# =======================
# from dotenv import load_dotenv
# import os

# Load .env file
# load_dotenv()

# --- Batching & Rate Limiting ---
BATCH_SIZE = 5
REQUEST_DELAY = 2        # seconds between calls
MAX_RETRIES = 3
RETRY_DELAY = 5          # seconds before retry
