from fastapi import APIRouter
# from fastapi import HTTPException
from pydantic import BaseModel
from typing import List, Optional
# from typing import Dict
import os
# import uuid
# import datetime

# Services & Agents
from services.dependencies import sheets as sheets_client
from agents.pricing import PricingAgent

order_router = APIRouter()
pricing_agent = PricingAgent()

ORDERS_SHEET = "Orders"
ORDER_ITEMS_SHEET = "Order_Items"

# ---------------------------------------------------------
# Helpers
# ---------------------------------------------------------
def _get_next_sequential_id(sheet_name: str, id_column: str, prefix: str, padding: int = 4) -> str:
    """Generates the next sequential ID (e.g., Ord_0001) based on current sheet data."""
    try:
        rows = sheets_client.read_sheet_rows(sheet_name)
        if not rows:
            return f"{prefix}_{'1'.zfill(padding)}"
        
        # Extract numeric parts of IDs
        ids = []
        for r in rows:
            val = r.get(id_column, "")
            if val and "_" in val:
                try:
                    # Get the last parts after the last underscore
                    numeric_part = val.split("_")[-1]
                    ids.append(int(numeric_part))
                except (ValueError, IndexError):
                    continue
        
        next_num = max(ids) + 1 if ids else 1
        return f"{prefix}_{str(next_num).zfill(padding)}"
    except Exception as e:
        print(f"ID Generation Error for {sheet_name}: {e}")
        # Fallback to random-ish if lookup fails to avoid crash, but try to stay sequential
        import uuid
        return f"{prefix}_{uuid.uuid4().hex[:padding]}"

# ---------------------------------------------------------
# Request Models
# ---------------------------------------------------------
class CartItem(BaseModel):
    id: Optional[str] = None # Internal name
    Item_ID: Optional[str] = None # Frontend name
    name: Optional[str] = None
    Item_Name: Optional[str] = None
    price: Optional[float] = 0.0
    Current_Price: Optional[float] = 0.0
    quantity: Optional[int] = 1
    category: Optional[str] = None

class PricingRequest(BaseModel):
    customer_email: str
    cart_items: List[CartItem]
    
class OrderRequest(BaseModel):
    customer_email: str
    cart_items: List[CartItem]
    discount_amount: float = 0.0
    final_total: float
    payment_method: str = "Cash"
    instructions: Optional[str] = None
    table_number: Optional[str] = None

# ---------------------------------------------------------
# Endpoints
# ---------------------------------------------------------

@order_router.post("/pricing-strategy")
async def get_pricing_strategy(req: PricingRequest):
    """
    Calculates subtotal, discounts, and visual nudges.
    Frontend calls this as 'pricing-strategy'.
    """
    if not req.cart_items:
        return {"pricing": {"subtotal": 0, "final_total": 0}}
        
    # Normalize items for PricingAgent/Sheets
    cart_items_normalized = []
    for item in req.cart_items:
        normalized = {
            "Item_ID": item.Item_ID or item.id,
            "Item_Name": item.Item_Name or item.name or "Item",
            "Current_Price": item.Current_Price or item.price or 0.0,
            "quantity": item.quantity or 1,
            "category": item.category or "General"
        }
        cart_items_normalized.append(normalized)

    subtotal = sum(i["Current_Price"] * i["quantity"] for i in cart_items_normalized)
    
    # Fetch real order count from Sheets for accurate coupon/loyalty eligibility
    order_count = 0
    try:
        # Get customer ID from email
        auth_rows = sheets_client.read_sheet_rows("Customer_Auth")
        target_email = req.customer_email.strip().lower()
        user_row = next((r for r in auth_rows if str(r.get("Customer_Email", "")).strip().lower() == target_email), None)
        
        if user_row:
            customer_id = user_row.get("Customer_ID")
            # Count existing orders for this customer
            all_orders = sheets_client.read_sheet_rows(ORDERS_SHEET)
            order_count = sum(1 for o in all_orders if o.get("Customer_ID") == customer_id)
            print(f">>> Customer {customer_id} has {order_count} previous orders")
    except Exception as e:
        print(f">>> Error fetching order count for coupons: {e}")
        order_count = 0
    
    return pricing_agent.get_pricing_strategy(subtotal, order_count, cart_items_normalized)


@order_router.post("/place-order")
async def place_order(req: OrderRequest):
    """
    Finalizes the order and saves to Google Sheets with correct schema.
    Schema Orders: [Order_ID, Customer_ID, Customer_Name, Order_Price, Order_Created_DateTime, Order_Status]
    Schema Order_Items: [Order_Item_ID, Order_ID, Item_ID, Item_Name, Item_Quantity, Item_Price]
    """
    # 0. Generate Sequential Order ID
    order_id = _get_next_sequential_id(ORDERS_SHEET, "Order_ID", "Ord")
    import datetime
    timestamp = datetime.datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    
    try:
        # 0. Look up Customer details from Customer_Auth (Normalized)
        auth_rows = sheets_client.read_sheet_rows("Customer_Auth")
        target_email = req.customer_email.strip().lower()
        
        # with open("debug_order.log", "a") as f:
            # f.write(f"\n--- ORDER LOG {timestamp} ---\n")
            # f.write(f"DEBUG: Received customer_email: '{req.customer_email}'\n")
            # f.write(f"DEBUG: Normalized target_email: '{target_email}'\n")
            
        user_row = None
        for r in auth_rows:
            row_email = str(r.get("Customer_Email", "")).strip().lower()
            if row_email == target_email:
                user_row = r
                break
        
            # if not user_row:
            #     f.write(f"DEBUG: NO MATCH FOUND for '{target_email}'\n")
            #     f.write(f"DEBUG: Available emails (first 10): {[str(r.get('Customer_Email')).strip().lower() for r in auth_rows[:10]]}\n")
            # else:
            #     f.write(f"DEBUG: MATCH FOUND: {user_row.get('Customer_ID')} - {user_row.get('Customer_Name')}\n")
            
        customer_id = user_row.get("Customer_ID", "Unknown") if user_row else "Unknown"
        customer_name = user_row.get("Customer_Name", "Unknown") if user_row else "Unknown"
            # f.write(f"DEBUG: Final IDs saved -> ID: {customer_id}, Name: {customer_name}\n")
            # f.write(f"--- END LOG ---\n")

        # 1. Save to Orders Sheet
        order_row = [
            order_id,
            customer_id,
            customer_name,
            req.final_total,
            timestamp,
            "CREATED",
            req.table_number or "N/A" 
        ]
        sheets_client.append_row(ORDERS_SHEET, order_row)
        
        # 2. Save to Order_Items Sheet
        for idx, item in enumerate(req.cart_items, 1):
            # Generate a unique sequential ID for each order item within THIS order
            # Format: Ord_<Order ID>_Item_<Item sequence ID>
            order_item_id = f"{order_id}_Item_{str(idx).zfill(4)}"
            
            # Use frontend names or fallbacks
            item_id = item.Item_ID or item.id or "Unknown"
            item_name = item.Item_Name or item.name or "Item"
            item_price = item.Current_Price or item.price or 0.0
            
            item_row = [
                order_item_id,
                order_id,
                item_id,
                item_name,
                item.quantity,
                item_price
            ]
            sheets_client.append_row(ORDER_ITEMS_SHEET, item_row)
        
        # ===================================================================
        # 🤖 TRIGGER CATEGORIZATION AGENT
        # Automatically categorize the customer after order placement
        # ===================================================================
        try:
            from agents.categorization import categorize_single_customer
            
            print(f"\n🤖 Triggering categorization for customer: {customer_id}")
            categorization_success = categorize_single_customer(customer_id)
            
            if categorization_success:
                print(f"✅ Categorization completed successfully for customer {customer_id}")
            else:
                print(f"⚠️ Categorization failed for customer {customer_id}, but order was saved")
                
        except Exception as e:
            # Fail-safe: Don't let categorization errors break order placement
            print(f"⚠️ Categorization error for customer {customer_id}: {e}")
            print("Order was saved successfully despite categorization error")
            import traceback
            traceback.print_exc()
            
        return {"status": "success", "order_id": order_id, "message": "Order placed successfully"}
        
    except Exception as e:
        print(f"Order Placement Error: {e}")
        import traceback
        traceback.print_exc()
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="Failed to place order")

@order_router.get("/order-history/{email}")
async def get_order_history(email: str):
    """
    Fetches order history for a specific customer.
    Joins Orders and Order_Items.
    """
    try:
        all_orders = sheets_client.read_sheet_rows(ORDERS_SHEET)
        all_items = sheets_client.read_sheet_rows(ORDER_ITEMS_SHEET)
        
        # Filter orders by email (stored in Customer_Auth lookup or directly if email was in sheet)
        # However, the Orders sheet doesn't have email. We need to find customer_id first.
        auth_rows = sheets_client.read_sheet_rows("Customer_Auth")
        user_row = next((r for r in auth_rows if r.get("Customer_Email") == email), None)
        
        if not user_row:
            return {"orders": []}
            
        customer_id = user_row.get("Customer_ID")
        customer_orders = [o for o in all_orders if o.get("Customer_ID") == customer_id]
        
        formatted_orders = []
        for o in customer_orders:
            order_id = o.get("Order_ID")
            items = []
            for itm in all_items:
                if itm.get("Order_ID") == order_id:
                    items.append({
                        "name": itm.get("Item_Name", "Unknown"),
                        "quantity": int(itm.get("Item_Quantity", 1)),
                        "price": float(itm.get("Item_Price", 0))
                    })
            
            # Convert timestamp back to something frontend likes (or keep as string)
            # Schema: Order_Created_DateTime
            date_str = o.get("Order_Created_DateTime", "")
            
            formatted_orders.append({
                "id": order_id,
                "date": date_str,
                "items": items,
                "total": float(o.get("Order_Price", 0)),
                "status": o.get("Order_Status", "CREATED").lower()
            })
            
        return {"orders": formatted_orders}
        
    except Exception as e:
        print(f"Fetch Order History Error: {e}")
        return {"orders": []}

@order_router.get("/coupons")
def get_coupons():
    return {"coupons": pricing_agent._get_coupons(0, 0)}

@order_router.post("/call-waiter")
async def call_waiter(req: dict):
    """Logs a waiter call request to a new WaiterCalls sheet."""
    import datetime
    timestamp = datetime.datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    table_number = req.get("table_number", "Unknown")
    customer_name = req.get("customer_name", "Guest")
    
    try:
        # Create row in WaiterCalls sheet
        # Make sure to add this sheet manually in GSheets with headers:
        # [Call_ID, Table_Number, Customer_Name, Called_At, Status]
        call_id = _get_next_sequential_id("WaiterCalls", "Call_ID", "Call")
        row = [call_id, table_number, customer_name, timestamp, "PENDING"]
        sheets_client.append_row("WaiterCalls", row)
        return {"status": "success", "message": "Waiter has been notified"}
    except Exception as e:
        print(f"Call Waiter Error: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="Failed to call waiter")


@order_router.get("/active-order/{table_number}")
async def get_active_order(table_number: str):
    """Fetches the most recent active order for a table."""
    try:
        all_orders = sheets_client.read_sheet_rows(ORDERS_SHEET)
        all_items  = sheets_client.read_sheet_rows(ORDER_ITEMS_SHEET)

        # Filter orders for this table, sorted by most recent
        table_orders = [
            o for o in all_orders
            if str(o.get("Table_Number", "")) == str(table_number)
        ]

        if not table_orders:
            return {"order": None}

        # Get the latest order
        latest = table_orders[-1]
        order_id = latest.get("Order_ID")

        items = [
            {
                "name":     itm.get("Item_Name", "Unknown"),
                "quantity": int(itm.get("Item_Quantity", 1)),
                "price":    float(itm.get("Item_Price", 0)),
            }
            for itm in all_items
            if itm.get("Order_ID") == order_id
        ]

        return {
            "order": {
                "id":        order_id,
                "status":    latest.get("Order_Status", "CREATED"),
                "total":     float(latest.get("Order_Price", 0)),
                "timestamp": latest.get("Order_Created_DateTime", ""),
                "items":     items,
            }
        }
    except Exception as e:
        print(f"Active Order Error: {e}")
        return {"order": None}
