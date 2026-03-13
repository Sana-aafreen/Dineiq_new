# test_sync.py
from agents.menu import MenuAgent
import os
from dotenv import load_dotenv

load_dotenv()

def test_sync():
    print("🚀 Starting Menu Sync Test (v2 Revision)...")
    agent = MenuAgent()
    try:
        result = agent.sync_external_menu()
        print("\n✅ Sync Result:")
        print(result)
    except Exception as e:
        print(f"\n❌ Sync Failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_sync()
