"""
Cloud Sync Engine for Local DineIQ Server
Periodically syncs local orders to cloud API with conflict resolution and retry logic
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from enum import Enum
import httpx
from db import get_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SyncStatus(str, Enum):
    """Order sync status"""
    PENDING_SYNC = "pending_sync"
    SYNCED = "synced"
    CONFLICT = "conflict"
    FAILED = "failed"


class ConflictType(str, Enum):
    """Types of sync conflicts"""
    QUANTITY_MISMATCH = "quantity_mismatch"
    PRICE_MISMATCH = "price_mismatch"
    STATUS_MISMATCH = "status_mismatch"
    ALREADY_EXISTS = "already_exists"


class SyncEngine:
    """Manages syncing orders from local server to cloud"""

    def __init__(
        self,
        db: Any,
        cloud_api_base: str,
        max_retries: int = 3,
        retry_delay_seconds: int = 5,
        sync_interval_seconds: int = 30,
    ):
        """
        Initialize sync engine

        Args:
            db: Database instance
            cloud_api_base: Base URL of cloud API (e.g., https://dineiq-backend.in)
            max_retries: Maximum retry attempts per order
            retry_delay_seconds: Initial delay between retries (exponential backoff)
            sync_interval_seconds: How often to check for pending syncs
        """
        self.db = db
        self.cloud_api_base = cloud_api_base.rstrip("/")
        self.max_retries = max_retries
        self.retry_delay_seconds = retry_delay_seconds
        self.sync_interval_seconds = sync_interval_seconds
        self.is_syncing = False
        self.httpx_client = httpx.AsyncClient(timeout=10.0)
        self.is_running = False

    async def start(self) -> None:
        """Start the sync engine background task"""
        if self.is_running:
            logger.warning("Sync engine already running")
            return

        self.is_running = True
        logger.info(f"Sync engine started (interval: {self.sync_interval_seconds}s)")

        try:
            while self.is_running:
                try:
                    await self.sync_pending_orders()
                except Exception as e:
                    logger.error(f"Sync cycle error: {e}", exc_info=True)

                await asyncio.sleep(self.sync_interval_seconds)
        except asyncio.CancelledError:
            logger.info("Sync engine stopped")
            self.is_running = False
        finally:
            await self.httpx_client.aclose()

    async def stop(self) -> None:
        """Stop the sync engine"""
        self.is_running = False
        logger.info("Sync engine stopping...")

    async def sync_pending_orders(self) -> Dict[str, Any]:
        """
        Sync all pending orders to cloud
        Returns statistics about sync attempt
        """
        if self.is_syncing:
            logger.debug("Sync already in progress, skipping")
            return {"in_progress": True}

        self.is_syncing = True
        stats = {
            "timestamp": datetime.now().isoformat(),
            "processed": 0,
            "succeeded": 0,
            "failed": 0,
            "conflicts": 0,
        }

        try:
            # Check internet connectivity first
            if not await self._check_connectivity():
                logger.info("No internet connectivity, skipping sync")
                return {**stats, "reason": "no_connectivity"}

            # Get all pending orders
            pending_orders = self.db.get_orders_by_status(SyncStatus.PENDING_SYNC)

            if not pending_orders:
                logger.debug("No pending orders to sync")
                return stats

            logger.info(f"Syncing {len(pending_orders)} pending orders")

            for order in pending_orders:
                stats["processed"] += 1
                success = await self._sync_order_with_retry(
                    order["id"], order, 0
                )

                if success:
                    stats["succeeded"] += 1
                else:
                    stats["failed"] += 1

            logger.info(
                f"Sync cycle complete: {stats['succeeded']}/{stats['processed']} succeeded"
            )

        finally:
            self.is_syncing = False

        return stats

    async def _sync_order_with_retry(
        self, order_id: str, order: Dict[str, Any], attempt: int
    ) -> bool:
        """
        Sync single order with exponential backoff retry
        Returns True if successful
        """
        try:
            response = await self._post_order_to_cloud(order)

            if response.status_code in (200, 201):
                # Success
                cloud_data = response.json()
                cloud_order_id = cloud_data.get("order_id", cloud_data.get("id"))

                self.db.update_order_sync_status(
                    order_id, SyncStatus.SYNCED, cloud_order_id=cloud_order_id
                )
                logger.info(f"Order {order_id} synced successfully")
                return True

            elif response.status_code == 409:
                # Conflict - get server version and compare
                conflict_data = response.json()
                await self._handle_conflict(
                    order_id, order, conflict_data.get("server_order")
                )
                logger.warning(f"Conflict detected for order {order_id}")
                return False

            elif 400 <= response.status_code < 500:
                # Client error - don't retry
                error_msg = response.text or response.reason_phrase
                self.db.update_order_sync_status(
                    order_id,
                    SyncStatus.FAILED,
                    error=f"Client error: {error_msg}",
                )
                logger.error(f"Order {order_id} client error: {error_msg}")
                return False

            else:
                # Server error - retry
                raise Exception(
                    f"Server error {response.status_code}: {response.reason_phrase}"
                )

        except Exception as e:
            logger.error(f"Sync attempt {attempt + 1}/{self.max_retries}: {e}")

            if attempt < self.max_retries - 1:
                # Exponential backoff
                delay = self.retry_delay_seconds * (2 ** attempt)
                logger.info(f"Retrying order {order_id} in {delay}s...")
                await asyncio.sleep(delay)
                return await self._sync_order_with_retry(
                    order_id, order, attempt + 1
                )
            else:
                # Max retries exceeded
                self.db.update_order_sync_status(
                    order_id,
                    SyncStatus.FAILED,
                    error=str(e),
                )
                logger.error(f"Order {order_id} failed after {self.max_retries} attempts")
                return False

    async def _post_order_to_cloud(self, order: Dict[str, Any]) -> httpx.Response:
        """
        POST order to cloud API
        """
        endpoint = f"{self.cloud_api_base}/place-order"

        items = order.get("items", [])
        if isinstance(items, str):
            items = json.loads(items)

        # Transform local-server order format for cloud API
        payload = {
            "customer_email": order.get("customer_email") or "guest@dineiq.com",
            "cart_items": [
                {
                    "id": item.get("id") or item.get("item_id") or item.get("Item_ID"),
                    "Item_ID": item.get("Item_ID") or item.get("item_id") or item.get("id"),
                    "name": item.get("name") or item.get("Item_Name"),
                    "Item_Name": item.get("Item_Name") or item.get("name"),
                    "price": item.get("price") or item.get("Current_Price") or 0,
                    "Current_Price": item.get("Current_Price") or item.get("price") or 0,
                    "quantity": item.get("quantity"),
                    "category": item.get("category"),
                }
                for item in items
            ],
            "final_total": order.get("total_amount", 0),
            "discount_amount": order.get("applied_discount", 0),
            "payment_method": order.get("payment_method", "CASH"),
            "instructions": order.get("special_instructions"),
            "table_number": order.get("table_no"),
        }

        logger.debug(f"Posting to {endpoint}: {json.dumps(payload)}")

        try:
            response = await self.httpx_client.post(
                endpoint,
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            return response
        except httpx.TimeoutException:
            raise Exception("Cloud API timeout")
        except httpx.ConnectError:
            raise Exception("Cannot connect to cloud API")

    async def _handle_conflict(
        self,
        local_order_id: str,
        local_order: Dict[str, Any],
        server_order: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Handle sync conflict - mark for manual review
        """
        self.db.update_order_sync_status(
            local_order_id,
            SyncStatus.CONFLICT,
            error="Order conflict - server has different state",
        )

        # Record conflict details
        conflict_details = {
            "local_order_id": local_order_id,
            "timestamp": datetime.now().isoformat(),
            "local_state": local_order,
            "server_state": server_order,
            "conflict_type": ConflictType.STATUS_MISMATCH,
        }

        # Could store conflict details for admin review
        logger.warning(f"Conflict recorded: {json.dumps(conflict_details)}")

    async def _check_connectivity(self) -> bool:
        """
        Check if cloud API is reachable
        """
        try:
            response = await self.httpx_client.get(
                f"{self.cloud_api_base}/health",
                timeout=5.0,
            )
            return response.status_code == 200
        except Exception as e:
            logger.debug(f"Connectivity check failed: {e}")
            return False

    async def get_sync_stats(self) -> Dict[str, Any]:
        """
        Get current sync statistics
        """
        total_orders = self.db.count_orders()
        synced = self.db.count_orders_by_status(SyncStatus.SYNCED)
        pending = self.db.count_orders_by_status(SyncStatus.PENDING_SYNC)
        failed = self.db.count_orders_by_status(SyncStatus.FAILED)
        conflicts = self.db.count_orders_by_status(SyncStatus.CONFLICT)

        return {
            "total": total_orders,
            "synced": synced,
            "pending": pending,
            "failed": failed,
            "conflicts": conflicts,
            "is_syncing": self.is_syncing,
        }

    async def manual_retry_order(self, order_id: str) -> bool:
        """
        Manually retry a failed or conflicted order
        """
        order = self.db.get_order(order_id)
        if not order:
            logger.error(f"Order {order_id} not found")
            return False

        # Reset status to pending
        self.db.update_order_sync_status(order_id, SyncStatus.PENDING_SYNC)

        # Trigger sync
        return await self._sync_order_with_retry(order_id, order, 0)


# ============================================================================
# HTTP ENDPOINTS FOR SYNC MANAGEMENT
# ============================================================================


async def get_sync_health(db: Any, sync_engine: SyncEngine) -> Dict[str, Any]:
    """Health check endpoint with sync status"""
    stats = await sync_engine.get_sync_stats()
    return {
        "status": "healthy",
        "sync": stats,
        "timestamp": datetime.now().isoformat(),
    }


async def retry_failed_orders(
    db: Any, sync_engine: SyncEngine
) -> Dict[str, Any]:
    """Endpoint to retry all failed orders"""
    failed_orders = db.get_orders_by_status(SyncStatus.FAILED)

    if not failed_orders:
        return {"message": "No failed orders to retry"}

    results = []
    for order in failed_orders:
        success = await sync_engine._sync_order_with_retry(
            order["id"], order, 0
        )
        results.append({"order_id": order["id"], "success": success})

    return {
        "message": f"Retried {len(results)} orders",
        "results": results,
    }


def resolve_conflict_manual(
    db: Any, order_id: str, resolution: str  # "use_local" | "use_server" | "merge"
) -> Dict[str, Any]:
    """
    Manually resolve a conflict
    Args:
        resolution: How to resolve ("use_local", "use_server", or "merge")
    """
    order = db.get_order(order_id)
    if not order:
        return {"error": "Order not found"}

    if resolution == "use_local":
        # Keep local version, retry sync
        db.update_order_sync_status(order_id, SyncStatus.PENDING_SYNC)
    elif resolution == "use_server":
        # Mark as synced with server version
        db.update_order_sync_status(order_id, SyncStatus.SYNCED)
    elif resolution == "merge":
        # Manual merge - requires user input
        db.update_order_sync_status(order_id, SyncStatus.PENDING_SYNC)

    return {"message": f"Conflict resolved using '{resolution}' strategy"}


# ============================================================================
# Local server compatibility layer (existing local-server/main.py expects sync_to_cloud)
# ============================================================================

from db import get_db

async def sync_to_cloud():
    """Simple sync endpoint for local server to push pending orders to cloud"""
    cloud_api_base = (
        os.getenv("CLOUD_API_BASE")
        or os.getenv("BACKEND_API_URL")
        or "http://localhost:8001"
    ).rstrip("/")
    pending = []
    conn = get_db().get_connection()
    cursor = conn.execute("SELECT * FROM orders WHERE sync_status='pending_sync'")
    rows = cursor.fetchall()

    results = []
    for row in rows:
        order = {
            "order_id": row["id"],
            "table_no": row["table_no"],
            "items": json.loads(row["items"]),
            "customer_email": row["customer_email"],
            "total_amount": row["total_amount"],
            "payment_method": row["payment_method"],
            "special_instructions": row["special_instructions"],
            "status": row["status"],
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                payload = {
                    "customer_email": row["customer_email"] or "guest@dineiq.com",
                    "cart_items": json.loads(row["items"]) if row["items"] else [],
                    "final_total": row["total_amount"] or 0,
                    "discount_amount": 0,
                    "payment_method": row["payment_method"] or "CASH",
                    "instructions": row["special_instructions"] or "",
                    "table_number": row["table_no"],
                }
                resp = await client.post(f"{cloud_api_base}/place-order", json=payload)

            if resp.status_code in (200, 201):
                conn.execute(
                    "UPDATE orders SET sync_status='synced', cloud_order_id=?, sync_error=NULL, updated_at=? WHERE id=?",
                    (resp.json().get("order_id"), datetime.utcnow().isoformat(), row["id"]),
                )
                conn.commit()
                results.append({"order_id": row["id"], "synced": True})
            else:
                results.append({"order_id": row["id"], "synced": False, "error": resp.text})
        except Exception as e:
            results.append({"order_id": row["id"], "synced": False, "error": str(e)})

    conn.close()
    return {"synced": len([r for r in results if r.get("synced")]), "total": len(results), "results": results}
