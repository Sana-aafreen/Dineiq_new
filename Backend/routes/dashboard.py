from fastapi import APIRouter
import math
import json
from pathlib import Path

from services.dependencies import sheets

dashboard_router = APIRouter()

MIGRATION_SHEETS = {
    "Menu": "items",
    "Orders": "orders",
    "Order_Items": "order_items",
    "Customer_Auth": "customers",
    "Customer_Insights": "insights",
    "Customer_Preferences": "preferences",
    "Chats": "chats",
    "Customer_Activities": "activities",
    "Customer_Reviews": "reviews",
    "Campaigns": "campaigns",
}


def _safe_json_value(value):
    if isinstance(value, float) and math.isnan(value):
        return None
    return value


def _safe_json_rows(rows: list[dict]) -> list[dict]:
    normalized = []
    for row in rows:
        normalized.append({key: _safe_json_value(value) for key, value in row.items()})
    return normalized


def _latest_backup_summary():
    backup_root = Path(__file__).resolve().parents[1] / "sqliteDB" / "gsheet_backups"
    if not backup_root.exists():
        return None, None

    backup_dirs = sorted([path for path in backup_root.iterdir() if path.is_dir()])
    if not backup_dirs:
        return None, None

    latest_dir = backup_dirs[-1]
    summary_path = latest_dir / "backup_summary.json"
    if not summary_path.exists():
        return latest_dir.name, None

    with open(summary_path, "r", encoding="utf-8") as fh:
        return latest_dir.name, json.load(fh)


@dashboard_router.get("/menu")
async def get_dashboard_menu():
    return {"items": _safe_json_rows(sheets.read_sheet_rows("Menu"))}


@dashboard_router.get("/customers")
async def get_dashboard_customers():
    return {"customers": _safe_json_rows(sheets.read_sheet_rows("Customer_Auth"))}


@dashboard_router.get("/orders")
async def get_dashboard_orders():
    return {"orders": _safe_json_rows(sheets.read_sheet_rows("Orders"))}


@dashboard_router.get("/order-items")
async def get_dashboard_order_items():
    return {"order_items": _safe_json_rows(sheets.read_sheet_rows("Order_Items"))}


@dashboard_router.get("/analytics")
async def get_dashboard_analytics():
    return {
        "customers": _safe_json_rows(sheets.read_sheet_rows("Customer_Auth")),
        "orders": _safe_json_rows(sheets.read_sheet_rows("Orders")),
        "menu": _safe_json_rows(sheets.read_sheet_rows("Menu")),
        "insights": _safe_json_rows(sheets.read_sheet_rows("Customer_Insights")),
        "campaigns": _safe_json_rows(sheets.read_sheet_rows("Campaigns")),
        "chats": _safe_json_rows(sheets.read_sheet_rows("Chats")),
        "order_items": _safe_json_rows(sheets.read_sheet_rows("Order_Items")),
    }


@dashboard_router.get("/migration-status")
async def get_dashboard_migration_status():
    backup_timestamp, backup_summary = _latest_backup_summary()

    if not backup_timestamp:
        return {
            "status": "no_backup_found",
            "message": "No Google Sheets backup folder was found. Run backup_gsheet_data.py first.",
            "sheets": [],
        }

    if not backup_summary:
        return {
            "status": "backup_summary_missing",
            "message": "Latest backup exists but backup_summary.json is missing.",
            "backup_timestamp": backup_timestamp,
            "sheets": [],
        }

    sheet_statuses = []
    all_complete = True

    for sheet_name in MIGRATION_SHEETS.keys():
        backup_info = backup_summary.get(sheet_name, {})
        expected_rows = int(backup_info.get("rows", 0)) if isinstance(backup_info, dict) else 0
        sqlite_rows = len(sheets.read_sheet_rows(sheet_name))
        complete = sqlite_rows >= expected_rows and expected_rows > 0

        if expected_rows == 0 and sqlite_rows == 0:
            state = "empty"
        elif complete:
            state = "complete"
        elif sqlite_rows > 0:
            state = "partial"
            all_complete = False
        else:
            state = "missing"
            all_complete = False

        sheet_statuses.append({
            "sheet_name": sheet_name,
            "expected_rows": expected_rows,
            "sqlite_rows": sqlite_rows,
            "state": state,
        })

    return {
        "status": "complete" if all_complete else "incomplete",
        "backup_timestamp": backup_timestamp,
        "message": (
            "All backed-up Google Sheets rows appear to be present in SQLite."
            if all_complete
            else "Some backed-up Google Sheets data is still missing from SQLite."
        ),
        "sheets": sheet_statuses,
    }
