# DineIQ\Backend\services\campaigns.py

# ---------------------------------------------------------
# Library and Packages Import
# ---------------------------------------------------------
import os
# import re
from typing import List
from datetime import datetime
from fastapi import APIRouter, Request
# from fastapi import HTTPException
from pydantic import BaseModel, Field

# from config import REQUEST_DELAY

# ---------------------------------------------------------
# Load environment variables from .env file
# ---------------------------------------------------------
from dotenv import load_dotenv
load_dotenv()

# ---------------------------------------------------------
# Sheets Client
# ---------------------------------------------------------
from services.dependencies import sheets as sheets_client

CAMPAIGNS_SHEET = "Campaigns"
MAX_MESSAGES = 10

# ---------------------------------------------------------
# Router
# ---------------------------------------------------------
campaigns_router = APIRouter()

# ---------------------------------------------------------
# Internal Model
# ---------------------------------------------------------
class CampaignInternal(BaseModel):
    campaign_text: str
    target_customer_category: str
    start_datetime: str
    end_datetime: str
    campaign_message_count: int = Field(ge=0, le=10)
    campaign_type: str = ""
    message_templates: List[str]
    message_send_timings: List[str]


# ---------------------------------------------------------
# Utilities
# ---------------------------------------------------------
def generate_campaign_id(existing_ids: list[str]) -> str:
    import re
    pattern = re.compile(r"Cmp_(\d+)")
    nums = [
        int(pattern.search(cid).group(1))
        for cid in existing_ids
        if cid and pattern.search(cid)
    ]
    next_id = max(nums) + 1 if nums else 1
    return f"Cmp_{next_id:04d}"


def compute_campaign_status(start_dt: datetime, end_dt: datetime) -> str:
    now = datetime.now()
    if start_dt <= now <= end_dt:
        return "ACTIVE"
    if now > end_dt:
        return "INACTIVE"
    return "UPCOMING"


# ---------------------------------------------------------
# Sheet helpers (HEADER CREATION ONLY)
# ---------------------------------------------------------
def _get_campaigns_sheet_id() -> int:
    meta = sheets_client._service.get(
        spreadsheetId=sheets_client.spreadsheet_id
    ).execute()

    for s in meta["sheets"]:
        if s["properties"]["title"] == CAMPAIGNS_SHEET:
            return s["properties"]["sheetId"]

    raise RuntimeError("Campaigns sheet not found")


def ensure_message_columns(count: int):
    # Fetch current headers
    result = sheets_client._service.values().get(
        spreadsheetId=sheets_client.spreadsheet_id,
        range=f"{CAMPAIGNS_SHEET}!1:1",
    ).execute()

    headers = result.get("values", [[]])[0]
    headers = [h.strip() for h in headers]

    sheet_id = _get_campaigns_sheet_id()
    requests = []

    def has_col(name: str) -> bool:
        return name in headers

    for i in range(1, count + 1):
        tmpl_col = f"Message_Template #{i}"
        time_col = f"Message_Send_Timing #{i}"

        for col_name in (tmpl_col, time_col):
            if not has_col(col_name):
                col_index = len(headers)

                requests.append({
                    "updateCells": {
                        "range": {
                            "sheetId": sheet_id,
                            "startRowIndex": 0,
                            "endRowIndex": 1,
                            "startColumnIndex": col_index,
                            "endColumnIndex": col_index + 1,
                        },
                        "rows": [{
                            "values": [{
                                "userEnteredValue": {"stringValue": col_name}
                            }]
                        }],
                        "fields": "userEnteredValue",
                    }
                })

                headers.append(col_name)  # 🔑 immediately extend header list

    if requests:
        sheets_client._service.batchUpdate(
            spreadsheetId=sheets_client.spreadsheet_id,
            body={"requests": requests},
        ).execute()



# ---------------------------------------------------------
# Payload normalization
# ---------------------------------------------------------
def normalize_frontend_campaign(payload: dict) -> CampaignInternal:
    templates, timings = [], []

    count = int(payload.get("campaignMessageCount", 0))

    for i in range(1, count + 1):
        if payload.get(f"messageTemplate{i}"):
            templates.append(payload[f"messageTemplate{i}"])
        if payload.get(f"messageSendTiming{i}"):
            timings.append(payload[f"messageSendTiming{i}"])

    return CampaignInternal(
        campaign_text=payload["campaignText"],
        target_customer_category=payload["targetClientCategory"],
        start_datetime=payload["startDateTime"],
        end_datetime=payload["endDateTime"],
        campaign_message_count=count,
        campaign_type=payload.get("campaignType", ""),
        message_templates=templates,
        message_send_timings=timings,
    )


# ---------------------------------------------------------
# Core processor
# ---------------------------------------------------------
def process_single_campaign(campaign: CampaignInternal):
    # Initialize Sheets service
    sheets_client.init_service()

    # 1️⃣ Ensure message columns exist (structure mutation)
    ensure_message_columns(campaign.campaign_message_count)

    # 2️⃣ RE-READ sheet so pandas sees new headers (CRITICAL)
    df = sheets_client.read_sheet(CAMPAIGNS_SHEET)

    # 3️⃣ Generate Campaign ID
    existing_ids = (
        df["Campaign_ID"].dropna().astype(str).tolist()
        if "Campaign_ID" in df.columns
        else []
    )
    campaign_id = generate_campaign_id(existing_ids)

    # 4️⃣ Compute status
    start_dt = datetime.strptime(campaign.start_datetime, "%Y-%m-%d %H:%M")
    end_dt = datetime.strptime(campaign.end_datetime, "%Y-%m-%d %H:%M")
    status = compute_campaign_status(start_dt, end_dt)

    # 5️⃣ Build a row strictly aligned to sheet headers
    new_row = {col: "" for col in df.columns}

    # Core campaign fields
    new_row.update({
        "Campaign_ID": campaign_id,
        "Campaign_Text": campaign.campaign_text,
        "Target_Customer_Category": campaign.target_customer_category,
        "Campaign_Start_DateTime": campaign.start_datetime,
        "Campaign_End_DateTime": campaign.end_datetime,
        "Campaign_Message_Count": campaign.campaign_message_count,
        "Campaign_Type": campaign.campaign_type or "",
        "Campaign_Status": status,
    })

    # 6️⃣ Populate dynamic message columns
    for i in range(1, MAX_MESSAGES + 1):
        tmpl_col = f"Message_Template #{i}"
        time_col = f"Message_Send_Timing #{i}"

        if tmpl_col in new_row:
            new_row[tmpl_col] = (
                campaign.message_templates[i - 1]
                if i <= len(campaign.message_templates)
                else ""
            )

        if time_col in new_row:
            new_row[time_col] = (
                campaign.message_send_timings[i - 1]
                if i <= len(campaign.message_send_timings)
                else ""
            )

    # 7️⃣ Append row
    df.loc[len(df)] = new_row

    # 8️⃣ Sanitize NaNs (Sheets hates NaN)
    df = df.fillna("")

    # 9️⃣ Persist back to Sheets
    sheets_client.update_sheet(CAMPAIGNS_SHEET, df)

    print("📐 Columns count:", len(df.columns))
    print("📍 Last column:", df.columns[-1])

    return campaign_id, status



# ---------------------------------------------------------
# 🚀 API: Add Campaign
# ---------------------------------------------------------
@campaigns_router.post("/add")
async def add_campaign(request: Request):
    try:
        print("\n🔥 /campaigns/add endpoint HIT")
        payload = await request.json()
        print("📥 Incoming campaign payload:", payload)

        campaign = normalize_frontend_campaign(payload)
        campaign_id, status = process_single_campaign(campaign)

        return {
            "campaign_id": campaign_id,
            "campaign_status": status,
            "message": "Campaign created successfully",
        }
    except Exception as e:
        import traceback
        print("❌ Campaign Creation Error:")
        traceback.print_exc()
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))
