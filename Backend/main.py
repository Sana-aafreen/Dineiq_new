# DineIQ Backend API
# ---------------------------------------------------------
# Modular Architecture Entry Point
# ---------------------------------------------------------

# CRITICAL: Import startup FIRST to decode credentials before any other imports
# import startup  # This decodes Base64 credentials if on Render

from fastapi import FastAPI
from fastapi import Request, Response
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

# Load Env
load_dotenv()

# Import Routers
from routes.auth import auth_router
from routes.dashboard import dashboard_router
from routes.order import order_router
from agents.menu import menu_router
from agents.recommendation import recommendation_router
from agents.chatbot import chatbot_router
from services.campaigns import campaigns_router
from agents.monitoring import monitoring_router
from services.reviews import reviews_router

# Initialize App
app = FastAPI(title="DineIQ Backend API", version="2.0")

# CORS Configuration
# Allow both production and common local development origins.
def _build_allowed_origins() -> list[str]:
    configured = [
        origin.strip()
        for origin in os.getenv("ALLOWED_ORIGINS", "").split(",")
        if origin.strip()
    ]
    local_dev_origins = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:8080",
        "http://localhost:8081",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:8081",
    ]
    # Preserve order while removing duplicates.
    return list(dict.fromkeys(configured + local_dev_origins))


allowed_origins = _build_allowed_origins()
print("ALLOWED_ORIGINS LOADED:", allowed_origins)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def local_dev_cors_fallback(request: Request, call_next):
    """
    Fallback CORS handler for local development.
    Some browsers/dev setups still fail FastAPI's preflight matching even when
    the origin is effectively local, so we echo the Origin back explicitly.
    """
    origin = request.headers.get("origin")
    requested_headers = request.headers.get("access-control-request-headers", "*")

    if request.method == "OPTIONS" and origin:
        response = Response(status_code=200)
    else:
        response = await call_next(request)

    if origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT"
        response.headers["Access-Control-Allow-Headers"] = requested_headers
        response.headers["Vary"] = "Origin"

    return response

# ---------------------------------------------------------
# Register Routers
# ---------------------------------------------------------
# Auth: Login, Signup, OTP
app.include_router(auth_router, prefix="/auth", tags=["Authentication"])

# Menu: Fetch Menu, AI Combos (Future)
app.include_router(menu_router, prefix="/menu", tags=["Menu"])

# Orders: Checkout, Place Order, Pricing Strategy
app.include_router(order_router, tags=["Orders"]) 
# Note: order_router has /pricing-strategy at root level to match frontend

# Dashboard: SQLite-backed manager data APIs
app.include_router(dashboard_router, prefix="/dashboard", tags=["Dashboard"])

# Recommendations: Upsell, Add-ons, Preferences
# Frontend calls /item-addons at root, let's include it at root for compatibility
app.include_router(recommendation_router, tags=["Recommendations"]) 

# Chatbot: AI Chat
app.include_router(chatbot_router, prefix="/chatbot", tags=["Chatbot"])

# Campaigns: Marketing
app.include_router(campaigns_router, prefix="/campaigns", tags=["Campaigns"])

# Monitoring: Tracking logs & AI Insights
app.include_router(monitoring_router, prefix="/activity", tags=["Monitoring"])

# Reviews: Customer Feedback
app.include_router(reviews_router, prefix="/reviews", tags=["Reviews"])


# ---------------------------------------------------------
# Application Startup
# ---------------------------------------------------------
@app.on_event("startup")
async def startup_event():
    import asyncio
    from services.DineIQ_Database_Sync import start_progressive_sync
    from services.menu_sheet_sync import sync_menu_from_google_sheets_to_sqlite

    if os.getenv("MENU_SYNC_FROM_GSHEET_ON_STARTUP", "true").strip().lower() in {"1", "true", "yes"}:
        try:
            result = sync_menu_from_google_sheets_to_sqlite()
            print(f"Menu sync on startup: {result}")
        except Exception as exc:
            print(f"Menu sync on startup failed: {exc}")

    # Start the progressive sync worker to sync SQLite changes to Google Sheets
    asyncio.create_task(start_progressive_sync())

# ---------------------------------------------------------
# Health Check
# ---------------------------------------------------------
@app.get("/", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "DineIQ Backend", "version": "2.0"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    print(f"Starting DineIQ Backend on port {port}...")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
