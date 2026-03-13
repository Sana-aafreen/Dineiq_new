# DineIQ\Backend\services\dependencies.py

# ---------------------------------------------------------
# Centralized Singleton Registry
# ---------------------------------------------------------
# All shared service instances are created ONCE here at
# startup and reused across every agent/router.
#
# Usage in any agent:
#   from services.dependencies import sheets, gemini_chatbot, gemini_menu
# ---------------------------------------------------------

import os
from dotenv import load_dotenv

load_dotenv()

from services.sheets import SheetsClient
from services.llm import GeminiClient

# ----------------------------------------------------------
# 1. Google Sheets — single connection for the whole app
# ----------------------------------------------------------
sheets = SheetsClient(spreadsheet_id=os.getenv("SPREADSHEET_ID"))

# ----------------------------------------------------------
# 2. Gemini Clients — one per API key, mapped by use-case
#
#    ┌──────────────────────────┬────────────────────────────────────────────┐
#    │ Singleton                │ Use-cases                                  │
#    ├──────────────────────────┼────────────────────────────────────────────┤
#    │ gemini_menu              │ Menu ranking + menu sync (sync_external)   │
#    │ gemini_chatbot           │ Customer-facing chatbot responses           │
#    │ gemini_chat_inf          │ Chat-based customer insight inference       │
#    │ gemini_dietary           │ Dietary preference inference                │
#    │ gemini_common            │ Combo generation + add-on AI pitch          │
#    └──────────────────────────┴────────────────────────────────────────────┘
#
#    All keys must be set in .env:
#      GEMINI_API_KEY_MENU
#      GEMINI_API_KEY_CHATBOT
#      GEMINI_API_KEY_CHAT_INSIGHTS
#      GEMINI_API_KEY_DIETARY_INSIGHTS
#      GEMINI_API_KEY_COMMON
# ----------------------------------------------------------
gemini_menu      = GeminiClient(api_key=os.getenv("GEMINI_API_KEY_MENU"))
gemini_chatbot   = GeminiClient(api_key=os.getenv("GEMINI_API_KEY_CHATBOT"))
gemini_chat_inf  = GeminiClient(api_key=os.getenv("GEMINI_API_KEY_CHAT_INSIGHTS"))
gemini_dietary   = GeminiClient(api_key=os.getenv("GEMINI_API_KEY_DIETARY_INSIGHTS"))
gemini_common    = GeminiClient(api_key=os.getenv("GEMINI_API_KEY_COMMON"))
