# DineIQ\Backend\services\sheets.py

# ---------------------------------------------------------
# Library and Packages Import
# ---------------------------------------------------------
import os
import time
import pandas as pd
# from google.oauth2.service_account import Credentials
# from googleapiclient.discovery import build

# ---------------------------------------------------------
# Load environment variables from .env file
# ---------------------------------------------------------
from dotenv import load_dotenv
load_dotenv()

# ---------------------------------------------------------
# Class definition for Google Sheets interactions
# ---------------------------------------------------------
class SheetsClient:

    # -------------------------------------------------------------------
    # 🔧 SETUP: Google Sheets
    # Created a new project 'DineIQ Project' in Google Cloud Account.
    # Enabled Google Sheets API for this project.
    # Created a service account 'DineIQ Service Account' with Editor role.
    # Created a new JSON key by clicking on the service account email.
    # Key 'dineIQ_service_account.json' is downloaded, move it to project folder.
    # Added [SERVICE_ACCOUNT_FILE = "dineIQ_service_account.json"] in .env file.
    # -------------------------------------------------------------------
    SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

    # ------------------------------------------------------------------
    # Menu Read Cache — TTL in seconds (default: 5 minutes)
    # Applies to read_sheet() and read_sheet_rows() calls.
    # Override per instance: client.CACHE_TTL_SECONDS = 300
    # Disable entirely:     client.CACHE_TTL_SECONDS = 0
    # ------------------------------------------------------------------
    CACHE_TTL_SECONDS: int = 300

    def __init__(self, spreadsheet_id: str, service_account_file: str | None = None):
        """
        :param spreadsheet_id: Google Spreadsheet ID
        :param service_account_file: Path to service account JSON.
                                     Defaults to SERVICE_ACCOUNT_FILE env var.
        """
        self.spreadsheet_id = spreadsheet_id
        self.service_account_file = (
            service_account_file or os.getenv("SERVICE_ACCOUNT_FILE")
        )

        if not self.service_account_file:
            raise ValueError("SERVICE_ACCOUNT_FILE is not set")

        # In-memory cache: { sheet_name: (timestamp, DataFrame) }
        self._cache: dict[str, tuple[float, pd.DataFrame]] = {}

        self._service = self.init_service()

    # -------------------------------------------------------------------
    # 🔐 Init
    # -------------------------------------------------------------------
    def init_service(self):
        from google.oauth2.service_account import Credentials
        credentials = Credentials.from_service_account_file(
            self.service_account_file,
            scopes=self.SCOPES,
        )
        from googleapiclient.discovery import build
        service = build("sheets", "v4", credentials=credentials)
        return service.spreadsheets()

    # -------------------------------------------------------------------
    # Retry mechanism to handle SSL or temporary network errors
    # -------------------------------------------------------------------
    def _execute_with_retry(self, request, retries=3, delay=1):
        """Helper to retry API calls on SSL or temporary network errors"""
        for i in range(retries):
            try:
                return request.execute()
            except Exception as e:
                # Catching general Exception but specifically looking for SSL/Connection errors in logs
                import time
                if i < retries - 1:
                    print(f"⚠️ Sheets API Error (Attempt {i+1}/{retries}): {e}. Retrying in {delay}s...")
                    time.sleep(delay)
                    delay *= 2 # Exponential backoff
                else:
                    print(f"❌ Sheets API Operation Failed after {retries} attempts: {e}")
                    raise e

    # -------------------------------------------------------------------
    # 📖 Read  (with TTL cache)
    # -------------------------------------------------------------------
    def read_sheet(self, sheet_name: str, bypass_cache: bool = False) -> pd.DataFrame:
        """
        Read a Google Sheet into a pandas DataFrame (auto-pads rows).

        Results are cached in-memory for CACHE_TTL_SECONDS (default 5 min).
        Pass bypass_cache=True to force a fresh read regardless of TTL.
        Call invalidate_cache(sheet_name) after writes to keep data fresh.
        """
        now = time.monotonic()
        ttl = self.CACHE_TTL_SECONDS

        # --- Cache hit ---
        if not bypass_cache and ttl > 0 and sheet_name in self._cache:
            cached_at, cached_df = self._cache[sheet_name]
            if now - cached_at < ttl:
                print(f"📦 [Cache HIT] '{sheet_name}' (age {int(now - cached_at)}s)")
                return cached_df.copy()   # return a copy so callers can mutate safely

        # --- Cache miss: fetch from Sheets API ---
        print(f"🌐 [Cache MISS] Fetching '{sheet_name}' from Google Sheets...")
        request = self._service.values().get(
            spreadsheetId=self.spreadsheet_id,
            range=f"{sheet_name}!A:ZZ",
        )
        result = self._execute_with_retry(request)

        values = result.get("values", [])
        if not values:
            raise ValueError(f"No data found in sheet '{sheet_name}'.")

        headers, rows = values[0], values[1:]

        clean_rows = [
            r + [""] * (len(headers) - len(r)) if len(r) < len(headers) else r[:len(headers)]
            for r in rows
        ]

        df = pd.DataFrame(clean_rows, columns=headers)

        # Store in cache
        if ttl > 0:
            self._cache[sheet_name] = (now, df)

        return df.copy()

    # -------------------------------------------------------------------
    # 📖 Read - Lightweight Reader (non-pandas), uses cache via read_sheet
    # -------------------------------------------------------------------
    def read_sheet_rows(self, sheet_name: str, bypass_cache: bool = False) -> list[dict]:
        """
        Return a list of dicts from a Google Sheet.
        Internally reuses the read_sheet cache to avoid duplicate API calls.
        """
        df = self.read_sheet(sheet_name, bypass_cache=bypass_cache)
        headers = df.columns.tolist()
        return [
            dict(zip(headers, row))
            for row in df.values.tolist()
        ]

    # -------------------------------------------------------------------
    # 🗑️ Cache Invalidation
    # -------------------------------------------------------------------
    def invalidate_cache(self, sheet_name: str | None = None):
        """
        Invalidate cache for a specific sheet, or ALL sheets if sheet_name is None.
        Call this after any write operation to ensure the next read is fresh.

        Example:
            sheets.append_row("Orders", row)
            sheets.invalidate_cache("Orders")   # force fresh on next read
        """
        if sheet_name is None:
            self._cache.clear()
            print("🗑️ [Cache] All sheets invalidated")
        elif sheet_name in self._cache:
            del self._cache[sheet_name]
            print(f"🗑️ [Cache] '{sheet_name}' invalidated")

    # -------------------------------------------------------------------
    # ✍️ Update columns in sheet
    # -------------------------------------------------------------------
    def update_sheet(
        self,
        sheet_name: str,
        df: pd.DataFrame,
        columns_to_update: list[str] | None = None,
    ):
        """
        Update specific columns in a Google Sheet without clearing the sheet.
        - Preserves formatting & dropdowns
        - Supports non-contiguous columns
        - Minimizes write operations
        """
        if columns_to_update is None:
            columns_to_update = df.columns.tolist()

        print(f"\n📝 Updating columns individually: {', '.join(columns_to_update)}")

        for col in columns_to_update:
            if col not in df.columns:
                print(f"⚠️ Column '{col}' not found in DataFrame — skipping.")
                continue

            col_idx = df.columns.get_loc(col) + 1
            col_letter = self._col_letter(col_idx)

            # Serialize each value to a JSON-safe native Python type
            values = [[self._serialize_value(v)] for v in df[col].tolist()]

            request = self._service.values().update(
                spreadsheetId=self.spreadsheet_id,
                range=f"{sheet_name}!{col_letter}2",
                valueInputOption="RAW",
                body={"values": values},
            )
            self._execute_with_retry(request)
            print(f"✅ Column '{col}' updated ({col_letter})")

        self.invalidate_cache(sheet_name)
        print(f"✅ Partial update completed for sheet '{sheet_name}'.")

    # -------------------------------------------------------------------
    # ✍️ Append a single row at the end of the sheet.
    # -------------------------------------------------------------------
    def append_row(self, sheet_name: str, row: list):
        """
        Append a single row at the end of the sheet.
        """
        request = self._service.values().append(
            spreadsheetId=self.spreadsheet_id,
            range=f"{sheet_name}!A:ZZ",
            valueInputOption="RAW",
            insertDataOption="INSERT_ROWS",
            body={"values": [row]},
        )
        self._execute_with_retry(request)
        self.invalidate_cache(sheet_name)

    # -------------------------------------------------------------------
    # ✍️ Update a cell in sheet
    # -------------------------------------------------------------------
    def update_cell(self, sheet_name: str, cell: str, value):
        """
        Update a single cell in a Google Sheet.
        Example: update_cell("Customer_Auth", "H2", "2026-01-01 10:30:00")
        """
        request = self._service.values().update(
            spreadsheetId=self.spreadsheet_id,
            range=f"{sheet_name}!{cell}",
            valueInputOption="RAW",
            body={"values": [[value]]},
        )
        self._execute_with_retry(request)
        self.invalidate_cache(sheet_name)

    # -------------------------------------------------------------------
    # 🔠 Utilities
    # -------------------------------------------------------------------
    @staticmethod
    def _serialize_value(v):
        """
        Convert numpy scalar types to native Python types so they are
        JSON-serializable and stored correctly in Google Sheets via RAW mode.
        - numpy.int* → Python int
        - numpy.float* → Python float (NaN → "")
        - Everything else passes through unchanged.
        """
        import math
        type_name = type(v).__name__
        if type_name.startswith("int") or type_name in ("int8", "int16", "int32", "int64"):
            return int(v)
        if type_name.startswith("float") or type_name in ("float16", "float32", "float64"):
            return "" if math.isnan(v) else float(v)
        return v

    @staticmethod
    def _col_letter(n: int) -> str:
        """Convert 1-based column index to A, B, ..., AA, AB, etc."""
        result = ""
        while n > 0:
            n, remainder = divmod(n - 1, 26)
            result = chr(65 + remainder) + result
        return result
