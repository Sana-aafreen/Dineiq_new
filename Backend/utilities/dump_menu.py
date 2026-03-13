import requests

url = "https://www.harvestkenya.com/menu"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}

try:
    response = requests.get(url, headers=headers, timeout=15)
    print(f"Status: {response.status_code}")
    with open("menu_dump.html", "w", encoding="utf-8") as f:
        f.write(response.text)
    print("Dumped to menu_dump.html")
except Exception as e:
    print(f"Error: {e}")
