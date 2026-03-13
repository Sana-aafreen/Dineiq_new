import qrcode
import os
from dotenv import load_dotenv

# Load variables from .env file
load_dotenv()

# 1. Folder banayein jahan images save hongi
if not os.path.exists("table_qrs"):
    os.makedirs("table_qrs")

# 2. Get URL from environment or fallback to local dev
BASE_URL = os.getenv("VITE_API_URL", "http://localhost:8080") 

print(f"Generating QR Codes for: {BASE_URL}...\n")

for i in range(1, 11):
    # URL structure: base_url + ?table=number
    data = f"{BASE_URL}/?table={i}"
    
    # QR Code Configuration
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H, 
        box_size=10,
        border=4,
    )
    
    qr.add_data(data)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    
    # Save Image for local host
    filename = f"table_qrs/localhost/LocalHost_Table_{i}.png"
    # Save Image for vercel hosted URL
    # filename = f"table_qrs/vercel/Vercel_Table_{i}.png"

    img.save(filename)
    print(f"✅ Generated: {filename} -> Points to: {data}")

print("\n🎉 All 10 QR Codes generated !")