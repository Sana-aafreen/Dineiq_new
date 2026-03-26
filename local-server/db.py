import sqlite3, json
from datetime import datetime
from pathlib import Path

DB_PATH = "dineiq_local.db"

class Database:
    """Database wrapper for local server operations"""

    def __init__(self, db_path=DB_PATH):
        self.db_path = db_path

    def get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def generate_order_id(self) -> str:
        """Generate local order IDs like Ord_0043."""
        conn = self.get_connection()
        try:
            cursor = conn.execute(
                """
                SELECT id
                FROM orders
                WHERE id LIKE 'Ord\_%' ESCAPE '\'
                ORDER BY CAST(SUBSTR(id, 5) AS INTEGER) DESC
                LIMIT 1
                """
            )
            row = cursor.fetchone()
            next_number = 1
            if row and row["id"]:
                try:
                    next_number = int(str(row["id"])[4:]) + 1
                except ValueError:
                    next_number = 1
            return f"Ord_{next_number:04d}"
        finally:
            conn.close()

    def count_orders(self) -> int:
        """Count total orders"""
        conn = self.get_connection()
        try:
            cursor = conn.execute("SELECT COUNT(*) FROM orders")
            return cursor.fetchone()[0]
        finally:
            conn.close()

    def count_orders_by_status(self, status: str) -> int:
        """Count orders by sync status"""
        conn = self.get_connection()
        try:
            cursor = conn.execute("SELECT COUNT(*) FROM orders WHERE sync_status = ?", (status,))
            return cursor.fetchone()[0]
        finally:
            conn.close()

    def get_orders_by_status(self, status: str) -> list:
        """Get all orders with a specific sync status"""
        conn = self.get_connection()
        try:
            cursor = conn.execute("SELECT * FROM orders WHERE sync_status = ?", (status,))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        finally:
            conn.close()

    def get_order(self, order_id: str) -> dict:
        """Get a single order by ID"""
        conn = self.get_connection()
        try:
            cursor = conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def get_active_menu_items(self) -> list[dict]:
        """Return all active menu items from the local SQLite copy."""
        conn = self.get_connection()
        try:
            cursor = conn.execute(
                """
                SELECT item_id, name, category, current_price, description, is_active, image_url, is_veg, section_name
                FROM menu
                WHERE COALESCE(is_active, 0) = 1
                ORDER BY row_order ASC, name ASC
                """
            )
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        finally:
            conn.close()

    def save_menu_payload(self, payload: dict, cache_key: str = "default"):
        conn = self.get_connection()
        try:
            now = datetime.utcnow().isoformat()
            conn.execute(
                """
                INSERT OR REPLACE INTO menu_cache (cache_key, payload_json, updated_at)
                VALUES (?, ?, ?)
                """,
                (cache_key, json.dumps(payload), now),
            )

            menu_sections = payload.get("menu_sections") or {}
            row_order = 1
            for section_name, items in menu_sections.items():
                if not isinstance(items, list):
                    continue
                for item in items:
                    item_id = str(item.get("Item_ID") or item.get("id") or f"{cache_key}_{row_order}")
                    conn.execute(
                        """
                        INSERT OR REPLACE INTO menu (
                            item_id,
                            name,
                            category,
                            base_price,
                            low_cap_price,
                            high_cap_price,
                            current_price,
                            description,
                            is_active,
                            row_order,
                            updated_at,
                            image_url,
                            is_veg,
                            section_name
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            item_id,
                            item.get("Item_Name") or item.get("name") or "",
                            item.get("Item_Category") or section_name or "Other",
                            float(item.get("Base_Price") or item.get("Current_Price") or item.get("price") or 0),
                            float(item.get("Low_Cap_Price") or 0),
                            float(item.get("High_Cap_Price") or 0),
                            float(item.get("Current_Price") or item.get("price") or 0),
                            item.get("Item_Description") or item.get("description") or "",
                            1,
                            row_order,
                            now,
                            item.get("Image_URL") or item.get("image") or "",
                            1 if str(item.get("Is_Veg") or item.get("isVeg") or "").strip().lower() == "true" else 0,
                            section_name,
                        ),
                    )
                    row_order += 1
            conn.commit()
        finally:
            conn.close()

    def get_menu_payload(self, cache_key: str = "default") -> dict | None:
        conn = self.get_connection()
        try:
            row = conn.execute(
                "SELECT payload_json FROM menu_cache WHERE cache_key = ?",
                (cache_key,),
            ).fetchone()
            if not row or not row["payload_json"]:
                return None
            return json.loads(row["payload_json"])
        finally:
            conn.close()

    def sync_menu_from_backend(self, source_db_path: str) -> int:
        """Copy menu rows from the main backend SQLite DB into local SQLite."""
        source_path = Path(source_db_path)
        if not source_path.exists():
            return 0

        source_conn = sqlite3.connect(str(source_path))
        source_conn.row_factory = sqlite3.Row
        local_conn = self.get_connection()

        try:
            source_rows = source_conn.execute(
                """
                SELECT
                    item_id,
                    name,
                    category,
                    base_price,
                    low_cap_price,
                    high_cap_price,
                    current_price,
                    description,
                    is_active
                FROM menu
                """
            ).fetchall()

            local_conn.execute("DELETE FROM menu")
            imported = 0

            for index, row in enumerate(source_rows, start=1):
                local_conn.execute(
                    """
                    INSERT OR REPLACE INTO menu (
                        item_id,
                        name,
                        category,
                        base_price,
                        low_cap_price,
                        high_cap_price,
                        current_price,
                        description,
                        is_active,
                        row_order,
                        updated_at,
                        image_url,
                        is_veg,
                        section_name
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        row["item_id"],
                        row["name"],
                        row["category"],
                        row["base_price"],
                        row["low_cap_price"],
                        row["high_cap_price"],
                        row["current_price"],
                        row["description"],
                        row["is_active"],
                        index,
                        datetime.utcnow().isoformat(),
                        "",
                        0,
                        row["category"],
                    ),
                )
                imported += 1

            local_conn.commit()
            return imported
        finally:
            source_conn.close()
            local_conn.close()

    def update_order_sync_status(
        self,
        order_id: str,
        status: str,
        cloud_order_id: str = None,
        error: str = None,
    ):
        """Update order sync status"""
        conn = self.get_connection()
        try:
            conn.execute(
                """
                UPDATE orders
                SET sync_status = ?, cloud_order_id = COALESCE(?, cloud_order_id),
                    sync_error = ?, updated_at = ?
                WHERE id = ?
                """,
                (status, cloud_order_id, error, datetime.now().isoformat(), order_id)
            )
            conn.commit()
        finally:
            conn.close()

# Global database instance
_db_instance = None

def get_db():
    """Get database instance (for backward compatibility)"""
    global _db_instance
    if _db_instance is None:
        _db_instance = Database()
    return _db_instance

def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS menu (
            item_id TEXT PRIMARY KEY,
            name TEXT,
            category TEXT,
            base_price REAL DEFAULT 0,
            low_cap_price REAL DEFAULT 0,
            high_cap_price REAL DEFAULT 0,
            current_price REAL DEFAULT 0,
            description TEXT,
            is_active INTEGER DEFAULT 1,
            row_order INTEGER DEFAULT 0,
            updated_at TEXT,
            image_url TEXT,
            is_veg INTEGER DEFAULT 0,
            section_name TEXT
        );

        CREATE TABLE IF NOT EXISTS menu_cache (
            cache_key TEXT PRIMARY KEY,
            payload_json TEXT,
            updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            table_no TEXT,
            items TEXT,        -- JSON string
            customer_email TEXT,
            customer_name TEXT,
            total_amount REAL DEFAULT 0,
            payment_method TEXT,
            special_instructions TEXT,
            status TEXT DEFAULT 'pending',
            sync_status TEXT DEFAULT 'pending_sync',
            cloud_order_id TEXT,
            sync_error TEXT,
            created_at TEXT,
            updated_at TEXT
        );
    """)

    # Keep older local DBs compatible by adding any missing columns.
    cursor = conn.execute("PRAGMA table_info(orders)")
    existing_columns = {row[1] for row in cursor.fetchall()}
    required_columns = {
        "customer_email": "TEXT",
        "customer_name": "TEXT",
        "total_amount": "REAL DEFAULT 0",
        "payment_method": "TEXT",
        "special_instructions": "TEXT",
        "cloud_order_id": "TEXT",
        "sync_error": "TEXT",
    }

    for column, ddl in required_columns.items():
        if column not in existing_columns:
            conn.execute(f"ALTER TABLE orders ADD COLUMN {column} {ddl}")

    menu_columns = {row[1] for row in conn.execute("PRAGMA table_info(menu)").fetchall()}
    required_menu_columns = {
        "base_price": "REAL DEFAULT 0",
        "low_cap_price": "REAL DEFAULT 0",
        "high_cap_price": "REAL DEFAULT 0",
        "current_price": "REAL DEFAULT 0",
        "description": "TEXT",
        "is_active": "INTEGER DEFAULT 1",
        "row_order": "INTEGER DEFAULT 0",
        "updated_at": "TEXT",
        "image_url": "TEXT",
        "is_veg": "INTEGER DEFAULT 0",
        "section_name": "TEXT",
    }

    for column, ddl in required_menu_columns.items():
        if column not in menu_columns:
            conn.execute(f"ALTER TABLE menu ADD COLUMN {column} {ddl}")

    conn.commit()
    conn.close()
