import os

from dotenv import load_dotenv

from services.db_compat import DbCompat
from services.sheets import SheetsClient
from services.sqlite import SQLiteClient


load_dotenv()


def sync_menu_from_google_sheets_to_sqlite() -> dict:
    """Refresh the SQLite menu table from the live Google Sheet."""
    spreadsheet_id = (os.getenv("SPREADSHEET_ID") or "").strip()
    service_account_file = (os.getenv("SERVICE_ACCOUNT_FILE") or "").strip()

    if not spreadsheet_id or not service_account_file:
        return {
            "status": "skipped",
            "message": "SPREADSHEET_ID or SERVICE_ACCOUNT_FILE is missing; menu sync skipped.",
            "rows": 0,
        }

    live_sheets = SheetsClient(
        spreadsheet_id=spreadsheet_id,
        service_account_file=service_account_file,
    )
    sqlite_db = SQLiteClient()
    sqlite_sheets = DbCompat(sqlite_db)

    menu_df = live_sheets.read_sheet("Menu", bypass_cache=True)
    sqlite_sheets.update_sheet("Menu", menu_df)

    return {
        "status": "success",
        "message": "SQLite menu refreshed from Google Sheets.",
        "rows": int(len(menu_df.index)),
    }
