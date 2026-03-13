# DineIQ\Backend\agents\chatbot.py

# ---------------------------------------------------------
# Library and Packages Import
# ---------------------------------------------------------
import os
# import re
from fastapi import APIRouter
from pydantic import BaseModel
# from datetime import datetime, timezone

# -------------------------------------------------------------------
# 🔧 SETUP KEYS and URLs
# -------------------------------------------------------------------
from dotenv import load_dotenv

load_dotenv()

SPREADSHEET_ID = os.environ.get("SPREADSHEET_ID", "").strip()

# ---------------------------------------------------------
# Centralized Singletons
# ---------------------------------------------------------
from services.dependencies import sheets as sheets_client, gemini_chatbot as gemini_client

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

# ---------------------------------------------------------
# REQUEST / RESPONSE MODELS
# ---------------------------------------------------------
class FrontendChatItem(BaseModel):
    role: str
    text: str

class ChatRequest(BaseModel):
    chatHistory: list[FrontendChatItem]
    userMessage: str
    clientName: str | None = "Guest"
    clientId: str | None = None
    clientEmail: str | None = None
    clientPhone: str | None = None

class ChatResponse(BaseModel):
    response: str

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
# ---------------------------------------------------------
# SYSTEM PROMPT
# ---------------------------------------------------------
SYSTEM_PROMPT = """
You are a highly professional restaurant concierge AI assistant for DineIQ.

Your Objectives:
- Respond politely, warmly, and naturally.
- Always address the client by their name (if known).
- Maintain memory of previous chat messages.
- Tone: Friendly, concise, human-like, professional.
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
   - Do NOT suggest SIGNUP or REGISTRATION, as they already have an account.
   - Assure them that this chat IS being saved to their account.

3. GUEST (Unregistered):
   - ONLY if the user is not found in the database, politely suggest they SIGN UP.
   - Warn them strictly that "Chat history is NOT saved for guests".
   - If they refuse, help them normally but remind them occasionally.

General Rules:
- Use menu data if provided.
- Do NOT invent menu items or prices.
- You are not here to take orders (redirect to "Place Order" page).
- Return ONLY the reply message (no JSON, no metadata).
"""

# ---------------------------------------------------------
# MENU INTENT DETECTION
# ---------------------------------------------------------
MENU_KEYWORDS = [
    "menu", "dish", "food", "eat", "price", "cost", 
    "veg", "non veg", "vegetarian", "recommend", 
    "order", "special", "hungry", "diet", "cuisine"
]

def is_menu_query(message: str) -> bool:
    msg = message.lower()
    return any(word in msg for word in MENU_KEYWORDS)

# ---------------------------------------------------------
# Helper: Find customer in Customer_Auth
# ---------------------------------------------------------
def get_customer_details(email: str | None, phone: str | None, client_id: str | None):
    """
    Returns full customer dict if found (Name, Email, Phone, ID).
    Otherwise returns None.
    """
    if not email and not phone and not client_id:
        return None

    try:
        rows = sheets_client.read_sheet_rows(CUSTOMER_AUTH_SHEET)
    except Exception as e:
        print(f"⚠️ Error reading Customer_Auth: {e}")
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
# Helper: FORMAT PROMT FOR GEMINI
# ---------------------------------------------------------
def build_prompt(history, system_prompt, client_name, user_message, menu_context=""):
    """
    Convert chat history into a single text prompt
    for LLM service.
    """
    lines = [system_prompt.replace("{clientName}", client_name), "\nConversation:\n"]

    for item in history:
        role = "Assistant" if item.role == "ai" else "User"
        lines.append(f"{role}: {item.text}")

    if menu_context:
        lines.append("\nAvailable Menu Items:")
        lines.append(menu_context)

    # latest message
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
# LLM CHAT ENDPOINT
# ---------------------------------------------------------
@chatbot_router.post("/llm-chat", response_model=ChatResponse)
async def llm_chat(req: ChatRequest):
    print("\n🔥 /llm-chat endpoint HIT")

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
            db_id = customer.get("Customer_ID", "")
            
            # Use DB name if we have it
            if db_name:
                real_client_name = db_name

            if req.clientId:
                # 🟢 LOGGED IN
                print(f"✅ User Logged In: {real_client_name}")
                user_context_instruction = (
                    f"User STATUS: LOGGED IN.\n"
                    f"Name: {real_client_name}.\n"
                    f"INSTRUCTION: Address them warmly by name. Do NOT ask for login/signup."
                )
            else:
                # 🟡 RECOGNIZED BUT NOT LOGGED IN
                print(f"⚠️ User Registered but NOT Logged In: {real_client_name}")
                user_context_instruction = (
                    f"User STATUS: REGISTERED BUT NOT LOGGED IN.\n"
                    f"Name: {real_client_name}.\n"
                    f"Email Matches: {db_email}.\n"
                    f"INSTRUCTION: Address them by name. You MUST politely ask them to LOGIN for the best experience. "
                    f"Assure them that this chat IS being saved to their account."
                )
        else:
            # 🔴 NOT REGISTERED / GUEST
             print("❌ User NOT Registered / Guest")
             user_context_instruction = (
                 f"User STATUS: GUEST (Unregistered).\n"
                 f"Name provided: {real_client_name}.\n"
                 f"INSTRUCTION: You MUST politely suggest they SIGN UP. "
                 f"Warn them that 'Chat history is NOT saved for guests'. "
                 f"Reference the Sign Up page."
             )

        # 2️⃣ Detect menu intent
        menu_context = ""

        if is_menu_query(req.userMessage):
            print("🍽️ Menu query detected")
            menu = menu_agent.get_menu()

            menu_lines = []
            for item in menu:
                price = item.get("price")
                price_str = f"₹{price}" if price else "Price on request"
                menu_lines.append(f"- {item['name']} ({price_str})")

            menu_context = "\n".join(menu_lines)

        # 3️⃣ Build final prompt
        # Append logic instruction to system prompt
        enhanced_system_prompt = f"{SYSTEM_PROMPT}\n\nCURRENT USER CONTEXT:\n{user_context_instruction}"

        prompt = build_prompt(
            req.chatHistory,
            enhanced_system_prompt,
            real_client_name,
            req.userMessage,
            menu_context
        )

        # 4️⃣ Call LLM service
        ai_reply = gemini_client.call_gemini_with_retry(prompt)

        if not ai_reply:
            raise Exception("Empty response from LLM")

        return ChatResponse(response=ai_reply)

    except Exception as e:
        print("❌ LLM error:", e)
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
        import re
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
# ---------------------------------------------------------
# SAVE CHAT SESSION ENDPOINT
# ---------------------------------------------------------
@chatbot_router.post("/save-chat")
async def save_chat(session: ChatSession):
    """
    Receives chat session and saves it only if
    customer exists in Customer_Auth sheet.
    """
    print("\n🔥 /save-chat endpoint HIT")
    # print("📥 Received chat session:", session.model_dump())

    try:
        # 1️⃣ Find existing customer (Try ID first, then email, then phone)
        customer = get_customer_details(session.clientEmail, session.clientPhone, session.clientId)
        
        customer_id = customer.get("Customer_ID") if customer else None
        customer_name = customer.get("Customer_Name") if customer else session.clientName

        if not customer:
            print(f"⚠️ Guest Chat: Not registered. Chat NOT saved. (Name: {session.clientName})")
            return {
                "status": "ignored",
                "message": "Customer not registered. Chat not saved."
            }

        # If found, but session didn't have ID, we now know the ID
        print(f"✅ Customer Identified: {customer_name} ({customer_id})")

        # 2️⃣ Generate next Chat ID
        chat_id = generate_next_chat_id()

        # 3️⃣ Ensure timestamp
        chat_datetime = session.date
        if not chat_datetime:
            from datetime import datetime
            chat_datetime = datetime.now().isoformat()

        # 4️⃣ Prepare row
        # Schema: Chat_ID, Customer_ID, Customer_Name, Customer_Phone, Customer_Email, Date_Time, Transcript
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

        print(f"💾 Chat saved successfully: {chat_id}")

        return {
            "status": "success",
            "chatId": chat_id,
            "customerId": customer_id
        }

    except Exception as e:
        print("❌ ERROR saving chat:", e)
        return {
            "status": "error",
            "message": str(e)
        }

# ---------------------------------------------------------
# Python-based port reading
# ---------------------------------------------------------
# if __name__ == "__main__":
#     import os, uvicorn
#     port = int(os.environ.get("PORT", 8080))
#     uvicorn.run("app:app", host="0.0.0.0", port=port)