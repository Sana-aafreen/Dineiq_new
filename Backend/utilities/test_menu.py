import requests
import json

try:
    r = requests.post('http://localhost:8000/menu', json={})
    data = r.json()
    sections = data.get('menu_sections', {})
    target_cat = "FROM THE GARDEN"
    if target_cat in sections:
        items = sections[target_cat]
        print(f"\n--- {target_cat} ---")
        for item in items:
            print(f"{item.get('Item_Name')}: {item.get('Item_Description')}")
    else:
        print(f"Category {target_cat} not found. Available: {list(sections.keys())}")
except Exception as e:
    print(f"Error: {e}")
