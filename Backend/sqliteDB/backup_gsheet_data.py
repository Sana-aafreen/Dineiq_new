import json
import os
import sys
from datetime import datetime
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv


BACKUP_SHEETS = [
    "Menu",
    "Orders",
    "Order_Items",
    "Customer_Auth",
    "Customer_Insights",
    "Customer_Preferences",
    "Chats",
    "Customer_Activities",
    "Customer_Reviews",
    "Campaigns",
]


def main():
    backend_dir = Path(__file__).resolve().parents[1]
    sys.path.append(str(backend_dir))

    load_dotenv(backend_dir / ".env")

    from services.sheets import SheetsClient

    spreadsheet_id = os.getenv("SPREADSHEET_ID")
    service_account_file = os.getenv("SERVICE_ACCOUNT_FILE")

    if not spreadsheet_id:
        raise ValueError("SPREADSHEET_ID is not set in Backend/.env")
    if not service_account_file:
        raise ValueError("SERVICE_ACCOUNT_FILE is not set in Backend/.env")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_root = Path(__file__).resolve().parent / "gsheet_backups" / timestamp
    backup_root.mkdir(parents=True, exist_ok=True)

    client = SheetsClient(
        spreadsheet_id=spreadsheet_id,
        service_account_file=service_account_file,
    )

    workbook_path = backup_root / "gsheet_backup.xlsx"
    summary: dict[str, dict] = {}

    with pd.ExcelWriter(workbook_path, engine="openpyxl") as writer:
        for sheet_name in BACKUP_SHEETS:
            try:
                df = client.read_sheet(sheet_name, bypass_cache=True)
                safe_name = sheet_name.lower()

                df.to_csv(backup_root / f"{safe_name}.csv", index=False)
                df.to_json(
                    backup_root / f"{safe_name}.json",
                    orient="records",
                    force_ascii=False,
                    indent=2,
                )
                df.to_excel(writer, sheet_name=sheet_name[:31], index=False)

                summary[sheet_name] = {
                    "rows": int(len(df.index)),
                    "columns": list(df.columns),
                }
                print(f"Backed up {sheet_name}: {len(df.index)} rows")
            except Exception as exc:
                summary[sheet_name] = {"error": str(exc)}
                print(f"Failed to back up {sheet_name}: {exc}")

    with open(backup_root / "backup_summary.json", "w", encoding="utf-8") as fh:
        json.dump(summary, fh, indent=2, ensure_ascii=False)

    print(f"\nGoogle Sheets backup saved to: {backup_root}")


if __name__ == "__main__":
    main()
