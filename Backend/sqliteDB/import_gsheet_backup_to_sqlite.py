import json
import sqlite3
import sys
from pathlib import Path


BACKUP_FILES = {
    "menu": "menu.json",
    "orders": "orders.json",
    "order_items": "order_items.json",
    "customers": "customer_auth.json",
    "customer_insights": "customer_insights.json",
    "customer_preferences": "customer_preferences.json",
    "chats": "chats.json",
    "customer_activities": "customer_activities.json",
    "reviews": "customer_reviews.json",
    "campaigns": "campaigns.json",
}


def latest_backup_dir() -> Path:
    backup_root = Path(__file__).resolve().parent / "gsheet_backups"
    candidates = [p for p in backup_root.iterdir() if p.is_dir()] if backup_root.exists() else []
    if not candidates:
        raise FileNotFoundError("No gsheet_backups folders found. Run backup_gsheet_data.py first.")
    return sorted(candidates)[-1]


def load_json_rows(backup_dir: Path, filename: str) -> list[dict]:
    file_path = backup_dir / filename
    if not file_path.exists():
        return []
    with open(file_path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def insert_or_replace(conn: sqlite3.Connection, table: str, row: dict):
    columns = list(row.keys())
    placeholders = ", ".join(["?"] * len(columns))
    sql = f"INSERT OR REPLACE INTO {table} ({', '.join(columns)}) VALUES ({placeholders})"
    conn.execute(sql, tuple(row[col] for col in columns))


def map_menu(rows: list[dict]) -> list[dict]:
    mapped = []
    for row in rows:
        mapped.append({
            "item_id": row.get("Item_ID"),
            "name": row.get("Item_Name", ""),
            "category": row.get("Item_Category", ""),
            "base_price": row.get("Base_Price") or 0,
            "low_cap_price": row.get("Low_Cap_Price") or 0,
            "high_cap_price": row.get("High_Cap_Price") or 0,
            "current_price": row.get("Current_Price") or 0,
            "description": row.get("Item_Description") or row.get("Description") or "",
            "is_active": 1 if str(row.get("Is_Active", "")).upper() in {"ACTIVE", "TRUE", "1", "YES"} else 0,
        })
    return mapped


def map_customers(rows: list[dict]) -> list[dict]:
    mapped = []
    for row in rows:
        mapped.append({
            "customer_id": row.get("Customer_ID"),
            "name": row.get("Customer_Name", ""),
            "email": row.get("Customer_Email", ""),
            "phone": row.get("Customer_Phone", ""),
            "date_of_birth": row.get("Date_of_Birth", ""),
            "customer_category": row.get("Customer_Category", ""),
            "table_number": row.get("Table_Number") or None,
            "created_at": row.get("Creation_DateTime", ""),
            "last_login": row.get("Last_Login_DateTime", ""),
        })
    return mapped


def map_orders(rows: list[dict]) -> list[dict]:
    return [{
        "order_id": row.get("Order_ID"),
        "customer_id": row.get("Customer_ID", ""),
        "order_price": row.get("Order_Price") or 0,
        "created_at": row.get("Order_Created_DateTime", ""),
        "status": row.get("Order_Status", ""),
        "table_number": row.get("Table_Number") or None,
    } for row in rows]


def map_order_items(rows: list[dict]) -> list[dict]:
    return [{
        "order_item_id": row.get("Order_Item_ID"),
        "order_id": row.get("Order_ID", ""),
        "item_id": row.get("Item_ID") or None,
        "quantity": row.get("Quantity") or row.get("Item_Quantity") or 0,
        "price": row.get("Price") or row.get("Item_Price") or 0,
    } for row in rows]


def map_customer_insights(rows: list[dict]) -> list[dict]:
    return [{
        "customer_id": row.get("Customer_ID"),
        "dietary": row.get("Dietary", ""),
        "favorites": row.get("Favorites", ""),
        "aov": row.get("AOV") or 0,
        "frequency": row.get("Frequency") or 0,
        "attitude": row.get("Attitude", ""),
        "customer_score": row.get("Customer_Score") or 0,
    } for row in rows]


def map_customer_preferences(rows: list[dict]) -> list[dict]:
    return [{
        "customer_id": row.get("Customer_ID"),
        "dietary_type": row.get("Dietary_Type", ""),
        "preferred_soup": row.get("Preferred_Soup", ""),
        "favorite_bun": row.get("Favorite_Bun", ""),
        "dessert_preference": row.get("Dessert_Preference", ""),
        "updated_at": row.get("Creation_DateTime", ""),
    } for row in rows]


def map_chats(rows: list[dict]) -> list[dict]:
    return [{
        "chat_id": row.get("Chat_ID"),
        "customer_id": row.get("Customer_ID", ""),
        "chat_datetime": row.get("Chat_DateTime", ""),
        "session_text": row.get("Chat_Session_Text", ""),
    } for row in rows]


def map_customer_activities(rows: list[dict]) -> list[dict]:
    return [{
        "customer_id": row.get("Customer_ID"),
        "activities": row.get("Activities") or row.get("activities") or "",
        "insights": row.get("Insights") or row.get("insights") or "",
        "created_at": row.get("Creation_DateTime") or row.get("created_at") or "",
    } for row in rows]


def map_reviews(rows: list[dict]) -> list[dict]:
    return [{
        "review_id": row.get("Review_ID"),
        "customer_id": row.get("Customer_ID", ""),
        "review_datetime": row.get("Review_Date_Time", ""),
        "food_quality": row.get("Food_Quality") or 0,
        "service": row.get("Service") or 0,
        "cleanliness": row.get("Cleanliness") or 0,
        "value_for_money": row.get("Value_For_Money") or 0,
        "overall_experience": row.get("Overall_Experience") or 0,
        "comments": row.get("Additional_Comments", ""),
        "review_type": row.get("Review_Type", ""),
        "urgency": row.get("Urgency", ""),
        "assigned_to": row.get("Assigned_To", ""),
        "actions_needed": row.get("Actions_Needed", ""),
        "internal_comments": row.get("Internal_Comments", ""),
        "status": row.get("Status", ""),
    } for row in rows]


def map_campaigns(rows: list[dict]) -> list[dict]:
    mapped = []
    for row in rows:
        mapped.append({
            "campaign_id": row.get("Campaign_ID"),
            "text": row.get("Campaign_Text") or row.get("Text") or "",
            "target_customer_category": row.get("Target_Customer_Category", ""),
            "start_datetime": row.get("Start_DateTime", ""),
            "end_datetime": row.get("End_DateTime", ""),
            "message_count": row.get("Message_Count") or 0,
            "campaign_type": row.get("Campaign_Type", ""),
            "status": row.get("Campaign_Status") or row.get("Status") or "",
            "message_template_1": row.get("Message_Template_1", ""),
            "message_send_timing_1": row.get("Message_Send_Timing_1", ""),
            "message_template_2": row.get("Message_Template_2", ""),
            "message_send_timing_2": row.get("Message_Send_Timing_2", ""),
            "message_template_3": row.get("Message_Template_3", ""),
            "message_send_timing_3": row.get("Message_Send_Timing_3", ""),
            "message_template_4": row.get("Message_Template_4", ""),
            "message_send_timing_4": row.get("Message_Send_Timing_4", ""),
            "message_template_5": row.get("Message_Template_5", ""),
            "message_send_timing_5": row.get("Message_Send_Timing_5", ""),
            "message_template_6": row.get("Message_Template_6", ""),
            "message_send_timing_6": row.get("Message_Send_Timing_6", ""),
            "message_template_7": row.get("Message_Template_7", ""),
            "message_send_timing_7": row.get("Message_Send_Timing_7", ""),
            "message_template_8": row.get("Message_Template_8", ""),
            "message_send_timing_8": row.get("Message_Send_Timing_8", ""),
            "message_template_9": row.get("Message_Template_9", ""),
            "message_send_timing_9": row.get("Message_Send_Timing_9", ""),
            "message_template_10": row.get("Message_Template_10", ""),
            "message_send_timing_10": row.get("Message_Send_Timing_10", ""),
        })
    return mapped


TABLE_MAPPERS = {
    "menu": ("menu", map_menu),
    "customers": ("customers", map_customers),
    "orders": ("orders", map_orders),
    "order_items": ("order_items", map_order_items),
    "customer_insights": ("customer_insights", map_customer_insights),
    "customer_preferences": ("customer_preferences", map_customer_preferences),
    "chats": ("chats", map_chats),
    "customer_activities": ("customer_activities", map_customer_activities),
    "reviews": ("reviews", map_reviews),
    "campaigns": ("campaigns", map_campaigns),
}


def main():
    backup_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else latest_backup_dir()
    db_path = Path(__file__).resolve().parent / "DineIQ_Database.db"

    if not backup_dir.exists():
        raise FileNotFoundError(f"Backup directory not found: {backup_dir}")

    conn = sqlite3.connect(db_path)
    try:
      conn.execute("PRAGMA foreign_keys = ON;")

      for backup_key, filename in BACKUP_FILES.items():
          table_name, mapper = TABLE_MAPPERS[backup_key]
          raw_rows = load_json_rows(backup_dir, filename)
          mapped_rows = mapper(raw_rows)

          imported = 0
          for row in mapped_rows:
              if not any(value not in (None, "") for value in row.values()):
                  continue
              insert_or_replace(conn, table_name, row)
              imported += 1

          print(f"Imported {imported} rows into {table_name}")

      conn.commit()
      print(f"\nSQLite restore completed from backup: {backup_dir}")
    finally:
      conn.close()


if __name__ == "__main__":
    main()
