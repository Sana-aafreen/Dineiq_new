# DineIQ\Backend\agents\chatbot.py

# ---------------------------------------------------------
# Library and Packages Import
# ---------------------------------------------------------
import os
import re
import json
import asyncio
import time
from fastapi import APIRouter
from pydantic import BaseModel

# ---------------------------------------------------------
# SETUP KEYS
# ---------------------------------------------------------
from dotenv import load_dotenv

load_dotenv()

SPREADSHEET_ID = os.environ.get("SPREADSHEET_ID", "").strip()

# ---------------------------------------------------------
# Centralized Singletons
# ---------------------------------------------------------
from services.dependencies import sheets as sheets_client, groq_chatbot as groq_client

# ---------------------------------------------------------
# Menu Agent (singleton via menu.py)
# ---------------------------------------------------------
from agents.menu import get_menu_agent
menu_agent = get_menu_agent()

CHATS_SHEET = "Chats"
CUSTOMER_AUTH_SHEET = "Customer_Auth"

# ---------------------------------------------------------
# Router
# ---------------------------------------------------------
chatbot_router = APIRouter()

# ── Menu cache (avoids repeated Google Sheets round-trips) ───────────────────
_menu_cache: list[dict] = []
_menu_cache_ts: float   = 0.0
MENU_CACHE_TTL: int     = 300   # seconds (5 minutes)

def get_cached_menu() -> list[dict]:
    global _menu_cache, _menu_cache_ts
    if _menu_cache and (time.time() - _menu_cache_ts) < MENU_CACHE_TTL:
        print(f"Menu from cache ({len(_menu_cache)} items)")
        return _menu_cache
    print("Fetching fresh menu from Sheets...")
    _menu_cache    = menu_agent.get_menu()

    # Enrich the base menu_agent.get_menu() with isVeg for the chatbot filter
    # Main project menu.py doesn't have a direct _is_veg_item on the dictionary returned
    # so we will use the description to guess if it's missing
    for item in _menu_cache:
        if "isVeg" not in item:
            name_desc = (str(item.get("name", "")) + " " + str(item.get("description", ""))).lower()
            non_veg = ['chicken', 'mutton', 'fish', 'egg', 'meat', 'prawn', 'lamb', 'pork', 'beef']
            item["isVeg"] = not any(nv in name_desc for nv in non_veg)
            item["category"] = "General" # Safe default
            if "id" not in item:
                item["id"] = ""

    _menu_cache_ts = time.time()
    return _menu_cache

# ---------------------------------------------------------
# REQUEST / RESPONSE MODELS
# ---------------------------------------------------------
class FrontendChatItem(BaseModel):
    role: str
    text: str

class ComboIngredient(BaseModel):
    name: str
    price: float
    item_id: str = ""

class ComboData(BaseModel):
    id: str
    name: str
    items: list[ComboIngredient]
    totalPrice: float
    savings: float = 0.0

class ChatRequest(BaseModel):
    chatHistory: list[FrontendChatItem]
    userMessage: str
    clientName: str | None = "Guest"
    clientId: str | None = None
    clientEmail: str | None = None
    clientPhone: str | None = None

class ChatResponse(BaseModel):
    response: str
    combos: list[ComboData] = []   # ← structured combos for frontend cards

class ChatSession(BaseModel):
    clientId: str
    chatId: str
    clientName: str
    clientEmail: str
    clientPhone: str
    date: str
    time: str
    transcriptText: str

# ---------------------------------------------------------
# SYSTEM PROMPT
# ---------------------------------------------------------
SYSTEM_PROMPT = """You are Harvest by DineIQ, an elegant and warm AI concierge for a premium farm-to-table restaurant experience.

Your Objectives:
- Respond politely, warmly, and naturally.
- Always address the client by their name (if known).
- Maintain memory of previous chat messages.
- Tone: Helpful, welcoming, and knowledgeable. Use a few elegant emojis (🌿, 🥗, 🍲, 🥖).
- Provide accurate and helpful information based on the menu.
- Ask for Name, Email, or Phone if not yet provided, to help identify the customer.

Strict Rules for User Status:
1. LOGGED IN USER:
   - Address them by name immediately.
   - Treat them as a valued returning customer.
   - Do NOT ask them to LOGIN or SIGNUP.

2. RECOGNIZED BUT NOT LOGGED IN (Identified by Email/Phone):
   - Address them by name.
   - You MUST politely ask them to LOGIN to access their full profile and personalized offers.
   - Assure them that this chat IS being saved to their account.

3. GUEST (Unregistered):
   - ONLY if the user is not found in the database, politely suggest they SIGN UP.
   - Warn them strictly that "Chat history is NOT saved for guests".

General Rules:
1. ONLY mention items that appear in the MENU block. Never invent items or prices.
2. For vegan/veg queries: ONLY suggest [VEG] items.
3. Language: Use descriptive, appetizing, and sophisticated language. Focus on "freshness", "organic quality", and "local flavors".
4. Return ONLY the reply message (no JSON, no metadata).
5. Do NOT take orders (redirect to "Place Order" page).

For COMBO suggestions:
- Hand-pick 2–3 harmonious pairings and give them "Harvest" inspired names.
- List each included item with its price.
- Format each combo clearly separated by decorative lines.
"""

# ---------------------------------------------------------
# STEP 1 — INTENT CLASSIFIER (LLM-powered, no hardcoded keywords)
# ---------------------------------------------------------
INTENT_SYSTEM = """You are an intent classifier for a restaurant chatbot.

Given the user's latest message and recent chat history, return ONLY a valid JSON object like:
{
  "action": "suggest_items" | "suggest_combos" | "general",
  "filters": ["veg", "spicy", "dessert", "drinks", "starter"],
  "veg_only": true | false,
  "summary": "one sentence describing what the user wants"
}

Rules:
- action = "suggest_combos" → user wants a meal bundle / combo deal
- action = "suggest_items"  → user wants dish recommendations (even if they say "food", "spicy", "vegan", etc.)
- action = "general"        → greeting, reservation, complaints, or anything NOT about the menu
- filters: list of relevant keywords (category names, flavour tags, dietary tags)
- veg_only: true ONLY if user explicitly mentions veg/vegan/vegetarian
- Return ONLY raw JSON. No markdown. No explanation."""

def classify_intent(user_message: str, history: list[FrontendChatItem]) -> dict:
    """Use Groq to classify what the user wants — no hardcoded keywords."""
    recent = history[-4:] if len(history) > 4 else history
    history_text = "\n".join(
        f"{'User' if h.role == 'user' else 'Assistant'}: {h.text}" for h in recent
    )
    prompt = f"""{INTENT_SYSTEM}

Recent conversation:
{history_text}

Latest user message: {user_message}

JSON:"""

    raw = groq_client.call_groq_with_retry(prompt)
    print(f"Intent raw: {raw}")

    try:
        clean = re.sub(r"```(?:json)?", "", raw or "").strip().strip("`")
        return json.loads(clean)
    except Exception:
        return {"action": "general", "filters": [], "veg_only": False, "summary": user_message}

# ---------------------------------------------------------
# STEP 2 — TOOL: Fetch and filter menu
# ---------------------------------------------------------
def fetch_filtered_menu(filters: list[str], veg_only: bool) -> list[dict]:
    """Return filtered menu — from cache, Google Sheets only hit once per 5 min."""
    menu = get_cached_menu()

    # Drop zero-price items
    menu = [item for item in menu if item.get("price") and float(item.get("price", 0)) > 0]

    # Apply veg filter
    if veg_only:
        menu = [item for item in menu if item.get("isVeg")]

    # Apply category / keyword filters
    if filters:
        filter_lower = [f.lower() for f in filters]
        filtered = [
            item for item in menu
            if any(
                kw in item.get("name", "").lower() or kw in item.get("category", "").lower()
                for kw in filter_lower
            )
        ]
        menu = filtered if filtered else menu

    return menu

def format_menu_for_llm(menu: list[dict], max_items: int = 60) -> str:
    """Format menu list into a clean text block for the LLM prompt."""
    lines = []
    for item in menu[:max_items]:
        name     = item.get("name", "Unknown")
        price    = item.get("price", 0)
        category = item.get("category", "")
        veg      = "[VEG]" if item.get("isVeg") else "[NON-VEG]"
        lines.append(f"• {name} — KSh {price} {veg} [{category}]")
    return "\n".join(lines)

# ---------------------------------------------------------
# STRUCTURED COMBO GENERATOR — returns JSON for frontend cards
# ---------------------------------------------------------
COMBO_JSON_PROMPT = """
You are a menu combo builder for a premium restaurant in Kenya. All prices are in KSh.

Given the menu below, create 2-3 combo meals.
Return ONLY a valid JSON array, nothing else:
[
  {
    "id": "combo_1",
    "name": "Creative Combo Name",
    "items": [
      {"name": "Exact Item Name from Menu", "price": 350},
      {"name": "Another Item", "price": 200}
    ],
    "totalPrice": 550,
    "savings": 0
  }
]

RULES:
- Use ONLY items from the MENU. Do NOT invent items.
- totalPrice = sum of all item prices.
- Each combo should have 2-4 items.
- Give elegant, Harvest-inspired names like "Field & Forest Feast", "Bounty of the Valley".
- Return valid JSON array only, no markdown, no explanation.
"""

def generate_structured_combos(menu: list[dict], menu_text: str, user_request: str) -> list[dict]:
    """Ask Groq to return structured combo JSON from the real menu, then enrich with real Item_IDs."""
    prompt = f"{COMBO_JSON_PROMPT}\n\nUser requested: {user_request}\n\nMENU:\n{menu_text}\n\nJSON:"
    raw = groq_client.call_groq_with_retry(prompt)
    print(f"Raw combo JSON: {raw[:300] if raw else 'None'}...")

    # Build a name → {id, price} lookup from real menu for post-processing
    name_lookup: dict[str, dict] = {}
    for item in menu:
        clean = item.get("name", "").strip().lower()
        name_lookup[clean] = {"id": item.get("id", ""), "price": float(item.get("price") or 0)}

    def find_item(item_name: str) -> dict:
        """Fuzzy-match item name against real menu entries."""
        clean_name = re.sub(r"^\d+x?\s*|x?\d+\s*$", "", item_name).strip().lower()
        if clean_name in name_lookup:
            return name_lookup[clean_name]

        best_match = None
        max_len = 0
        for menu_key, info in name_lookup.items():
            if clean_name in menu_key or menu_key in clean_name:
                if len(menu_key) > max_len:
                    best_match = info
                    max_len = len(menu_key)

        if best_match:
            return best_match

        print(f"WARNING: Item ID lookup failed for: '{item_name}' (cleaned: '{clean_name}')")
        return {"id": "", "price": 0}

    try:
        clean = re.sub(r"```(?:json)?", "", raw or "").strip().strip("`")
        start = clean.find("[")
        end   = clean.rfind("]") + 1
        if start == -1 or end == 0:
            return []
        combos = json.loads(clean[start:end])

        # Enrich each ingredient with real item_id and real price from Sheets
        for combo in combos:
            enriched_items = []
            total = 0.0
            for ing in combo.get("items", []):
                info = find_item(ing.get("name", ""))
                real_price = info["price"] if info["price"] > 0 else float(ing.get("price", 0))
                item_id    = info["id"] or ""
                enriched_items.append({
                    "name":    ing.get("name"),
                    "price":   real_price,
                    "item_id": item_id,
                })
                total += real_price
            combo["items"]      = enriched_items
            combo["totalPrice"] = round(total, 2)

        return combos
    except Exception as e:
        print(f"WARNING: Combo JSON parse error: {e}")
        return []

# ---------------------------------------------------------
# Helper: Find customer in Customer_Auth
# ---------------------------------------------------------
def get_customer_details(email: str | None, phone: str | None, client_id: str | None):
    if not email and not phone and not client_id:
        return None

    try:
        rows = sheets_client.read_sheet_rows(CUSTOMER_AUTH_SHEET)
    except Exception as e:
        print(f"WARNING: Error reading Customer_Auth: {e}")
        return None

    search_email = email.strip().lower() if email else None
    search_phone = str(phone).strip() if phone else None
    search_id = str(client_id).strip() if client_id else None

    # Priority 1: ID Match
    if search_id:
        for r in rows:
            if str(r.get("Customer_ID") or "").strip() == search_id:
                return r
    
    # Priority 2: Email Match
    if search_email:
        for r in rows:
            if (r.get("Customer_Email") or "").strip().lower() == search_email:
                return r

    # Priority 3: Phone Match
    if search_phone:
        for r in rows:
            if str(r.get("Customer_Phone") or "").strip() == search_phone:
                return r

    return None

# ---------------------------------------------------------
# Helper: FORMAT PROMPT FOR LLM
# ---------------------------------------------------------
def build_prompt(history, system_prompt, client_name, user_message, menu_context=""):
    lines = [system_prompt.replace("{clientName}", client_name), "\nConversation:\n"]

    for item in history:
        role = "Assistant" if item.role == "ai" else "User"
        lines.append(f"{role}: {item.text}")

    if menu_context:
        lines.append("\nAvailable Menu Items:")
        lines.append(menu_context)

    lines.append(f"User: {user_message}")
    lines.append("Assistant:")

    return "\n".join(lines)


# -----------------------------
# Health Check (Optional)
# -----------------------------
@chatbot_router.get("/health")
def health():
    return {"chatbot backend deployment status": "ok"}

# ---------------------------------------------------------
# LLM CHAT ENDPOINT (3-step loop)
# ---------------------------------------------------------
@chatbot_router.post("/llm-chat", response_model=ChatResponse)
async def llm_chat(req: ChatRequest):
    print("\n/llm-chat endpoint HIT (Agentic Loop)")

    try:
        # 1️⃣ Check if customer exists based on provided details
        customer = get_customer_details(req.clientEmail, req.clientPhone, req.clientId)
        
        # Determine User State
        user_context_instruction = ""
        
        # Default name if guest
        real_client_name = req.clientName if req.clientName and req.clientName.lower() != "guest" else "Guest"

        if customer:
            # --- USER IS REGISTERED ---
            db_name = customer.get("Customer_Name", "Valued Customer")
            db_email = customer.get("Customer_Email", "")
            
            # Use DB name if we have it
            if db_name:
                real_client_name = db_name

            if req.clientId:
                # LOGGED IN
                print(f"User Logged In: {real_client_name}")
                user_context_instruction = f"User STATUS: LOGGED IN.\nName: {real_client_name}.\nINSTRUCTION: Address them warmly by name. Do NOT ask for login/signup."
            else:
                # RECOGNIZED BUT NOT LOGGED IN
                print(f"User Registered but NOT Logged In: {real_client_name}")
                user_context_instruction = f"User STATUS: REGISTERED BUT NOT LOGGED IN.\nName: {real_client_name}.\nEmail Matches: {db_email}.\nINSTRUCTION: Address them by name. You MUST politely ask them to LOGIN for the best experience. Assure them that this chat IS being saved to their account."
        else:
            # NOT REGISTERED / GUEST
            print("User NOT Registered / Guest")
            user_context_instruction = f"User STATUS: GUEST (Unregistered).\nName provided: {real_client_name}.\nINSTRUCTION: You MUST politely suggest they SIGN UP. Warn them that 'Chat history is NOT saved for guests'. Reference the Sign Up page."

        # 2️⃣ STEP 1: Classify intent with Groq
        print("Classifying intent...")
        intent = classify_intent(req.userMessage, req.chatHistory)
        action  = intent.get("action", "general")
        filters = intent.get("filters", [])
        veg_only = intent.get("veg_only", False)
        print(f"Intent: action={action}, filters={filters}, veg_only={veg_only}")

        # 3️⃣ STEP 2: Get filtered menu from cache
        menu = []
        menu_text = ""
        if action in ("suggest_items", "suggest_combos"):
            try:
                menu = fetch_filtered_menu(filters, veg_only)
                menu_text = format_menu_for_llm(menu)
                print(f"{len(menu)} menu items ready for LLM")
            except Exception as e:
                print(f"ERROR: Menu fetch error: {e}")

        # 4️⃣ Build final prompt
        enhanced_system_prompt = f"{SYSTEM_PROMPT}\n\nCURRENT USER CONTEXT:\n{user_context_instruction}"

        reply_prompt = build_prompt(
            req.chatHistory,
            enhanced_system_prompt,
            real_client_name,
            req.userMessage,
            menu_text
        )

        # 5️⃣ STEP 3: Parallel Groq calls for Combos and Reply
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        print("Starting Groq calls...")
        if action == "suggest_combos" and menu_text:
            combo_task = loop.run_in_executor(
                None, generate_structured_combos, menu, menu_text, req.userMessage
            )
            reply_task = loop.run_in_executor(
                None, groq_client.call_groq_with_retry, reply_prompt
            )
            structured_combos, ai_reply = await asyncio.gather(combo_task, reply_task)
            print(f"Parallel done: {len(structured_combos)} combos + reply")
        else:
            structured_combos = []
            ai_reply = await loop.run_in_executor(
                None, groq_client.call_groq_with_retry, reply_prompt
            )

        if not ai_reply:
            raise Exception("Empty response from LLM")

        return ChatResponse(
            response=ai_reply,
            combos=[ComboData(**c) for c in structured_combos] if structured_combos else []
        )

    except Exception as e:
        print("ERROR: Agent error in llm_chat:", e)
        import traceback
        traceback.print_exc()
        return ChatResponse(response="Sorry, I'm having trouble connecting right now.")

# ---------------------------------------------------------
# Helper: Generate next Chat ID
# ---------------------------------------------------------
def generate_next_chat_id():
    try:
        rows = sheets_client.read_sheet_rows(CHATS_SHEET)
    except Exception:
        rows = []

    max_num = 0

    for r in rows:
        chat_id = r.get("Chat_ID", "")
        match = re.search(r"Chat_(\d+)", chat_id)
        if match:
            num = int(match.group(1))
            max_num = max(max_num, num)

    next_num = max_num + 1
    return f"Chat_{str(next_num).zfill(5)}"

# ---------------------------------------------------------
# SAVE CHAT SESSION ENDPOINT
# ---------------------------------------------------------
@chatbot_router.post("/save-chat")
async def save_chat(session: ChatSession):
    """
    Receives chat session and saves it only if
    customer exists in Customer_Auth sheet.
    """
    print("\n/save-chat endpoint HIT")

    try:
        # 1️⃣ Find existing customer (Try ID first, then email, then phone)
        customer = get_customer_details(session.clientEmail, session.clientPhone, session.clientId)
        
        customer_id = customer.get("Customer_ID") if customer else None
        customer_name = customer.get("Customer_Name") if customer else session.clientName

        if not customer:
            print(f"WARNING: Guest Chat not saved. (Name: {session.clientName})")
            return {
                "status": "ignored",
                "message": "Customer not registered. Chat not saved."
            }

        print(f"Customer Identified: {customer_name} ({customer_id})")

        # 2️⃣ Generate next Chat ID
        chat_id = generate_next_chat_id()

        # 3️⃣ Ensure timestamp
        chat_datetime = session.date
        if not chat_datetime:
            from datetime import datetime
            chat_datetime = datetime.now().isoformat()

        # 4️⃣ Prepare row
        row = [
            chat_id,
            customer_id,
            customer_name or "",
            customer.get("Customer_Phone") or session.clientPhone or "",
            customer.get("Customer_Email") or session.clientEmail or "",
            chat_datetime,
            session.transcriptText or "",
        ]

        # 5️⃣ Save
        sheets_client.append_row(CHATS_SHEET, row)

        print(f"Chat saved successfully: {chat_id}")

        return {
            "status": "success",
            "chatId": chat_id,
            "customerId": customer_id
        }

    except Exception as e:
        print("ERROR saving chat:", e)
        return {
            "status": "error",
            "message": str(e)
        }
