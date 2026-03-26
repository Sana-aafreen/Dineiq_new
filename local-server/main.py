from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Query
from fastapi.websockets import WebSocket
from fastapi.staticfiles import StaticFiles
import uvicorn, json, asyncio
from datetime import datetime
from pathlib import Path
import os
from urllib.request import Request, urlopen
from db import init_db, get_db
from sync import SyncEngine

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# All connected WebSocket clients (kitchen, manager, waiters)
clients: list[WebSocket] = []

# Global sync engine instance
sync_engine: SyncEngine = None


def _get_cloud_api_base() -> str:
    return (
        os.getenv("CLOUD_API_BASE")
        or os.getenv("BACKEND_API_URL")
        or "http://localhost:8001"
    ).rstrip("/")


def _get_backend_sqlite_path() -> Path:
    default_path = Path(__file__).resolve().parents[1] / "Backend" / "sqliteDB" / "DineIQ_Database.db"
    return Path(os.getenv("BACKEND_SQLITE_PATH", str(default_path)))


def _build_menu_sections(menu_items: list[dict]) -> dict:
    def format_item(item: dict) -> dict:
        return {
            "Item_ID": item.get("item_id"),
            "Item_Name": item.get("name", ""),
            "Item_Category": item.get("category", "Other"),
            "Current_Price": float(item.get("current_price") or 0),
            "Item_Description": item.get("description", ""),
            "Is_Veg": False,
        }

    active_items = [item for item in menu_items if item.get("is_active", 1)]
    menu_sections: dict[str, list[dict]] = {}

    chef_specials = sorted(
        active_items,
        key=lambda item: float(item.get("current_price") or 0),
        reverse=True,
    )[:8]
    if chef_specials:
        menu_sections["Chef Special"] = [format_item(item) for item in chef_specials]

    for item in active_items:
        category = str(item.get("category") or "Other").strip() or "Other"
        menu_sections.setdefault(category, []).append(format_item(item))

    return {
        "status": "success",
        "menu_sections": menu_sections,
        "total_items": len(active_items),
        "categories": list(menu_sections.keys()),
        "source": "local_sqlite",
    }


async def _refresh_menu_payload_from_backend(customer_email: str = "guest@dineiq.com") -> dict | None:
    backend_menu_url = f"{_get_cloud_api_base()}/menu"
    normalized_email = (customer_email or "guest@dineiq.com").strip().lower()
    payload = json.dumps({"customer_email": normalized_email}).encode("utf-8")
    request = Request(
        backend_menu_url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        response = await asyncio.to_thread(urlopen, request, timeout=10)
        body = response.read().decode("utf-8")
        menu_payload = json.loads(body)
        if menu_payload.get("status") == "success" and menu_payload.get("menu_sections"):
            get_db().save_menu_payload(menu_payload, normalized_email)
            return menu_payload
    except Exception as exc:
        print(f"Local menu refresh from backend failed for {normalized_email}: {exc}")

    return None

@app.on_event("startup")
async def startup():
    global sync_engine
    init_db()
    imported_menu_items = get_db().sync_menu_from_backend(str(_get_backend_sqlite_path()))
    print(f"Local menu sync imported {imported_menu_items} items from backend SQLite")
    await _refresh_menu_payload_from_backend()

    # Initialize sync engine
    sync_engine = SyncEngine(
        db=get_db(),
        cloud_api_base=_get_cloud_api_base(),
        max_retries=3,
        sync_interval_seconds=30
    )

    # Start background sync
    asyncio.create_task(sync_engine.start())
    print("🚀 Local server started with cloud sync enabled")

@app.on_event("shutdown")
async def shutdown():
    if sync_engine:
        await sync_engine.stop()
    print("🛑 Local server shutdown")

# WebSocket hub — all LAN devices subscribe here
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    clients.append(ws)
    try:
        while True:
            await ws.receive_text()  # keep alive
    except:
        clients.remove(ws)

async def broadcast(data: dict):
    for client in clients:
        try:
            await client.send_json(data)
        except:
            clients.remove(client)

# Same route shape as your cloud API
@app.post("/orders")
async def create_order(order: dict):
    db = get_db()
    conn = db.get_connection()
    order_id = db.generate_order_id()
    now = datetime.utcnow().isoformat()
    items = order.get("cart_items") or order.get("items") or []
    table_no = order.get("table_number") or order.get("table_no") or ""
    customer_email = (order.get("customer_email") or "guest@dineiq.com").strip().lower()
    customer_name = order.get("customer_name") or "Guest"
    total_amount = order.get("final_total") or order.get("total_amount") or 0
    payment_method = order.get("payment_method") or "CASH"
    instructions = order.get("instructions") or order.get("special_instructions") or ""
    conn.execute(
        """
        INSERT INTO orders (
            id, table_no, items, customer_email, customer_name, total_amount,
            payment_method, special_instructions, status, sync_status,
            created_at, updated_at
        )
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        """,
        (
            order_id,
            str(table_no),
            json.dumps(items),
            customer_email,
            customer_name,
            total_amount,
            payment_method,
            instructions,
            "pending",
            "pending_sync",
            now,
            now,
        )
    )
    conn.commit()
    conn.close()
    payload = {
        "event": "new_order",
        "order_id": order_id,
        "table_no": str(table_no),
        "customer_email": customer_email,
        "customer_name": customer_name,
        "items": items,
        "total_amount": total_amount,
        "payment_method": payment_method,
        "special_instructions": instructions,
        "status": "pending",
        "sync_status": "pending_sync",
        "created_at": now,
    }
    await broadcast(payload)
    return {"id": order_id, "status": "queued", "source": "local_server"}


@app.post("/menu")
async def get_local_menu(body: dict | None = None):
    customer_email = ((body or {}).get("customer_email") or "guest@dineiq.com").strip().lower()

    backend_payload = await _refresh_menu_payload_from_backend(customer_email)
    if backend_payload:
        return {
            **backend_payload,
            "source": "backend_menu_live",
        }

    cached_payload = get_db().get_menu_payload(customer_email) or get_db().get_menu_payload("guest@dineiq.com")
    if cached_payload:
        return {
            **cached_payload,
            "source": cached_payload.get("source", "backend_menu_cache"),
        }

    menu_items = get_db().get_active_menu_items()
    return _build_menu_sections(menu_items)


@app.post("/menu/refresh")
async def refresh_local_menu(body: dict | None = None):
    customer_email = ((body or {}).get("customer_email") or "guest@dineiq.com").strip().lower()
    imported = get_db().sync_menu_from_backend(str(_get_backend_sqlite_path()))
    backend_payload = await _refresh_menu_payload_from_backend(customer_email)
    if backend_payload:
        return {
            "message": f"Refreshed local menu from backend menu payload ({imported} sqlite items)",
            **backend_payload,
            "source": "backend_menu_cache",
        }

    menu_items = get_db().get_active_menu_items()
    return {
        "message": f"Refreshed local menu from backend SQLite ({imported} items)",
        **_build_menu_sections(menu_items),
    }

@app.get("/orders")
def get_orders(
    email: str | None = Query(default=None),
    table_no: str | None = Query(default=None),
):
    conn = get_db().get_connection()
    query = "SELECT * FROM orders"
    conditions = []
    params = []

    if email:
        conditions.append("LOWER(customer_email) = ?")
        params.append(email.strip().lower())
    if table_no:
        conditions.append("table_no = ?")
        params.append(str(table_no))

    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += " ORDER BY created_at DESC"

    rows = conn.execute(query, tuple(params)).fetchall()
    conn.close()
    formatted = []
    for row in rows:
      item_list = json.loads(row["items"]) if row["items"] else []
      formatted.append({
          "id": row["id"],
          "order_id": row["id"],
          "table_number": row["table_no"],
          "customer_email": row["customer_email"],
          "customer_name": row["customer_name"] or "Guest",
          "items": item_list,
          "total_amount": row["total_amount"] or 0,
          "payment_method": row["payment_method"] or "CASH",
          "special_instructions": row["special_instructions"] or "",
          "status": row["status"],
          "sync_status": row["sync_status"],
          "cloud_order_id": row["cloud_order_id"],
          "created_at": row["created_at"],
          "updated_at": row["updated_at"],
      })
    return formatted

@app.patch("/orders/{order_id}/status")
async def update_status(order_id: str, body: dict):
    conn = get_db().get_connection()
    conn.execute("UPDATE orders SET status=?, updated_at=? WHERE id=?",
                 (body["status"], datetime.utcnow().isoformat(), order_id))
    conn.commit()
    conn.close()
    await broadcast({"event": "status_update", "order_id": order_id, **body})
    return {"ok": True}

# Trigger sync manually or on a timer
@app.post("/sync")
async def trigger_sync():
    if not sync_engine:
        return {"error": "Sync engine not initialized"}
    result = await sync_engine.sync_pending_orders()
    return result

@app.get("/health")
async def health():
    """Health check with sync status"""
    if not sync_engine:
        return {"status": "error", "message": "Sync engine not initialized"}

    stats = await sync_engine.get_sync_stats()
    return {
        "status": "healthy",
        "sync": stats,
        "menu_items": len(get_db().get_active_menu_items()),
        "timestamp": datetime.now().isoformat(),
        "websocket_clients": len(clients)
    }

@app.post("/sync/retry-failed")
async def retry_failed_orders():
    """Manually retry all failed orders"""
    if not sync_engine:
        return {"error": "Sync engine not initialized"}

    conn = get_db().get_connection()
    failed_orders = conn.execute(
        "SELECT * FROM orders WHERE sync_status = 'failed'"
    ).fetchall()
    conn.close()

    results = []
    for order_row in failed_orders:
        order_dict = dict(order_row)
        success = await sync_engine._sync_order_with_retry(
            order_dict["id"], order_dict, 0
        )
        results.append({"order_id": order_dict["id"], "success": success})

    return {
        "message": f"Retried {len(results)} orders",
        "results": results
    }


def _mount_static_frontends():
    root_dir = Path(__file__).resolve().parents[1]
    webapp_override = Path(
        os.getenv("WEBAPP_DIST_DIR", str(root_dir / "Frontend" / "Webapp" / "dist"))
    )
    dashboard_override = Path(
        os.getenv("DASHBOARD_DIST_DIR", str(root_dir / "Frontend" / "Dashboard" / "dist"))
    )

    if dashboard_override.exists():
        app.mount("/dashboard", StaticFiles(directory=str(dashboard_override), html=True), name="dashboard-ui")

    if webapp_override.exists():
        app.mount("/", StaticFiles(directory=str(webapp_override), html=True), name="webapp-ui")


_mount_static_frontends()

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8002)
