import { API_BASE_URL } from "@/config";

export const saveLog = async (email: string, action: string, details: string = "") => {
  try {
    const logData = {
      customer_email: email || "anonymous",
      activity: action,
      details: typeof details === 'object' ? JSON.stringify(details) : String(details),
    };

    // Calling our new Python Backend instead of Apps Script
    await fetch(`${API_BASE_URL}/activity/log`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(logData),
    });

    console.log(`📊 Activity Logged: ${action}`);
  } catch (error) {
    console.error("❌ Failed to save activity log:", error);
  }
};