# DineIQ\Backend\routes\auth.py

# ---------------------------------------------------------
# Library and Packages Import
# ---------------------------------------------------------
from fastapi import APIRouter, HTTPException
# import random, hashlib
import time
import os
# import re

# -------------------------------------------------------------------
# 🔧 SETUP KEYS and URLs
# -------------------------------------------------------------------
from dotenv import load_dotenv
load_dotenv()

from services.dependencies import sheets as sheets_client

from services.email import GmailClient

auth_router = APIRouter()

CUSTOMER_AUTH_SHEET = "Customer_Auth"       # Read-Write from Customer Frontend Web/App

# ---------------------------------------------------------
# Auth Routes
# ---------------------------------------------------------

# -----------------------------
# SIGNUP (email OTP)
# - Name, Email, Phone saved
# -----------------------------
@auth_router.post("/signup")
def signup(payload: dict):
    try:
        print(">>> /auth/signup HIT", payload)

        name = str(payload.get("name", "")).strip()
        email = str(payload.get("email", "")).strip().lower()
        mobile = str(payload.get("mobile", "")).strip()

        if not email or not name or not mobile:
            raise HTTPException(status_code=400, detail="Invalid signup data")
        # --- Check for conflicts ---
        rows = sheets_client.read_sheet_rows(CUSTOMER_AUTH_SHEET)
        email_normalized = email
        mobile_normalized = mobile
        table_number = str(payload.get("table_number", "")).strip()

        existing_email = next((r for r in rows if str(r.get("Customer_Email", "")).strip().lower() == email_normalized), None)
        existing_phone = next((r for r in rows if str(r.get("Customer_Phone", "")).strip() == mobile_normalized), None)

        if existing_phone and str(existing_phone.get("Customer_Email", "")).strip().lower() != email_normalized:
            # Same phone, different email
            assoc_email = existing_phone.get("Customer_Email")
            return {"status": "error", "message": f"Another email {assoc_email} is already registered with phone {mobile_normalized}"}

        if existing_email and str(existing_email.get("Customer_Phone", "")).strip() != mobile_normalized:
            # Same email, different phone
            assoc_phone = existing_email.get("Customer_Phone")
            return {"status": "error", "message": f"Another phone {assoc_phone} is already registered with email {email_normalized}"}

        if existing_email and existing_phone and existing_email == existing_phone:
            # Both same, different name
            if str(existing_email.get("Customer_Name", "")).strip() != str(name).strip():
                assoc_name = existing_email.get("Customer_Name")
                return {"status": "error", "message": f"Another customer {assoc_name} is already registered with {email_normalized} & {mobile_normalized}"}

        # --- No conflicts, proceed ---
        otp = generate_otp()
        save_otp_for_email(email, otp, name=name, mobile=mobile, table_number=table_number)
        
        gmail_client = GmailClient()
        gmail_client.send_otp_email(email, otp)

        return {"status": "otp_sent"}
    except Exception as e:
        print("🔥 SIGNUP ERROR:", str(e))
        raise HTTPException(status_code=500, detail=str(e))

# -----------------------------
# LOGIN (email OR phone)
# - OTP sent only for Email
# -----------------------------
@auth_router.post("/check-user")
def check_user(payload: dict):

    method = payload.get("method")
    value = payload.get("value")
    table_number = payload.get("table_number")

    # ---------------- EMAIL LOGIN ----------------
    if method == "email":

        user = find_user_by_email(value)

        if not user:
            return {"status": "not_found"}

        # Update table number if provided
        if table_number:
            rows = sheets_client.read_sheet_rows(CUSTOMER_AUTH_SHEET)
            row = find_row_by_email(rows, value)

            if row:
                row_num = rows.index(row) + 2
                sheets_client.update_cell(
                    CUSTOMER_AUTH_SHEET,
                    f"K{row_num}",
                    table_number
                )

        otp = generate_otp()
        save_otp_for_email(value, otp)

        gmail_client = GmailClient()
        gmail_client.send_otp_email(value, otp)

        return {
            "status": "exists",
            "id": user.get("id"),
            "name": user["name"],
            "email": user["email"],
            "mobile": user.get("mobile"),
            "table_number": table_number or user.get("table_number"),
        }

    # ---------------- PHONE LOGIN ----------------
    elif method == "phone":

        user = find_user_by_phone(value)

        if not user:
            return {"status": "not_found"}

        # Block login if user never verified
        if not user.get("last_login"):
            return {
                "status": "not_verified",
                "message": "Your account is not verified. Please sign up first."
            }

        # Update table number if provided
        if table_number:
            rows = sheets_client.read_sheet_rows(CUSTOMER_AUTH_SHEET)
            row = find_row_by_phone(rows, value)

            if row:
                row_num = rows.index(row) + 2
                sheets_client.update_cell(
                    CUSTOMER_AUTH_SHEET,
                    f"K{row_num}",
                    table_number
                )

        update_last_login_by_phone(value)

        return {
            "status": "exists",
            "id": user.get("id"),
            "name": user["name"],
            "email": user.get("email"),
            "mobile": user.get("mobile"),
            "table_number": table_number or user.get("table_number"),
        }

    else:
        raise HTTPException(status_code=400, detail="Invalid login method")

# -----------------------------
# VERIFY OTP (email only)
# -----------------------------
@auth_router.post("/verify-otp")
def verify_otp(payload: dict):
    email = payload.get("email")
    otp = payload.get("otp")

    result = verify_otp_for_email(email, otp)
    if not result["ok"]:
        return {"status": "error", "message": result["message"]}

    return {
    "status": "ok",
    "id": result.get("id"),
    "name": result["name"],
    "mobile": result["mobile"],
    "email": email,
    "table_number": result.get("table_number"),   # ✅ ADD THIS
}

# ------------------------------------------------------------------
# Auth Helper functions
# - generate otp, hash
# - find user by email/phone
# - save/verify otp for email
# ------------------------------------------------------------------
def generate_otp():
    print(">>> Generating OTP")
    import random
    return str(random.randint(100000, 999999))

def sha256(value: str) -> str:
    print(">>> Generating OTP hash")
    import hashlib
    return hashlib.sha256(value.encode()).hexdigest()

def find_row_by_email(rows: list[dict], email: str):
    email = str(email).strip().lower()
    return next(
        (
            r for r in rows 
            if str(r.get("Customer_Email", "")).strip().lower() == email),
        None
    )

def find_row_by_phone(rows: list[dict], phone: str):
    phone = str(phone)
    return next(
        (r for r in rows if str(r.get("Customer_Phone", "")) == phone),
        None
    )

def find_user_by_email(email: str):
    print(">>> Finding user by email:", email)

    rows = sheets_client.read_sheet_rows(CUSTOMER_AUTH_SHEET)
    row = find_row_by_email(rows, email)

    if not row:
        return None

    return {
    "id": row.get("Customer_ID"),
    "name": row.get("Customer_Name"),
    "email": row.get("Customer_Email"),
    "mobile": row.get("Customer_Phone"),
    "table_number": row.get("Table_Number"),   # ✅ add this
    "last_login": row.get("Last_Login_DateTime"),
}
def find_user_by_phone(phone: str):
    print(">>> Finding user by phone:", phone)

    rows = sheets_client.read_sheet_rows(CUSTOMER_AUTH_SHEET)
    row = find_row_by_phone(rows, phone)

    if not row:
        return None

    return {
    "id": row.get("Customer_ID"),
    "name": row.get("Customer_Name"),
    "email": row.get("Customer_Email"),
    "mobile": row.get("Customer_Phone"),
    "table_number": row.get("Table_Number"),   # ✅ add this
    "last_login": row.get("Last_Login_DateTime"),
}

def update_last_login_by_phone(phone: str):
    rows = sheets_client.read_sheet(CUSTOMER_AUTH_SHEET)

    row = rows[rows["Customer_Phone"].astype(str) == str(phone)]
    if row.empty:
        return

    row_num = row.index[0] + 2
    sheets_client.update_cell(
        CUSTOMER_AUTH_SHEET,
        f"I{row_num}",  # Last_Login_DateTime
        time.strftime("%d/%m/%Y %H:%M:%S"),
    )

def generate_next_customer_id(rows: list[dict]) -> str:
    import re
    max_num = 0
    pattern = re.compile(r"Cust_(\d+)")

    for r in rows:
        cid = r.get("Customer_ID", "")
        match = pattern.fullmatch(str(cid))
        if match:
            num = int(match.group(1))
            max_num = max(max_num, num)

    return f"Cust_{max_num + 1:04d}"

def save_otp_for_email(email, otp, name=None, mobile=None, table_number=None):
    print(">>> Saving OTP for:", email)

    rows = sheets_client.read_sheet_rows(CUSTOMER_AUTH_SHEET)

    otp_hash = sha256(otp)
    expiry = int(time.time()) + 300

    row = find_row_by_email(rows, email)

    if row:
        row_index = rows.index(row)
        row_num = row_index + 2  # header offset

        print(">>> Updating existing row:", row_num)

        sheets_client.update_cell(CUSTOMER_AUTH_SHEET, f"F{row_num}", otp_hash)
        sheets_client.update_cell(CUSTOMER_AUTH_SHEET, f"G{row_num}", expiry)

        if table_number:
         sheets_client.update_cell(CUSTOMER_AUTH_SHEET, f"K{row_num}", table_number)
        return

    # ---- New signup ----
    print(">>> New signup, appending row")

    customer_id = generate_next_customer_id(rows)
    print(">>> Generated Customer_ID:", customer_id)

    sheets_client.append_row(
    CUSTOMER_AUTH_SHEET,
    [
        customer_id,                # A  Customer_ID
        name or "",                 # B  Customer_Name
        email,                      # C  Customer_Email
        mobile or "",               # D  Customer_Phone
        "",                         # E  Date_of_Birth
        otp_hash,                   # F  OTP_Hash
        expiry,                     # G  OTP_Expires_At
        time.strftime("%d/%m/%Y %H:%M:%S"),  # H  Creation_DateTime
        "",                         # I  Last_Login_DateTime
        "",                         # J  Customer_Category
        table_number or ""          # K  Table_Number  ✅ NEW COLUMN
    ]
)

def verify_otp_for_email(email, otp):
    print(">>> Verifying OTP for:", email)

    rows = sheets_client.read_sheet_rows(CUSTOMER_AUTH_SHEET, bypass_cache=True)

    entered_hash = sha256(otp)
    now = int(time.time())

    row = find_row_by_email(rows, email)
    if not row:
        return {"ok": False, "message": "Email not found"}

    if not row.get("OTP_Hash"):
        return {"ok": False, "message": "OTP not generated"}

    if now > int(row.get("OTP_Expires_At", 0)):
        return {"ok": False, "message": "OTP expired"}

    if row.get("OTP_Hash") != entered_hash:
        return {"ok": False, "message": "Invalid OTP"}
    row_num = rows.index(row) + 2

    # Update last login time
    sheets_client.update_cell(
     CUSTOMER_AUTH_SHEET,
     f"I{row_num}",
     time.strftime("%d/%m/%Y %H:%M:%S"),
    )
    sheets_client.update_cell(CUSTOMER_AUTH_SHEET, f"F{row_num}", "")
    sheets_client.update_cell(CUSTOMER_AUTH_SHEET, f"G{row_num}", "")
    return {
     "ok": True,
     "id": row.get("Customer_ID"),
     "name": row.get("Customer_Name"),
     "mobile": row.get("Customer_Phone"),
    "table_number": row.get("Table_Number"),  # ✅ add this
     }