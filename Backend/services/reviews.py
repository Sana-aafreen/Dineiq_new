# DineIQ\Backend\services\reviews.py

import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.dependencies import sheets

# --- Pydantic Models ---

class ReviewSubmission(BaseModel):
    Review_ID: Optional[str] = None
    Customer_ID: Optional[str] = ""
    Customer_Name: Optional[str] = ""
    Customer_Email: Optional[str] = ""
    Food_Quality: int
    Service: int
    Cleanliness: int
    Value_For_Money: int
    Overall_Experience: int
    Additional_Comments: Optional[str] = ""
    Review_Type: str # Complaint, Suggestion, Appreciation, General Feedback

class ReviewUpdate(BaseModel):
    Urgency: Optional[str] = None
    Assigned_To: Optional[str] = None
    Actions_Needed: Optional[str] = None
    Internal_Comments: Optional[str] = None
    Status: Optional[str] = None

# --- Service Logic ---

class ReviewService:
    SHEET_NAME = "Customer_Reviews"
    COLUMNS = [
        "Review_ID", "Customer_ID", "Customer_Name", "Customer_Email", 
        "Review_Date_Time", "Food_Quality", "Service", "Cleanliness", 
        "Value_For_Money", "Overall_Experience", "Additional_Comments", 
        "Review_Type", "Urgency", "Assigned_To", "Actions_Needed", 
        "Internal_Comments", "Status"
    ]

    @staticmethod
    def calculate_urgency(overall_experience, review_type):
        """
        Auto-fills Urgency based on Overall_Experience and Review_Type.
        High if Overall Experience <= 2 or Review Type is 'Complaint'.
        Medium if Overall Experience is 3.
        Low if Overall Experience >= 4.
        """
        if review_type == "Complaint" or (overall_experience is not None and int(overall_experience) <= 2):
            return "High"
        elif overall_experience is not None and int(overall_experience) == 3:
            return "Medium"
        else:
            return "Low"

    def submit_review(self, review_data: dict):
        """
        Handles review submission from Webapp.
        If Review_ID is provided, it updates the existing entry.
        """
        review_id = review_data.get("Review_ID")
        is_update = bool(review_id)
        
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        overall_experience = review_data.get("Overall_Experience")
        review_type = review_data.get("Review_Type", "Appreciation")
        urgency = self.calculate_urgency(overall_experience, review_type)
        
        if is_update:
            # Update mode
            df = sheets.read_sheet(self.SHEET_NAME)
            idx = df[df["Review_ID"] == review_id].index
            if idx.empty:
                return {"status": "error", "message": f"Review {review_id} not found"}
            
            row_idx = idx[0]
            # Customer fields update
            df.at[row_idx, "Review_Date_Time"] = timestamp
            df.at[row_idx, "Food_Quality"] = review_data.get("Food_Quality", 0)
            df.at[row_idx, "Service"] = review_data.get("Service", 0)
            df.at[row_idx, "Cleanliness"] = review_data.get("Cleanliness", 0)
            df.at[row_idx, "Value_For_Money"] = review_data.get("Value_For_Money", 0)
            df.at[row_idx, "Overall_Experience"] = overall_experience
            df.at[row_idx, "Additional_Comments"] = review_data.get("Additional_Comments", "")
            df.at[row_idx, "Review_Type"] = review_type
            df.at[row_idx, "Urgency"] = urgency
            
            # Reset internal fields on re-fill
            df.at[row_idx, "Assigned_To"] = ""
            df.at[row_idx, "Actions_Needed"] = "Internal Review"
            df.at[row_idx, "Internal_Comments"] = ""
            df.at[row_idx, "Status"] = "New"
            
            # Update columns
            update_cols = [
                "Review_Date_Time", "Food_Quality", "Service", "Cleanliness", 
                "Value_For_Money", "Overall_Experience", "Additional_Comments", 
                "Review_Type", "Urgency", "Assigned_To", "Actions_Needed", 
                "Internal_Comments", "Status"
            ]
            sheets.update_sheet(self.SHEET_NAME, df, columns_to_update=update_cols)
        else:
            # Create mode
            # Generate incremental ID like Rev_0001
            try:
                df = sheets.read_sheet(self.SHEET_NAME)
                if not df.empty and "Review_ID" in df.columns:
                    existing_ids = df["Review_ID"].tolist()
                    nums = []
                    for rid in existing_ids:
                        if isinstance(rid, str) and rid.startswith("Rev_"):
                            try:
                                nums.append(int(rid.split("_")[1]))
                            except (ValueError, IndexError):
                                pass
                    next_num = max(nums) + 1 if nums else 1
                else:
                    next_num = 1
            except Exception:
                next_num = 1
                
            review_id = f"Rev_{str(next_num).zfill(4)}"
            
            row = [
                review_id,
                review_data.get("Customer_ID", ""),
                review_data.get("Customer_Name", ""),
                review_data.get("Customer_Email", ""),
                timestamp,
                review_data.get("Food_Quality", 0),
                review_data.get("Service", 0),
                review_data.get("Cleanliness", 0),
                review_data.get("Value_For_Money", 0),
                overall_experience,
                review_data.get("Additional_Comments", ""),
                review_type,
                urgency,
                "", # Assigned_To
                "Internal Review", # Actions_Needed (Default)
                "", # Internal_Comments
                "New" # Status
            ]
            sheets.append_row(self.SHEET_NAME, row)
            
        sheets.invalidate_cache(self.SHEET_NAME)
        return {"status": "success", "review_id": review_id}

    def get_latest_review_by_customer(self, email: str):
        """
        Fetches the latest review for a customer by email.
        """
        import pandas as pd
        df = sheets.read_sheet(self.SHEET_NAME)
        if df.empty or "Customer_Email" not in df.columns:
            return None
        
        subset = df[df["Customer_Email"] == email]
        if subset.empty:
            return None
        
        # Latest by timestamp
        subset["Review_Date_Time"] = pd.to_datetime(subset["Review_Date_Time"])
        latest = subset.sort_values(by="Review_Date_Time", ascending=False).iloc[0]
        return latest.to_dict()

    def get_all_reviews(self):
        """
        Fetches all reviews for the Dashboard.
        """
        try:
            rows = sheets.read_sheet_rows(self.SHEET_NAME)
            return rows
        except Exception as e:
            print(f"Error reading reviews: {e}")
            return []

    def update_review(self, review_id: str, update_data: dict):
        """
        Updates specific review fields from the Dashboard.
        [Urgency, Assigned_To, Actions_Needed, Internal_Comments, Status]
        """
        df = sheets.read_sheet(self.SHEET_NAME)
        if "Review_ID" not in df.columns:
            return {"status": "error", "message": "Review_ID column not found"}
        
        idx = df[df["Review_ID"] == review_id].index
        if idx.empty:
            return {"status": "error", "message": f"Review {review_id} not found"}
        
        row_idx = idx[0]
        
        # Update only allowed columns
        allowed_columns = ["Urgency", "Assigned_To", "Actions_Needed", "Internal_Comments", "Status"]
        for col in allowed_columns:
            if col in update_data:
                df.at[row_idx, col] = update_data[col]
        
        # Perform partial update
        sheets.update_sheet(self.SHEET_NAME, df, columns_to_update=allowed_columns)
        sheets.invalidate_cache(self.SHEET_NAME)
        
        return {"status": "success", "message": f"Review {review_id} updated"}

review_service = ReviewService()

# --- FastAPI Router ---

reviews_router = APIRouter()

@reviews_router.post("/submit")
async def submit_review_api(review: ReviewSubmission):
    try:
        result = review_service.submit_review(review.dict())
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@reviews_router.get("/list")
async def list_reviews_api():
    try:
        reviews = review_service.get_all_reviews()
        return reviews
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@reviews_router.get("/customer/{email}")
async def get_latest_review_api(email: str):
    try:
        review = review_service.get_latest_review_by_customer(email)
        if not review:
            return {"status": "not_found"}
        # Clean potential NaN values from dict
        cleaned_review = {k: ("" if (isinstance(v, float) and (v != v)) else v) for k, v in review.items()}
        return cleaned_review
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@reviews_router.patch("/update/{review_id}")
async def update_review_api(review_id: str, review_update: ReviewUpdate):
    try:
        update_dict = {k: v for k, v in review_update.dict().items() if v is not None}
        result = review_service.update_review(review_id, update_dict)
        if result["status"] == "error":
            raise HTTPException(status_code=404, detail=result["message"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
