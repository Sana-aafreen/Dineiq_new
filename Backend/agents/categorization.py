# DineIQ\Backend\agents\categorization.py

# ---------------------------------------------------------
# Library and Packages Import
# ---------------------------------------------------------
import os
# import re
# import time
# import json
import pandas as pd

from config import BATCH_SIZE, REQUEST_DELAY

# -------------------------------------------------------------------
# 🔧 SETUP KEYS and URLs
# -------------------------------------------------------------------
from dotenv import load_dotenv

load_dotenv()

from services.dependencies import sheets as sheets_client
from services.dependencies import gemini_dietary as gemini_client, gemini_chat_inf as gemini_client_2

GEMINI_CHAT_LLM_INFERENCE_ENABLED = (os.getenv("GEMINI_CHAT_LLM_INFERENCE_ENABLED", "false").lower() == "true")
GEMINI_DIETARY_LLM_INFERENCE_ENABLED = (os.getenv("GEMINI_DIETARY_LLM_INFERENCE_ENABLED", "false").lower() == "true")


CUSTOMER_AUTH_SHEET        = "Customer_Auth"       # Read-Write from Customer Frontend Web/App
CUSTOMER_INSIGHTS_SHEET    = "Customer_Insights"   # Multiple customer sub-categories derived and recorded here
CUSTOMER_PREFERENCES_SHEET = "Customer_Preferences" # Customer preferences from signup questionnaire
ORDERS_SHEET               = "Orders"              # Writable from Customer Frontend Web/App, Partially Updated with AI/Automation
ORDER_ITEMS_SHEET          = "Order_Items"         # Writable from Customer Frontend Web/App
CHATS_SHEET                = "Chats"               # Writable from Customer-AI Frontend Chatbot

# -------------------------------------------------------------------
# 🧩 Infer Customer category based on dietary preferences
# Vegetarian | Non-Vegetarian | Vegan | Jain | Eggetarian
# -------------------------------------------------------------------
def infer_dietary(order_items):
    """
    TEMP: LLM disabled due to quota limits
    """
    if not GEMINI_DIETARY_LLM_INFERENCE_ENABLED:
        return None
    
    # if no order items, return None
    if order_items.empty:
        print("dietary: orders empty")
        return None

    items = order_items["Item_Name"].astype(str).tolist()

    dietary_prompt = f"""
    You are classifying a customer's dietary preference.

    Dietary categories:
    - Vegetarian: No meat, fish, or eggs. Dairy allowed.
    - Eggetarian: Eggs allowed, no meat or fish.
    - Non-Vegetarian: Meat or fish present.
    - Vegan: No animal products at all.
    - Jain: No root vegetables (onion, garlic, potato), no meat, no eggs.
    - No-Restrictions: All food items allowed, including meat, fish, eggs, etc.

    Rules:
    - Infer the dominant dietary preference based on the ordered items.
    - If multiple categories are present, choose the one that best represents the overall order.
    - If no clear category dominates, return null.
    - Return ONLY one of the category names or null.

    Ordered items:
    {items}
    """
    
    # fetch gemini model and generate response
    try:
        response = gemini_client.call_gemini_with_retry(dietary_prompt)
        result = response.strip().lower()
    except Exception as e:
        print("dietary: exception -> ", repr(e))
        return None
    
    # normalize and map to canonical allowed dietary category
    mapping = {
        "vegetarian": "Vegetarian",
        "eggetarian": "Eggetarian",
        "non-vegetarian": "Non-Vegetarian",
        "non vegetarian": "Non-Vegetarian",
        "vegan": "Vegan",
        "jain": "Jain",
        "no-restrictions": "No-Restrictions",
        "null": None
    }

    # Validate result with allowed dietary categories
    for key, value in mapping.items():
        if key == result:
            print("dietary: ", value)
            return value
    # If not found in NORMALISED, return None
    print("dietary: not in mapping")
    return None

# -------------------------------------------------------------------
# 🧩 Infer Customer avg order value based on orders history
# Low Spender       : Average order value under 300
# Mid Spender       : Average order value from 300 to 599
# High Spender      : Average order value from 600 to 999
# Premium Spender   : Average order value equal to or above 1000
# -------------------------------------------------------------------
def infer_aov(orders):
    if orders.empty:
        print("aov: orders empty")
        return None

    # compute average order value from the orders
    avg = pd.to_numeric(orders["Order_Price"], errors="coerce").mean()

    # Handle empty avg value
    if pd.isna(avg):
        print("aov: Nan")
        return None
    
    # Fine the right aov range
    if avg < 1000:
        return "Low Spender"
    elif avg < 3000:
        return "Mid Spender"
    elif avg < 5000:
        return "High Spender"
    else:
        return "Premium Spender"

# -------------------------------------------------------------------
# 🧩 Infer Customer avg order value based on visits in last 30 days
# Occasional    : Upto 1 visit
# Regular       : between 1 upto 4 visits
# Frequent      : between 4 upto 8 visits
# Loyal         : more than 8 visits
# -------------------------------------------------------------------
def infer_frequency(orders):
    if orders.empty:
        print("frequency: orders empty")
        return None

    # Convert order dates to datetime
    dates_range = pd.to_datetime(
        orders["Order_Created_DateTime"],
        errors="coerce",
        format="mixed",
    )

    # Handle all NaT dates
    if dates_range.dropna().empty:
        print("frequency: dates Nan")
        return None

    # Compute recent order count (last 30 days)
    cutoff = pd.Timestamp.now() - pd.Timedelta(days=30)
    # number of orders in that period
    count = (dates_range >= cutoff).sum()

    # assign frequency bucket
    if count <= 1:
        print("frequency: ","Occasional")
        return "Occasional"
    elif count <= 4:
        print("frequency: ","Regular")
        return "Regular"
    elif count <= 8:
        print("frequency: ","Frequent")
        return "Frequent"
    else:
        print("frequency: ","Loyal")
        return "Loyal"

# -------------------------------------------------------------------
# 🧩 Infer Customer ordering attitude based on orders and aov
# Refund-Prone      : 30% cancelled or refunded orders out of total orders
# Quality-Seeker    : Average order value >= 600
# Value-Seeker      : Default case
# -------------------------------------------------------------------
def infer_attitude(orders):
    if orders.empty:
        print("attitude: orders empty")
        return None

    # Compute total orders
    total = len(orders)
    
    # Compute cancelled/refunded orders
    cancelled = orders[
        orders["Order_Status"]
        .astype(str)
        .str.lower()
        .isin(["cancelled", "refunded"])
    ]

    # Determine if Refund-Prone
    if total > 0 and len(cancelled) / total >= 0.3:
        print("attitude: ","Refund-Prone")
        return "Refund-Prone"

    # Determine if “Quality-Seeker”
    avg = pd.to_numeric(orders["Order_Price"], errors="coerce").mean()
    # Handle nan values
    if pd.notna(avg) and avg >= 600:
        print("attitude: ","Quality-Seeker")
        return "Quality-Seeker"

    # Default Value-Seeker
    print("attitude: ","Value-Seeker")
    return "Value-Seeker"

# -------------------------------------------------------------------
# 🧩 Infer Customer on Dietary, Attitude and Favorite Items based on Chat
# Dietary   : "Vegetarian", "Non-Vegetarian", "Vegan", "Eggetarian", "Jain"
# Attitude  : "Value-Seeker", "Quality-Seeker", "Coupon-Driven", "Refund-Prone"
# Favorite Food Items: A list of 1-2 items in chat
# -------------------------------------------------------------------
ALLOWED_DIETARY = {"Vegetarian", "Non-Vegetarian", "Vegan", "Eggetarian", "Jain", "No-Restrictions"}
ALLOWED_ATTITUDE = {"Value-Seeker", "Quality-Seeker", "Coupon-Driven", "Refund-Prone"}

def infer_from_chat(chat_text):
    """
    TEMP: LLM disabled due to quota limits
    """
    if not GEMINI_CHAT_LLM_INFERENCE_ENABLED:
        return {
                "dietary": None,
                "attitude": None,
                "favorites": []
            }

    if not chat_text.strip():
        return {
            "dietary": None,
            "attitude": None,
            "favorites": []
        }
    
    chat_prompt = f"""
You are classifying a restaurant customer based ONLY on chat text.

Choose values STRICTLY from the allowed categories below.
If a category cannot be inferred confidently, return null.

Dietary (choose one): {list(ALLOWED_DIETARY)}
Attitude (choose one): {list(ALLOWED_ATTITUDE)}
Favorites: Extract 1–2 food items explicitly mentioned in chat.

Output STRICT JSON only:
{{
  "dietary": null | "<one of allowed values>",
  "attitude": null | "<one of allowed values>",
  "favorite_food_items": []
}}

Chat Text:
{chat_text}

"""
    
    # fetch gemini model and generate response
    try:
        import json, re
        response = gemini_client_2.call_gemini_with_retry(chat_prompt)
        # print("\nRaw response:", repr(response), "\n")
        result = json.loads(re.sub(r"^```(?:json)?\s*|\s*```$", "", response.strip(), flags=re.DOTALL))
        # result = json.loads(response)
        # if result is None:
        #     result = {"dietary": None, "attitude": None, "favorites": []}
        print("\nChat Inference Result:", result, "\n")
    except Exception as e:
        print("chat: exception -> ", repr(e))
        return {"dietary": None, "attitude": None, "favorites": []}

    # Validate and normalize
    dietary = result.get("dietary")
    attitude = result.get("attitude")
    favorites = result.get("favorite_food_items", [])

    dietary = dietary if dietary in ALLOWED_DIETARY else None
    attitude = attitude if attitude in ALLOWED_ATTITUDE else None
    if not isinstance(favorites, list):
        print("No favorites extracted from: ", favorites)
        favorites = []

    # return with all categories
    print (
        "Chat Inference final outcome: \n",
        "dietary: ", dietary,
        "attitude: ", attitude,
        "favorites: ", favorites
    )
    return {
        "dietary": dietary,
        "attitude": attitude,
        "favorites": favorites
    }

# -------------------------------------------------------------------
# 🧩 Build comma-separated Customer Category
# -------------------------------------------------------------------
def build_customer_category(insights):
    fields = [
        insights.get("Dietary"),
        insights.get("AOV"),
        insights.get("Frequency"),
        insights.get("Attitude")
    ]
    return ", ".join(v for v in fields if v)

# -------------------------------------------------------------------
# 🧩 Compute Customer Score (0–100)
#
# Scoring rubric (weighted across 4 behavioral dimensions + 1 data signal):
#
#  AOV Tier        (30 pts)  — Spending power
#    Premium Spender → 30
#    High Spender    → 22
#    Mid Spender     → 14
#    Low Spender     →  6
#    Unknown         →  0
#
#  Visit Frequency (30 pts)  — Loyalty / retention signal
#    Loyal           → 30
#    Frequent        → 22
#    Regular         → 14
#    Occasional      →  6
#    Unknown         →  0
#
#  Attitude        (20 pts)  — Order quality / risk signal
#    Quality-Seeker  → 20
#    Value-Seeker    → 12
#    Coupon-Driven   →  8
#    Refund-Prone    →  0
#    Unknown         →  0
#
#  Dietary known   (10 pts)  — Profile completeness signal
#    Any value       → 10
#    Unknown / None  →  0
#
#  Favorites known (10 pts)  — Engagement / personalisation signal
#    Has favorites   → 10
#    None            →  0
#
# Total: 0 – 100
# -------------------------------------------------------------------
def compute_customer_score(insights: dict) -> int:
    score = 0

    # --- AOV (30 pts) ---
    aov_scores = {
        "Premium Spender": 30,
        "High Spender":    22,
        "Mid Spender":     14,
        "Low Spender":      6,
    }
    score += aov_scores.get(insights.get("AOV") or "", 0)

    # --- Frequency (30 pts) ---
    freq_scores = {
        "Loyal":      30,
        "Frequent":   22,
        "Regular":    14,
        "Occasional":  6,
    }
    score += freq_scores.get(insights.get("Frequency") or "", 0)

    # --- Attitude (20 pts) ---
    attitude_scores = {
        "Quality-Seeker": 20,
        "Value-Seeker":   12,
        "Coupon-Driven":   8,
        "Refund-Prone":    0,
    }
    score += attitude_scores.get(insights.get("Attitude") or "", 0)

    # --- Dietary known (10 pts) ---
    dietary = (insights.get("Dietary") or "").strip()
    if dietary:
        score += 10

    # --- Favorites known (10 pts) ---
    favorites = (insights.get("Favorites") or "").strip()
    if favorites:
        score += 10

    print(f"🏆 Customer_Score computed: {score}/100")
    return score

# -------------------------------------------------------------------
# 🚀 SINGLE CUSTOMER CATEGORIZATION (for order triggers)
# -------------------------------------------------------------------
def categorize_single_customer(customer_id: str) -> bool:
    """
    Categorize a single customer based on their order history and chat history.
    This function is called when a new order is placed.
    
    Args:
        customer_id: The unique customer ID to categorize
        
    Returns:
        bool: True if categorization succeeded, False otherwise
    """
    try:
        print(f"\n{'='*80}")
        print(f"📢 Starting categorization for Customer ID: {customer_id}")
        print(f"{'='*80}\n")
        
        # Initialize services if not already initialized
        try:
            sheets_client.init_service()
            gemini_client.init_gemini()
            gemini_client_2.init_gemini()
        except Exception as e:
            # Services might already be initialized, that's okay
            print(f"ℹ️ Services initialization: {e}")
        
        # Read all necessary sheets
        df_customers = sheets_client.read_sheet(CUSTOMER_AUTH_SHEET)
        df_insights  = sheets_client.read_sheet(CUSTOMER_INSIGHTS_SHEET)
        df_preferences = sheets_client.read_sheet(CUSTOMER_PREFERENCES_SHEET)
        df_orders    = sheets_client.read_sheet(ORDERS_SHEET)
        df_items     = sheets_client.read_sheet(ORDER_ITEMS_SHEET)
        df_chats     = sheets_client.read_sheet(CHATS_SHEET)
        
        # Expected columns for Customer_Insights sheet
        EXPECTED_INSIGHTS_COLUMNS = [
            "Customer_ID", "Customer_Name", "Dietary", "Favorites", 
            "AOV", "Frequency", "Attitude", "Customer_Score"
        ]
        
        # Ensure schema alignment with Google Sheet
        if df_insights.empty:
            df_insights = pd.DataFrame(columns=EXPECTED_INSIGHTS_COLUMNS)
        else:
            for col in EXPECTED_INSIGHTS_COLUMNS:
                if col not in df_insights.columns:
                    df_insights[col] = ""
            # Enforce correct column order
            df_insights = df_insights[EXPECTED_INSIGHTS_COLUMNS]
        
        # Find the customer in Customer_Auth sheet
        customer_row = df_customers[df_customers["Customer_ID"] == customer_id]
        
        if customer_row.empty:
            print(f"❌ Customer ID {customer_id} not found in {CUSTOMER_AUTH_SHEET}")
            return False
        
        customer_name = str(customer_row.iloc[0].get("Customer_Name", "")).strip()
        print(f"✅ Found customer: {customer_name} ({customer_id})")
        
        # Fetch orders specific to this customer
        cust_orders = df_orders[df_orders["Customer_ID"] == customer_id]
        print(f"📊 Found {len(cust_orders)} orders for this customer")
        
        # Fetch items specific to orders for this customer
        cust_items = df_items[df_items["Order_ID"].isin(cust_orders["Order_ID"])]
        print(f"📦 Found {len(cust_items)} order items for this customer")
        
        # Infer order history based insights
        order_insights = {
            "Dietary": infer_dietary(cust_items),
            "AOV": infer_aov(cust_orders),
            "Frequency": infer_frequency(cust_orders),
            "Attitude": infer_attitude(cust_orders)
        }
        print("✅ Order-based insights inferred")
        
        # Fetch chats specific to this customer
        cust_chats = df_chats[df_chats["Customer_ID"] == customer_id]
        chat_text = "\n".join(
            cust_chats["Chat_Session_Text"]
            .dropna()
            .astype(str)
            .tolist()
        )
        print(f"💬 Found {len(cust_chats)} chat sessions for this customer")
        
        # Infer chat-based insights
        chat_insights = infer_from_chat(chat_text)
        print("✅ Chat-based insights inferred")
        
        # Fetch customer preferences from signup questionnaire
        cust_prefs = df_preferences[df_preferences["Customer_ID"] == customer_id]
        preference_insights = {"dietary": None, "favorites": []}
        
        if not cust_prefs.empty:
            pref_row = cust_prefs.iloc[0]
            
            # Extract dietary type from preferences
            dietary_type = str(pref_row.get("Dietary_Type", "")).strip()
            if dietary_type and dietary_type.lower() != "nan":
                preference_insights["dietary"] = dietary_type
                print(f"🍽️ Dietary preference from signup: {dietary_type}")
            
            # Extract favorite items from preferences
            favorites = []
            for col in ["Preferred_Soup", "Favorite_Bun", "Dessert_Preference"]:
                item = str(pref_row.get(col, "")).strip()
                if item and item.lower() not in ["", "nan", "none"]:
                    favorites.append(item)
            
            if favorites:
                preference_insights["favorites"] = favorites
                print(f"❤️ Favorite items from signup: {', '.join(favorites)}")
            
            print("✅ Customer preferences from signup processed")
        else:
            print("ℹ️ No signup preferences found for this customer")
        
        # Combine all insights with priority: preferences > orders > chats
        # For dietary: preferences (explicit choice) > orders (behavior) > chats (mentioned)
        # For favorites: combine all sources
        all_favorites = []
        all_favorites.extend(preference_insights["favorites"])
        all_favorites.extend(chat_insights["favorites"])
        
        final_insights = {
            "Customer_ID": customer_id,
            "Customer_Name": customer_name,
            "Dietary": preference_insights["dietary"] or order_insights["Dietary"] or chat_insights["dietary"],
            "Favorites": ", ".join(all_favorites) if all_favorites else "",
            "AOV": order_insights["AOV"],
            "Frequency": order_insights["Frequency"],
            "Attitude": order_insights["Attitude"] or chat_insights["attitude"]
        }

        # Compute composite Customer Score
        customer_score = compute_customer_score(final_insights)
        final_insights["Customer_Score"] = customer_score
        
        # Update or insert in Customer_Insights sheet
        existing_idx = df_insights[df_insights["Customer_ID"] == customer_id].index
        
        if len(existing_idx):
            # Update existing customer
            i = existing_idx[0]
            df_insights.at[i, "Customer_ID"] = customer_id
            df_insights.at[i, "Customer_Name"] = customer_name
            
            for col in ["Dietary", "Favorites", "AOV", "Frequency", "Attitude"]:
                if final_insights.get(col) is not None:
                    df_insights.at[i, col] = final_insights[col]
            df_insights.at[i, "Customer_Score"] = customer_score
            print(f"✅ Updated existing insights for customer {customer_id}")
        else:
            # Insert new customer
            new_row = {
                "Customer_ID": customer_id,
                "Customer_Name": customer_name,
                "Dietary": final_insights["Dietary"],
                "Favorites": final_insights["Favorites"],
                "AOV": final_insights["AOV"],
                "Frequency": final_insights["Frequency"],
                "Attitude": final_insights["Attitude"],
                "Customer_Score": customer_score,
            }
            df_insights = pd.concat(
                [df_insights, pd.DataFrame([new_row])],
                ignore_index=True
            )
            print(f"✅ Created new insights entry for customer {customer_id}")
        
        # Build final customer category
        customer_category = build_customer_category(final_insights)
        print(f"🏷️ Customer Category: {customer_category}")
        
        # Treat NaN values before writing to Google Sheets
        # String columns: fill with empty string
        for col in ["Customer_ID", "Customer_Name", "Dietary", "Favorites", "AOV", "Frequency", "Attitude"]:
            df_insights[col] = df_insights[col].fillna("")
        # Score column: cast to native Python int so Google Sheets stores it as a number
        df_insights["Customer_Score"] = pd.to_numeric(df_insights["Customer_Score"], errors="coerce").fillna(0).apply(int)
        
        # Update Customer_Insights sheet
        sheets_client.update_sheet(
            CUSTOMER_INSIGHTS_SHEET,
            df_insights,
            columns_to_update=["Customer_ID", "Customer_Name", "Dietary", "Favorites", "AOV", "Frequency", "Attitude", "Customer_Score"]
        )
        print(f"✅ Customer_Insights sheet updated")
        
        # Update Customer_Auth sheet with the category
        customer_idx = df_customers[df_customers["Customer_ID"] == customer_id].index[0]
        df_customers.at[customer_idx, "Customer_Category"] = customer_category
        
        sheets_client.update_sheet(
            CUSTOMER_AUTH_SHEET,
            df_customers,
            columns_to_update=["Customer_Category"]
        )
        print(f"✅ Customer_Auth sheet updated")
        
        print(f"\n{'='*80}")
        print(f"✅ Categorization completed successfully for {customer_name} ({customer_id})")
        print(f"{'='*80}\n")
        
        return True
        
    except Exception as e:
        print(f"\n{'='*80}")
        print(f"❌ Error categorizing customer {customer_id}: {e}")
        print(f"{'='*80}\n")
        import traceback
        traceback.print_exc()
        return False

# -------------------------------------------------------------------
# 🚀 MAIN PROCESS (Batch processing all customers)
# -------------------------------------------------------------------
def categorize_customers():

    print("#" * 100)
    print("📢 Customers Processing started ...")

    # Initialize LLM instance
    sheets_client.init_service()
    gemini_client.init_gemini()
    gemini_client_2.init_gemini()
    print("\n✅ Initialized Sheets and Gemini")

    # === STEP 1: Read Customer_Auth, Customer_Insights, Customer_Preferences, Orders, Order_Items & Chats sheets ===
    df_customers = sheets_client.read_sheet(CUSTOMER_AUTH_SHEET)
    df_insights  = sheets_client.read_sheet(CUSTOMER_INSIGHTS_SHEET)
    df_preferences = sheets_client.read_sheet(CUSTOMER_PREFERENCES_SHEET)
    df_orders    = sheets_client.read_sheet(ORDERS_SHEET)
    df_items     = sheets_client.read_sheet(ORDER_ITEMS_SHEET)
    df_chats     = sheets_client.read_sheet(CHATS_SHEET)

    # list of columns in Customer_Insights sheet
    EXPECTED_INSIGHTS_COLUMNS=["Customer_ID", "Customer_Name", "Dietary", "Favorites", "AOV", "Frequency", "Attitude", "Customer_Score"]

    # Ensure schema alignment with Google Sheet
    if df_insights.empty:
        df_insights = pd.DataFrame(columns=EXPECTED_INSIGHTS_COLUMNS)
    else:
        for col in EXPECTED_INSIGHTS_COLUMNS:
            if col not in df_insights.columns:
                df_insights[col] = ""

        # Enforce correct column order
        df_insights = df_insights[EXPECTED_INSIGHTS_COLUMNS]

    # Add needed columns in insights df
    # if df_insights.empty:
    #     df_insights = pd.DataFrame(columns=[
    #         "Customer_ID", "Customer_Name", "Dietary", "Favorites", "AOV", "Frequency", "Attitude", "Customer_Score"
    #     ])

    # Display number of records from important sheets: customers, orders, chats
    print(f"\n🧾 Found {len(df_customers)} customer records in '{CUSTOMER_AUTH_SHEET}'.")
    print(f"\n🧾 Found {len(df_orders)} customer records in '{ORDERS_SHEET}'.")
    print(f"\n🧾 Found {len(df_chats)} chat records in '{CHATS_SHEET}'.")

    for idx, cust in df_customers.iterrows():
        
        # Fetch individual customer ID and name
        customer_id = str(cust.get("Customer_ID", "")).strip()
        customer_name = str(cust.get("Customer_Name", "")).strip()

        # No ID found for a customer
        if not customer_id:
            print("[X] Customer ID not found")
            continue
        
        print(f"\n Inferring for Customer ID: {customer_id} ................... \n")


        # Fetch orders specific to a customer
        cust_orders = df_orders[df_orders["Customer_ID"] == customer_id]
        # Fetch items specific to an order for the customer
        cust_items = df_items[
            df_items["Order_ID"].isin(cust_orders["Order_ID"])
        ]

        # Infer order history based insights for the customer
        order_insights = {
            "Dietary": infer_dietary(cust_items),
            "AOV": infer_aov(cust_orders),
            "Frequency": infer_frequency(cust_orders),
            "Attitude": infer_attitude(cust_orders)
        }
        print("✅ Customer Orders based Category(ies) inferred")

        # Fetch chats specific to a customer
        cust_chats = df_chats[df_chats["Customer_ID"] == customer_id]
        # Collect all chats from the customer
        chat_text = "\n".join(
            cust_chats["Chat_Session_Text"]
            .dropna()
            .astype(str)
            .tolist()
        )

        # Infer chats based insights for the customer
        chat_insights = infer_from_chat(chat_text)
        print("✅ Customer Chats based Category(ies) inferred")

        # Fetch customer preferences from signup questionnaire
        cust_prefs = df_preferences[df_preferences["Customer_ID"] == customer_id]
        preference_insights = {"dietary": None, "favorites": []}
        
        if not cust_prefs.empty:
            pref_row = cust_prefs.iloc[0]
            
            # Extract dietary type from preferences
            dietary_type = str(pref_row.get("Dietary_Type", "")).strip()
            if dietary_type and dietary_type.lower() != "nan":
                preference_insights["dietary"] = dietary_type
            
            # Extract favorite items from preferences
            favorites = []
            for col in ["Preferred_Soup", "Favorite_Bun", "Dessert_Preference"]:
                item = str(pref_row.get(col, "")).strip()
                if item and item.lower() not in ["", "nan", "none"]:
                    favorites.append(item)
            
            preference_insights["favorites"] = favorites

        # Combine all insights with priority: preferences > orders > chats
        # For dietary: preferences (explicit choice) > orders (behavior) > chats (mentioned)
        # For favorites: combine all sources
        all_favorites = []
        all_favorites.extend(preference_insights["favorites"])
        all_favorites.extend(chat_insights["favorites"])
        
        final_insights = {
            "Customer_ID": customer_id,
            "Customer_Name": customer_name,
            "Dietary": preference_insights["dietary"] or order_insights["Dietary"] or chat_insights["dietary"],
            "Favorites": ", ".join(all_favorites) if all_favorites else "",
            "AOV": order_insights["AOV"],
            "Frequency": order_insights["Frequency"],
            "Attitude": order_insights["Attitude"] or chat_insights["attitude"]
        }

        # Compute composite Customer Score
        customer_score = compute_customer_score(final_insights)
        final_insights["Customer_Score"] = customer_score

        # Find out existing customers/indices in insights data
        existing_idx = df_insights[
            df_insights["Customer_ID"] == customer_id
        ].index

        # Update customer insights accordingly
        if len(existing_idx):
            i = existing_idx[0]
            
            # Always keep ID + Name in sync
            df_insights.at[i, "Customer_ID"] = customer_id
            df_insights.at[i, "Customer_Name"] = customer_name

            for col in ["Dietary", "Favorites", "AOV", "Frequency", "Attitude"]:
                if final_insights.get(col) is not None:
                    df_insights.at[i, col] = final_insights[col]
            df_insights.at[i, "Customer_Score"] = customer_score
        else:
            new_row = {
                "Customer_ID": customer_id,
                "Customer_Name": customer_name,
                "Dietary": final_insights["Dietary"],
                "Favorites": final_insights["Favorites"],
                "AOV": final_insights["AOV"],
                "Frequency": final_insights["Frequency"],
                "Attitude": final_insights["Attitude"],
                "Customer_Score": customer_score,
            }
            df_insights = pd.concat(
                [df_insights, pd.DataFrame([new_row])],
                ignore_index=True
            )
        print("✅ Customer Insights updated")

        # Build final customer category from insights
        df_customers.at[idx, "Customer_Category"] = build_customer_category(final_insights)
        print("✅ Final Customer Category(ies) built")

        # Introduce a wait period for LLM calls handling
        print(f"waiting for: {REQUEST_DELAY} seconds")
        import time
        time.sleep(REQUEST_DELAY)

    # Treat NaN values in customer insights before writing to google sheets
    # String columns: fill with empty string
    for col in ["Customer_ID", "Customer_Name", "Dietary", "Favorites", "AOV", "Frequency", "Attitude"]:
        df_insights[col] = df_insights[col].fillna("")
    # Score column: cast to native Python int so Google Sheets stores it as a number
    df_insights["Customer_Score"] = pd.to_numeric(df_insights["Customer_Score"], errors="coerce").fillna(0).apply(int)
    
    # Update Customer Insights in Customer_Insights sheet
    print("🧪 Insights DF columns:", list(df_insights.columns))
    sheets_client.update_sheet(
        CUSTOMER_INSIGHTS_SHEET,
        df_insights,
        columns_to_update=["Customer_ID", "Customer_Name", "Dietary", "Favorites", "AOV", "Frequency", "Attitude", "Customer_Score"]
    )
    print("✅ Customer Insights updated")

    # Update Customer Category(ies) in Customer_Auth sheet
    sheets_client.update_sheet(
        CUSTOMER_AUTH_SHEET,
        df_customers,
        columns_to_update=["Customer_Category"]
    )
    print("✅ Customer Categories updated")
    
    print("#" * 100)
    
# -------------------------------------------------------------------
# ▶️ RUN
# -------------------------------------------------------------------
if __name__ == "__main__":
    categorize_customers()
