# DineIQ Backend

## Description
A modular and scalable backend for DineIQ, built with FastAPI. It leverages AI-driven capabilities for menu management, personalized recommendations, and chatbot interactions.

## Features
- **Authentication:** Secure user authentication with OTP via Gmail.
- **Menu Management:** Dynamic menu fetching and AI-powered combo generation.
- **Order Processing:** Seamless checkout and pricing strategies.
- **AI Recommendations:** Intelligent upselling and cross-selling based on user preferences.
- **Chatbot:** Interactive AI assistant for customer support and queries.
- **Campaigns:** Marketing campaign management tools.

## Tech Stack
- **Framework:** FastAPI
- **Language:** Python 3.11+
- **Database/CMS:** Google Sheets
- **AI Integration:** Google Gemini API
- **Deployment:** AWS EC2, Elastic IP, systemd-managed FastAPI, Nginx 

## Setup Instructions

### Prerequisites
- Python 3.11 or higher
- Git

### Installation
1.  **Clone the repository:**
    ```bash
    git clone <repository_url>
    cd DineIQ-Backend
    ```

2.  **Create a virtual environment:**
    ```bash
    python -m venv venv
    ```

3.  **Activate the virtual environment:**
    - **Windows:**
      ```bash
      venv\Scripts\activate
      ```
    - **macOS/Linux:**
      ```bash
      source venv/bin/activate
      ```

4.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

5.  **Environment Configuration:**
    Create a `.env` file in the root directory and add the following variables:
    ```env
    SPREADSHEET_ID
    APPS_SCRIPT_URL
    GEMINI_API_KEY
    GEMINI_API_KEY_2
    GEMINI_MODEL
    GEMINI_CHAT_LLM_INFERENCE_ENABLED=true
    GEMINI_DIETARY_LLM_INFERENCE_ENABLED=true
    SERVICE_ACCOUNT_FILE
    GMAIL_OAUTH_CLIENT_SECRET
    SERVICE_ACCOUNT_JSON_BASE64
    ALLOWED_ORIGINS
    ```

6.  **Run the application:**
    ```bash
    python main.py
    # OR using uvicorn directly
    uvicorn main:app --reload
    ```
    The server will start at `http://localhost:8000`.

## API Documentation
Once the server is running, you can access the interactive API documentation at:
- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`

## Project Structure
```
Backend/
├── agents/             # AI agents (Menu, Recommendation, Chatbot)
├── routes/             # API route handlers for Auth and Order
├── services/           # Business logic services (llm, sheets, Campaigns)
├── utilities/          # Helper functions and utilities
├── main.py             # Application entry point
├── requirements.txt    # Python dependencies
└── startup.py          # Startup scripts (e.g., credentials decoding)
```

## Contributing
1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/your-feature`).
3.  Commit your changes (`git commit -m 'Add some feature'`).
4.  Push to the branch (`git push origin feature/your-feature`).
5.  Open a Pull Request.

---
**Note:** Ensure all sensitive credentials (like `dineIQ_service_account.json`) are securely managed and not committed directly to version control if possible (use `.gitignore`). The `startup.py` script handles decoding of base64 credentials in production.
