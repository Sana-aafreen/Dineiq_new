import asyncio
import os
import pandas as pd
from services.dependencies import sqlite_db
from services.sheets import SheetsClient
from config import GOOGLE_SHEETS_SYNC

# ---------------------------------------------------------
# Configuration & Constants
# ---------------------------------------------------------
sheets = SheetsClient(spreadsheet_id=os.getenv("SPREADSHEET_ID"))

TABLE_TO_SHEET = {
    "customers": "Customer_Auth",
    "customer_auth": "Customer_Auth",
    "menu": "Menu",
    "orders": "Orders",
    "order_items": "Order_Items",
    "customer_preferences": "Customer_Preferences",
    "customer_activities": "Customer_Activities",
    "customer_insights": "Customer_Insights",
    "reviews": "Customer_Reviews",
    "chats": "Chats",
    "campaigns": "Campaigns"
}

# Explicit mapping from Google Sheet Header (provided by USER) to SQLite columns
# Format: { "Sheet_Name": { "Sheet_Header": "SQLite_Column" } }
SHEET_COLUMN_MAPPING = {
    "Menu": {
        "Item_ID": "item_id", "Item_Name": "name", "Item_Category": "category",
        "Base_Price": "base_price", "Low_Cap_Price": "low_cap_price", "High_Cap_Price": "high_cap_price",
        "Current_Price": "current_price", "Item_Description": "description", "Is_Active": "is_active"
    },
    "Customer_Auth": {
        "Customer_ID": "customer_id", "Customer_Name": "name", "Customer_Email": "email",
        "Customer_Phone": "phone", "Date_of_Birth": "date_of_birth", "OTP_Hash": "otp_hash",
        "OTP_Expires_At": "otp_expires_at", "Creation_DateTime": "created_at",
        "Last_Login_DateTime": "last_login", "Customer_Category": "customer_category",
        "Table_Number": "table_number"
    },
    "Customer_Preferences": {
        "Customer_ID": "customer_id", "Customer_Name": "customer_name", "Customer_Email": "customer_email",
        "Dietary_Type": "dietary_type", "Preferred_Soup": "preferred_soup",
        "Favorite_Bun": "favorite_bun", "Dessert_Preference": "dessert_preference", "Timestamp": "updated_at"
    },
    "Customer_Activities": {
        "Customer_ID": "customer_id", "Customer_Name": "customer_name", "Customer_Email": "customer_email",
        "Activities": "activities", "Timestamp": "created_at", "Insights": "insights"
    },
    "Customer_Insights": {
        "Customer_ID": "customer_id", "Customer_Name": "customer_name", "Dietary": "dietary",
        "Favorites": "favorites", "AOV": "aov", "Frequency": "frequency",
        "Attitude": "attitude", "Customer_Score": "customer_score"
    },
    "Customer_Reviews": {
        "Review_ID": "review_id", "Customer_ID": "customer_id", "Customer_Name": "customer_name",
        "Customer_Email": "customer_email", "Review_Date_Time": "review_datetime",
        "Food_Quality": "food_quality", "Service": "service", "Cleanliness": "cleanliness",
        "Value_For_Money": "value_for_money", "Overall_Experience": "overall_experience",
        "Additional_Comments": "comments", "Review_Type": "review_type", "Urgency": "urgency",
        "Assigned_To": "assigned_to", "Actions_Needed": "actions_needed",
        "Internal_Comments": "internal_comments", "Status": "status"
    },
    "Orders": {
        "Order_ID": "order_id", "Customer_ID": "customer_id", "Customer_Name": "customer_name",
        "Order_Price": "order_price", "Order_Created_DateTime": "created_at",
        "Order_Status": "status", "Table_Number": "table_number"
    },
    "Order_Items": {
        "Order_Item_ID": "order_item_id", "Order_ID": "order_id", "Item_ID": "item_id",
        "Item_Name": "item_name", "Item_Quantity": "quantity", "Item_Price": "price"
    },
    "Chats": {
        "Chat_ID": "chat_id", "Customer_ID": "customer_id", "Customer_Name": "customer_name",
        "Customer_Phone": "customer_phone", "Customer_Email": "customer_email",
        "Chat_Date_Time": "chat_datetime", "Chat_Session_Text": "session_text"
    },
    "Campaigns": {
        "Campaign_ID": "campaign_id", "Campaign_Text": "text", "Target_Customer_Category": "target_customer_category",
        "Campaign_Start_DateTime": "start_datetime", "Campaign_End_DateTime": "end_datetime",
        "Campaign_Message_Count": "message_count", "Campaign_Type": "campaign_type", "Campaign_Status": "status"
    }
}

# Add flattened Campaign message columns
for i in range(1, 11):
    SHEET_COLUMN_MAPPING["Campaigns"][f"Message_Template #{i}"] = f"message_template_{i}"
    SHEET_COLUMN_MAPPING["Campaigns"][f"Message_Send_Timing #{i}"] = f"message_send_timing_{i}"

# ---------------------------------------------------------
# Data Enrichment & Mapping Helpers
# ---------------------------------------------------------

def _get_enriched_data(table: str, data: dict) -> dict:
    """
    Fetches missing fields (like Customer Name) from related tables.
    Returns a cloned dict with extra fields.
    """
    enriched = data.copy()
    
    # 1. Enrichment for tables needing Customer Info
    needs_customer = ["orders", "reviews", "customer_preferences", "customer_activities", "customer_insights", "chats"]
    if table in needs_customer and "customer_id" in data:
        row = sqlite_db.fetch_one("SELECT name, email, phone FROM customers WHERE customer_id = ?", (data["customer_id"],))
        if row:
            enriched["customer_name"] = row["name"]
            enriched["customer_email"] = row["email"]
            enriched["customer_phone"] = row["phone"]

    # 2. Enrichment for Order Items needing Item Name
    if table == "order_items" and "item_id" in data:
        row = sqlite_db.fetch_one("SELECT name FROM menu WHERE item_id = ?", (data["item_id"],))
        if row:
            enriched["item_name"] = row["name"]

    # 3. Enrichment for Customer_Auth merge
    if table == "customers" and "customer_id" in data:
        row = sqlite_db.fetch_one("SELECT otp_hash, otp_expires_at FROM customer_auth WHERE customer_id = ?", (data["customer_id"],))
        if row:
            enriched.update(dict(row))
    elif table == "customer_auth" and "customer_id" in data:
        row = sqlite_db.fetch_one("SELECT name, email, phone, date_of_birth, created_at, last_login, customer_category, table_number FROM customers WHERE customer_id = ?", (data["customer_id"],))
        if row:
            enriched.update(dict(row))

    return enriched

def _map_to_sheet_row(sheet_name: str, data: dict, headers: list) -> list:
    """ Maps an enriched data dict to a list ordered by sheet headers. """
    mapping = SHEET_COLUMN_MAPPING.get(sheet_name, {})
    row = []
    for h in headers:
        # Match header to SQLite column name via mapping, or fallback to normalized header
        sqlite_col = mapping.get(h) or h.lower().replace(" ", "_")
        val = data.get(sqlite_col, "")
        
        # Format boolean for sheet
        if isinstance(val, bool):
            val = "TRUE" if val else "FALSE"
        # Format numeric Is_Active
        if h == "Is_Active" and isinstance(val, int):
            val = "ACTIVE" if val == 1 else "INACTIVE"
            
        row.append(val)
    return row

# ---------------------------------------------------------
# Core Sync Functions
# ---------------------------------------------------------

async def perform_full_sync():
    """ Runs a full re-sync of all major tables to Google Sheets. """
    print("Starting FULL synchronization to Google Sheets...")
    for table, sheet_name in TABLE_TO_SHEET.items():
        if table == "customer_auth": continue # Handled by customers table sync
        
        try:
            print(f"Refreshing '{sheet_name}' from table '{table}'...")
            # Fetch all data from table
            raw_rows = sqlite_db.fetch_all(f"SELECT * FROM {table}")
            enriched_rows = [_get_enriched_data(table, r) for r in raw_rows]
            
            # Get headers from Sheet
            try:
                # We need a sample to get headers if we don't want to hardcode them
                # But we can read the sheet once.
                df_existing = sheets.read_sheet(sheet_name)
                headers = df_existing.columns.tolist()
            except Exception:
                # Fallback to hardcoded headers if sheet is totally empty/missing
                headers = list(SHEET_COLUMN_MAPPING.get(sheet_name, {}).keys())
            
            if not headers:
                print(f"WARNING: No headers found for {sheet_name}. Mapping failed.")
                continue
                
            # Build DataFrame for update
            mapped_rows = [_map_to_sheet_row(sheet_name, r, headers) for r in enriched_rows]
            df_new = pd.DataFrame(mapped_rows, columns=headers)
            
            sheets.update_sheet(sheet_name, df_new)
            print(f"Full sync completed for {sheet_name} ({len(raw_rows)} rows)")
        except Exception as e:
            print(f"ERROR: Failed full sync for {table}: {e}")

async def start_progressive_sync(interval_seconds: int = 15):
    """
    Background worker that runs indefinitely, popping update events 
    from sqlite_db.sync_queue and applying them to Google Sheets.
    """
    if not GOOGLE_SHEETS_SYNC:
        print("Google Sheets Sync is DISABLED in config.py.")
        sqlite_db.sync_queue.clear()
        return

    # Trigger a Full Sync on startup to ensure Sheet integrity
    print("Performing initial full sync to ensure Google Sheets are up to date...")
    await perform_full_sync()

    print("Progressive Sync Worker Started.")
    
    while True:
        try:
            # Pop all items currently in the queue
            items_to_sync = []
            if sqlite_db.sync_queue:
                items_to_sync, sqlite_db.sync_queue = sqlite_db.sync_queue[:], []
            
            if items_to_sync:
                print(f"Syncing {len(items_to_sync)} changes to Google Sheets...")
                
                # To handle "cleared/deleted" sheets properly, if action is UPDATE
                # or if we detect an empty target, we might just trigger full sync for that sheet.
                processed_sheets = set()
                
                for task in items_to_sync:
                    table = task.get("table")
                    action = task.get("action")
                    data = task.get("data")
                    sheet_name = TABLE_TO_SHEET.get(table, table)
                    
                    if action == "INSERT":
                        try:
                            # 1. Enrich data
                            enriched = _get_enriched_data(table, data)
                            
                            # 2. Get Headers
                            df_existing = sheets.read_sheet(sheet_name)
                            headers = df_existing.columns.tolist()
                            
                            # 3. Map & Append
                            row = _map_to_sheet_row(sheet_name, enriched, headers)
                            sheets.append_row(sheet_name, row)
                        except Exception as e:
                            print(f"WARNING: Failed progressive sync (INSERT) for {table}: {e}")
                    
                    elif action == "UPDATE":
                        # For updates, we just perform a full sync on that specific sheet 
                        # to keep handles correct (unless we implement row-lookup logic).
                        if sheet_name not in processed_sheets:
                            try:
                                # Re-read table and push
                                raw_rows = sqlite_db.fetch_all(f"SELECT * FROM {table}")
                                enriched_rows = [_get_enriched_data(table, r) for r in raw_rows]
                                
                                df_existing = sheets.read_sheet(sheet_name)
                                headers = df_existing.columns.tolist()
                                
                                mapped_rows = [_map_to_sheet_row(sheet_name, r, headers) for r in enriched_rows]
                                df_new = pd.DataFrame(mapped_rows, columns=headers)
                                
                                sheets.update_sheet(sheet_name, df_new)
                                processed_sheets.add(sheet_name)
                            except Exception as e:
                                print(f"WARNING: Failed progressive sync (UPDATE) for {table}: {e}")
        
        except Exception as e:
            print(f"ERROR: Error in progressive sync worker: {e}")
            
        await asyncio.sleep(interval_seconds)
