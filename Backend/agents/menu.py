# DineIQ\Backend\agents\menu.py

# ---------------------------------------------------------
# Library and Packages Import
# ---------------------------------------------------------
import os
import json
import pandas as pd
import requests
import re

# import agents and services classes
from services.llm import GeminiClient
from services.dependencies import sheets as _sheets_singleton, gemini_menu as _gemini_singleton

# ---------------------------------------------------------
# Load environment variables
# ---------------------------------------------------------
from dotenv import load_dotenv
load_dotenv()

# ---------------------------------------------------------
# FastAPI router
# ---------------------------------------------------------
from fastapi import APIRouter, Depends
menu_router = APIRouter()

# ---------------------------------------------------------
# Class definition for Menu related interactions
# ---------------------------------------------------------
class MenuAgent:
    def __init__(self):
        self.spreadsheet_id = os.getenv("SPREADSHEET_ID")
        self.menu_sheet_name = "Menu"
        self.external_menu_url = os.getenv("EXTERNAL_MENU_URL")

        if not self.spreadsheet_id:
            raise ValueError("SPREADSHEET_ID is not set in environment variables")

        # Use centralized singletons — no new connections created
        self.sheets_client = _sheets_singleton
        self.gemini_client  = _gemini_singleton

        # Helper Data (Migrated from menu_agent.py)
        self.category_images = {
            'Bread': 'https://images.unsplash.com/photo-1509440159596-0249088772ff',
            'Rice': 'https://images.unsplash.com/photo-1516714435131-44d6b64dc6a2',
            'Gravy': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe',
            'Dry Veg': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd',
            'Starter': 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0',
            'Snacks': 'https://images.unsplash.com/photo-1601050690597-df0568f70950',
            'Beverages': 'https://images.unsplash.com/photo-1437418747212-8d9709afab22',
            'Smoothies': 'https://images.unsplash.com/photo-1505252585461-04db1eb84625',
            'Dessert': 'https://images.unsplash.com/photo-1488477181946-6428a0291777',
            'Raita': 'https://images.unsplash.com/photo-1596797038530-2c107229654b',
        }
        
        self.veg_keywords = ['paneer', 'aloo', 'gobi', 'dal', 'roti', 'naan', 'rice', 
                            'veg', 'vegetable', 'bhindi', 'palak', 'matar', 'raita',
                            'lassi', 'juice', 'smoothie', 'salad']

    def sync_external_menu(self) -> dict:
        """
        Scrape external menu, parse with Gemini, and sync with Google Sheets.
        """
        if not self.external_menu_url:
            raise ValueError("EXTERNAL_MENU_URL is not set")

        print(f"🌐 Scraping menu from: {self.external_menu_url}")
        
        # 1. Scrape Content
        try:
            response = requests.get(self.external_menu_url, timeout=15)
            response.raise_for_status()
            html = response.text

            # Surgical Scraping: Extract data by category blocks
            # 1. Surgical Scraping: Extract by category blocks
            
            # Find all panel start indices
            panel_matches = list(re.finditer(r'role="tabpanel"\s+aria-label="([^"]+)"', html))
            
            extracted_blocks = []
            for i in range(len(panel_matches)):
                category = panel_matches[i].group(1)
                start = panel_matches[i].end()
                # End is the start of the next panel, or the end of the string
                end = panel_matches[i+1].start() if i + 1 < len(panel_matches) else len(html)
                panel_html = html[start:end]
                
                # Now find items in this panel
                # We look for all <div class="menu-item"> blocks and take everything until the next one
                item_matches = list(re.finditer(r'<div class="menu-item">', panel_html))
                for j in range(len(item_matches)):
                    i_start = item_matches[j].end()
                    i_end = item_matches[j+1].start() if j + 1 < len(item_matches) else len(panel_html)
                    item_html = panel_html[i_start:i_end]
                    
                    # Extract fields
                    t_match = re.search(r'<div class="menu-item-title">([^<]+)</div>', item_html)
                    d_match = re.search(r'<div class="menu-item-description">([^<]+)</div>', item_html)
                    # Some have price in Top, some in Bottom. Usually <span class="currency-sign"></span>PRICE
                    p_match = re.search(r'<span class="currency-sign"></span>\s*([\d,.]+)', item_html)
                    
                    title = t_match.group(1).strip() if t_match else "N/A"
                    desc = d_match.group(1).strip() if d_match else ""
                    price = p_match.group(1).strip() if p_match else ""
                    
                    if title != "N/A":
                        extracted_blocks.append(f"CAT: {category} | ITEM: {title} | DESC: {desc} | PRICE: {price}")
            
            raw_text = "\n".join(extracted_blocks)
            if not raw_text:
                # Fallback to plain text if regex fails
                raw_text = re.sub(r'<[^>]+>', ' ', html)
                raw_text = re.sub(r'\s+', ' ', raw_text).strip()
        except Exception as e:
            print(f"⚠️ Scraping refinement failed, using fallback: {e}")
            raw_text = re.sub(r'<[^>]+>', ' ', html)
            raw_text = re.sub(r'\s+', ' ', raw_text).strip()

        # 2. AI Parsing with Gemini
        print("🤖 Parsing menu with Gemini...")
        truncated_text = raw_text[:15000]  # Safety limit
        prompt = f"""
        Convert the following restaurant menu text into a structured JSON list.
        Each object MUST have:
        - "Item_Name": The name of the dish.
        - "Item_Category": Strictly one of [FROM THE GARDEN, SOUP, STARTERS FROM THE SEA, STARTERS FROM THE LAND, STEAMED BAO BUNS, BURGERS & SANDWICHES, PASTA, MAINS FROM THE LAND, MAINS FROM THE SEA, GRILLS, SIDES, CHILDREN'S MENU, DESSERTS]
        - "Current_Price": Numerical value only (remove commas).
        - "Item_Description": The contents or description of the dish.

        Raw Text:
        {truncated_text}

        Output format (STRICT JSON ONLY):
        [
          {{"Item_Name": "...", "Item_Category": "...", "Current_Price": 1200, "Item_Description": "..."}}
        ]
        
        CRITICAL: Ensure all strings are correctly JSON-escaped. Escape any newlines within descriptions as "\\n". 
        Do not include any other text or markdown decorators.
        """
        
        ai_response = self.gemini_client.call_gemini_with_retry(prompt)
        
        if not ai_response:
            raise ValueError("AI failed to parse the menu")

        try:
            # Clean possible markdown block
            clean_json = re.sub(r'```json|```', '', ai_response).strip()
            results = json.loads(clean_json, strict=False)
        except Exception as e:
            print(f"❌ Failed to parse Gemini response: {e}")
            return {"status": "ERROR", "message": "AI parsing failed"}

        # 3. Sync with Sheets
        print(f"📊 Syncing {len(results)} items with Google Sheets...")
        
        current_data = self.sheets_client.read_sheet(self.menu_sheet_name).to_dict('records')
        new_items_count = 0
        updated_count = 0
        deactivated_count = 0
        skipped_count = 0

        # Helper to get max ID
        def get_next_id(data_list):
            ids = []
            for row in data_list:
                val = str(row.get('Item_ID', ''))
                if val.startswith('Item_'):
                    match = re.search(r'(\d+)', val)
                    if match:
                        ids.append(int(match.group(1)))
            next_num = max(ids) + 1 if ids else 1
            return f"Item_{str(next_num).zfill(4)}"

        # 4. Compare and Update existing
        external_items_lookup = {str(item.get('Item_Name', '')).lower().strip(): item for item in results if item.get('Item_Name')}
        
        updated_data = []
        processed_names = set()

        for existing_row in current_data:
            name = str(existing_row.get('Item_Name', '')).lower().strip()
            if not name:
                updated_data.append(existing_row)
                continue
                
            if name in external_items_lookup:
                ext_item = external_items_lookup[name]
                processed_names.add(name)
                
                is_changed = False
                new_price = str(ext_item.get('Current_Price', '')).replace(",", "")
                new_desc = str(ext_item.get('Item_Description', '')).strip()
                new_cat = str(ext_item.get('Item_Category', '')).strip()
                
                # Check for updates - only Base_Price as requested
                if str(existing_row.get('Base_Price')) != new_price:
                    existing_row['Base_Price'] = new_price
                    is_changed = True
                
                if str(existing_row.get('Item_Description', '')).strip() != new_desc:
                    existing_row['Item_Description'] = new_desc
                    is_changed = True
                
                if str(existing_row.get('Item_Category', '')).strip() != new_cat:
                    existing_row['Item_Category'] = new_cat
                    is_changed = True
                
                # Matched items remain/become ACTIVE
                if str(existing_row.get('Is_Active')).upper() != "ACTIVE":
                    existing_row['Is_Active'] = "ACTIVE"
                    is_changed = True
                
                if is_changed:
                    updated_count += 1
                else:
                    skipped_count += 1
                
                updated_data.append(existing_row)
            else:
                # Unmatched items become INACTIVE
                if str(existing_row.get('Is_Active')).upper() != "INACTIVE":
                    existing_row['Is_Active'] = "INACTIVE"
                    deactivated_count += 1
                    updated_data.append(existing_row)
                else:
                    updated_data.append(existing_row)

        # 5. Add NEW items at the end
        for name_lower, ext_item in external_items_lookup.items():
            if name_lower not in processed_names:
                new_price = str(ext_item.get('Current_Price', '')).replace(",", "")
                new_item = {
                    "Item_ID": get_next_id(updated_data),
                    "Item_Name": ext_item.get('Item_Name'),
                    "Item_Category": ext_item.get('Item_Category'),
                    "Base_Price": new_price,
                    "Low_Cap_Price": new_price,
                    "High_Cap_Price": new_price,
                    "Current_Price": new_price,
                    "Item_Description": ext_item.get('Item_Description', ''),
                    "Is_Active": "ACTIVE"
                }
                updated_data.append(new_item)
                new_items_count += 1

        # 6. Save if changes
        if new_items_count > 0 or updated_count > 0 or deactivated_count > 0:
            new_df = pd.DataFrame(updated_data).fillna("")
            cols = new_df.columns.tolist()
            self.sheets_client.update_sheet(self.menu_sheet_name, new_df, columns_to_update=cols)
            status = "SUCCESS"
        else:
            status = "NO_CHANGE"

        return {
            "status": status,
            "new_items": new_items_count,
            "updated": updated_count,
            "deactivated": deactivated_count,
            "skipped": skipped_count
        }
    # -------------------------------------------------------------------
    # 🍽️ Public API
    # -------------------------------------------------------------------
    def get_menu(self) -> list[dict]:
        """
        Fetch all active dishes from menu sheet.
        Returns only name & current price.
        """

        df = self.sheets_client.read_sheet(self.menu_sheet_name)

        # Defensive column check
        # Item_ID	Item_Name	Item_Category	Base_Price	Low_Cap_Price	High_Cap_Price	Current_Price   Item_Description	Is_Active
        required_columns = {"Item_ID", "Item_Name", "Item_Category", "Base_Price", "Low_Cap_Price", "High_Cap_Price", "Current_Price", "Item_Description", "Is_Active"}
        missing = required_columns - set(df.columns)
        if missing:
            raise ValueError(f"Missing columns in Menu sheet: {missing}")

        # Normalize Is_Active
        df["Is_Active_Parsed"] = (
            df["Is_Active"]
            .astype(str)
            .str.strip()
            .str.upper()
            .isin(["ACTIVE", "TRUE", "1", "YES"])
        )

        # Filter active items
        df = df[df["Is_Active_Parsed"]]

        # Shape response for frontend
        results = []
        for _, row in df.iterrows():
            try:
                price_val = row.get("Current_Price")
                price = float(price_val) if price_val and str(price_val).strip() != "" else None
                results.append({
                    "name": str(row.get("Item_Name", "")),
                    "price": price,
                    "description": str(row.get("Item_Description", ""))
                })
            except (ValueError, TypeError):
                results.append({
                    "name": str(row.get("Item_Name", "")),
                    "price": None,
                    "description": str(row.get("Item_Description", ""))
                })
        return results

    # -------------------------------------------------------------------
    # 🔹 Format menu for frontend (simplified)
    # -------------------------------------------------------------------
    def format_menu(self, menu_df) -> list[dict]:
        """
        Convert menu dataframe into a list of dictionaries for frontend consumption.

        Matching can include one or more of:
            - Dietary
            - AOV
            - Attitude
            - Favorites
        """

        print("\nFormatting the Menu")
        formatted_menu = []

        # Heuristic: top 30% Gemini-ranked items are considered AOV/Attitude aligned
        if "gemini_rank" in menu_df.columns and not menu_df.empty:
            rank_threshold = max(1, int(len(menu_df) * 0.3))
        else:
            rank_threshold = None

        # test logic with final output ranking
        menu_df = menu_df.reset_index(drop=True)

        for _, row in menu_df.iterrows():
            matches = []

            # Favorites (explicit)
            if row.get("is_favorite", False):
                matches.append("Favorites")

            # Dietary (implicit — Gemini already filtered)
            matches.append("Dietary")

            # AOV / Attitude (implicit via Gemini ranking)
            if rank_threshold is not None and row.get("gemini_rank", 9999) < rank_threshold:
                matches.extend(["AOV", "Attitude"])

            formatted_menu.append({
                "name": row.get("Item_Name", ""),
                "price": (
                    float(row["Current_Price"])
                    if row.get("Current_Price") not in (None, "")
                    else None
                ),
                "description": row.get("Item_Description", ""),
                "matching": matches if matches else None,
                "rank": int(_ + 1)  # 🔍 TEST ONLY — safe to remove

            })

        return formatted_menu

    # -------------------------------------------------------------------
    # 🍽️ Personalized Menu
    # -------------------------------------------------------------------
    def get_customized_menu(self, customer_id: str) -> list[dict]:
        """
        Returns personalized menu for a customer based on the following categories
        already derived in Customer_Insights sheet.

        HARD RULE:
        - Dietary preference is a strict filter (handled by Gemini).

        SOFT RULES:
        - Favorites
        - AOV
        - Attitude
        are used only for ranking, not filtering.
        """

        # -------------------------------------------------
        # 1️⃣ LOAD MENU
        # -------------------------------------------------
        menu_df = self.sheets_client.read_sheet(self.menu_sheet_name)
        

        if menu_df.empty:
            return []

        print("Menu has ", len(menu_df), " items")

        # Normalize Is_Active
        menu_df["Is_Active"] = (
            menu_df["Is_Active"]
            .astype(str)
            .str.strip()
            .str.lower()
            .isin(["active", "1", "yes", "true"])
        )

        # Filter active items
        menu_df = menu_df[menu_df["Is_Active"]]

        print("Menu has ", len(menu_df), " active items")

        # Normalize
        menu_df["Item_Name"] = menu_df["Item_Name"].astype(str)
        menu_df["Current_Price"] = menu_df["Current_Price"].astype(float)

        # -------------------------------------------------
        # 2️⃣ LOAD CUSTOMER INSIGHTS
        # -------------------------------------------------
        insights_df = self.sheets_client.read_sheet("Customer_Insights")
        customer_df = insights_df[insights_df["Customer_ID"] == customer_id]

        print("Found ", len(insights_df), " customers insights")
        print()
        print("Inferring: ")

        if customer_df.empty:
            print("\nReturning Original Menu")
            return self.format_menu(menu_df)

        customer = customer_df.iloc[0]

        dietary_pref = str(customer.get("Dietary", "")).strip()
        favorites_raw = str(customer.get("Favorites", ""))
        aov = str(customer.get("AOV", "")).strip()
        attitude = str(customer.get("Attitude", "")).strip()

        favorites = {
            fav.strip().lower()
            for fav in favorites_raw.split(",")
            if fav.strip()
        }

        print(customer["Customer_ID"])
        print(customer["Customer_Name"])
        print(dietary_pref)
        print(favorites)
        print(aov)
        print(attitude)
        print()

        # -------------------------------------------------
        # 3️⃣ PREPARE SAFE MENU (Gemini decides dietary)
        # -------------------------------------------------
        menu_items_for_llm = [
            {
                "name": row["Item_Name"],
                "price": row["Current_Price"],
            }
            for _, row in menu_df.iterrows()
        ]

        customer_profile = {
            "dietary": dietary_pref,
            "favorites": list(favorites),
            "aov": aov,
            "attitude": attitude,
        }

        # -------------------------------------------------
        # 4️⃣ GEMINI: FILTER + RANK (STRICT DIETARY)
        # -------------------------------------------------
        ranked_names = self.rank_menu_items_with_gemini(
            menu_items=menu_items_for_llm,
            customer_profile=customer_profile,
        )

        if not ranked_names:
            print("\nNo response from LLM, Returning Original Menu")
            return self.format_menu(menu_df)

        print("Ranking the menu items returned by LLM")

        # Keep only items Gemini approved
        menu_df = menu_df[
            menu_df["Item_Name"].isin(ranked_names)
        ].copy()

        menu_df["gemini_rank"] = menu_df["Item_Name"].apply(
            lambda x: ranked_names.index(x)
        )

        # -------------------------------------------------
        # 5️⃣ FAVORITES BOOST (FINAL TIE-BREAKER)
        # -------------------------------------------------
        # menu_df["is_favorite"] = (
        #     menu_df["Item_Name"].str.lower().isin(favorites)
        # )

        def is_favorite_item(item_name: str, favorites: set[str]) -> bool:
            item = item_name.lower()
            return any(
                fav in item
                for fav in favorites
            )

        menu_df["is_favorite"] = menu_df["Item_Name"].apply(
            lambda name: is_favorite_item(name, favorites)
        )

        # -------------------------------------------------
        # 6️⃣ FINAL SORTING
        # -------------------------------------------------
        print("Sorting the menu items based on rank")
        menu_df = menu_df.sort_values(
            by=["is_favorite", "gemini_rank"],
            ascending=[False, True],
        )

        # -------------------------------------------------
        # 7️⃣ FORMAT FOR FRONTEND
        # -------------------------------------------------
        print("\nReturning Customized Menu")
        return self.format_menu(menu_df)

    
    # -------------------------------------------------------------------
    # 🤖 Gemini-based ranking (SAFE + INTERPRETIVE)
    # -------------------------------------------------------------------
    def rank_menu_items_with_gemini(
        self,
        menu_items: list[dict],
        customer_profile: dict
    ) -> list[str]:
        """
        Uses Gemini to:
        1. Remove items violating dietary preference
        2. Rank remaining items using AOV + Attitude
        """

        if not menu_items:
            return []

        item_names = [item["name"] for item in menu_items]
        import json
        prompt = f"""
    You are a restaurant menu personalization assistant.

    The customer attributes below are PRE-CLASSIFIED.
    DO NOT reinterpret them.

    Customer Profile:
    - Dietary: {customer_profile.get("dietary")}
    - Favorites: {customer_profile.get("favorites")}
    - AOV Segment: {customer_profile.get("aov")}
    - Attitude Segment: {customer_profile.get("attitude")}

    STRICT RULES:
    - REMOVE menu items that violate the dietary preference.
    - Dietary meanings:
    - Vegetarian → no meat, fish
    - Vegan → no animal products
    - Eggetarian → veg + egg
    - Jain → no onion, garlic, root vegetables
    - Non-Vegetarian → allow all
    - Do NOT invent items.
    - Do NOT rename items.

    SOFT RANKING RULES:
    - Favorites should be ranked higher when reasonable.
    - AOV:
    - Low Spender → value-for-money
    - Mid Spender → balanced
    - High / Premium → expensive / premium items
    - Attitude:
    - Value-Seeker → safe, popular, good value
    - Quality-Seeker → premium, chef-special
    - Refund-Prone → safe, familiar, low-risk

    Menu Items (name + price):
    {json.dumps(menu_items, indent=2)}

    OUTPUT FORMAT (IMPORTANT):
    - Return ONLY a valid JSON array of item names
    - First items = best recommendations
    - No explanation, no markdown
    """

        gemini_client = self.gemini_client   # reuse singleton — do NOT create a new instance here
        response = gemini_client.call_gemini_with_retry(prompt)

        if not response:
            return item_names

        try:
            ranked = json.loads(response)
            if isinstance(ranked, list):
                print("\nReturning Ranked Menu")
                return ranked
        except Exception:
            pass

        return item_names

    # -------------------------------------------------------------------
    # 🚧 Future Extensions (stubs)
    # -------------------------------------------------------------------
    def get_smart_combos(self, customer_id: str) -> list:
        return []

    # -------------------------------------------------------------------
    # 🧠 Smart Menu / Frontend Logic (Migrated from menu_agent.py)
    # -------------------------------------------------------------------
    def _is_veg_item(self, item_name: str, category: str = "", description: str = "") -> bool:
        """
        Detect if item is vegetarian with precedence: Category -> Name -> Description.
        Returns False if any 'non-veg' hint is found in order.
        """
        non_veg_keywords = [
            'chicken', 'mutton', 'fish', 'egg', 'meat', 'prawn', 'lamb', 
            'beef', 'pork', 'ham', 'bacon', 'seafood', 'sea food', 'salmon', 
            'tuna', 'lobster', 'crab', 'shrimp', 'squid', 'duck', 'steak', 
            'salami', 'pepperoni', 'wings', 'calamari', 'calamares', 
            'ostrich', 'turkey', 'prosciutto', 'anchovies', 'venison', 
            'quail', 'scallops', 'mussels', 'octopus', 'steakhouse', 
            'brisket', 'ribs', 'bolognese', 'carbonara', 'pancetta',
            'sausage', 'chorizo', 'salamini', 'meatball', 'meat ball'
        ]
        
        non_veg_categories = [
            'STARTERS FROM THE SEA', 'MAINS FROM THE SEA', 'GRILLS'
        ]

        # 1. Check Category (Precedence 1)
        cat_lower = str(category).upper()
        if any(cv in cat_lower for cv in non_veg_categories):
            return False
            
        # 2. Check Name (Precedence 2)
        name_lower = str(item_name).lower()
        if any(word in name_lower for word in non_veg_keywords):
            return False
            
        # 3. Check Description (Precedence 3)
        desc_lower = str(description).lower()
        if any(word in desc_lower for word in non_veg_keywords):
            return False

        # If none of the non-veg hints match, check if it's explicitly veg
        if any(word in name_lower for word in self.veg_keywords):
            return True

        return True # Default safe if no non-veg hint found

    def _get_image_for_item(self, category: str, item_name: str) -> str:
        """Get appropriate image based on category or item name"""
        if category in self.category_images: return self.category_images[category]
        
        name_lower = str(item_name).lower()
        if 'paneer' in name_lower or 'butter' in name_lower: return 'https://images.unsplash.com/photo-1585937421612-70a008356fbe'
        elif 'biryani' in name_lower or 'rice' in name_lower: return 'https://images.unsplash.com/photo-1516714435131-44d6b64dc6a2'
        elif 'naan' in name_lower or 'roti' in name_lower: return 'https://images.unsplash.com/photo-1509440159596-0249088772ff'
        elif 'dal' in name_lower: return 'https://images.unsplash.com/photo-1546833999-b9f581a1996d'
        elif 'dessert' in name_lower or 'sweet' in name_lower: return 'https://images.unsplash.com/photo-1488477181946-6428a0291777'
        return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'

    def _get_item_description(self, category: str, item_name: str) -> str:
        """Generate description based on category"""
        descriptions = {
            'Bread': 'Freshly baked bread',
            'Rice': 'Aromatic basmati rice',
            'Gravy': 'Rich and flavorful curry',
            'Dry Veg': 'Delicious dry preparation',
            'Starter': 'Perfect appetizer',
            'Snacks': 'Tasty snack',
            'Beverages': 'Refreshing beverage',
            'Smoothies': 'Healthy smoothie',
            'Dessert': 'Sweet treat',
            'Raita': 'Cool yogurt accompaniment'
        }
        return descriptions.get(category, f'Delicious {category}')

    def get_smart_menu(self, email: str | None = None) -> dict:
        import pandas as pd
        """
        Get menu organized smartly for DineIQ frontend (Sections: Favorites, Bestsellers, etc.)
        Reads Orders and Order_Items from Sheets for history.
        """
        try:
            # Load Data
            menu_df = self.sheets_client.read_sheet("Menu")
            
            # Defensive Handling for Empty Sheets
            try:
                orders_df = self.sheets_client.read_sheet("Orders")
            except:
                orders_df = pd.DataFrame(columns=['Order_ID', 'Customer_ID'])
                
            try:
                order_items_df = self.sheets_client.read_sheet("Order_Items")
            except:
                order_items_df = pd.DataFrame(columns=['Order_ID', 'Item_ID', 'Item_Name'])

            # Filter Active
            valid_status = ['active', '1', 'yes', 'true']
            menu_df["Is_Active"] = menu_df["Is_Active"].astype(str).str.strip().str.lower().isin(valid_status)
            active_df = menu_df[menu_df["Is_Active"]].copy()
            
            if active_df.empty: active_df = menu_df.copy() # Fallback

            menu_sections = {}

            def format_item(row) -> dict:
                item_name = str(row.get('Item_Name', 'Unknown')).strip()
                category = str(row.get('Item_Category', 'General')).strip()
                
                # Robust description fetching
                # Check for Item_Description, then description (case-insensitive)
                description = ""
                for key in ['Item_Description', 'description', 'Description']:
                    val = row.get(key)
                    if val and str(val).lower() != 'nan' and str(val).strip() != "":
                        description = str(val).strip()
                        break
                
                if not description:
                    description = self._get_item_description(category, item_name)
                
                is_veg = self._is_veg_item(item_name, category, description)
                
                return {
                    'Item_ID': str(row.get('Item_ID', '')),
                    'Item_Name': item_name,
                    'Item_Description': description,
                    'Current_Price': float(row['Current_Price']) if row.get('Current_Price') and str(row['Current_Price']).lower() != 'nan' else 0.0,
                    'Image_URL': self._get_image_for_item(category, item_name),
                    'Is_Veg': is_veg,
                    'Item_Category': category,
                    'Dietary_Type': 'Veg' if is_veg else 'Non-Veg'
                }

            # 1. YOUR FAVORITES
            if email and not orders_df.empty and not order_items_df.empty:
                try:
                    # Filter Orders by Email (part of Customer_ID usually)
                    matching_orders = orders_df[orders_df['Customer_ID'].str.contains(email.split('@')[0], case=False, na=False)]
                    if not matching_orders.empty:
                        past_items = order_items_df[order_items_df['Order_ID'].isin(matching_orders['Order_ID'])]['Item_Name'].unique()
                        fav_items = active_df[active_df['Item_Name'].isin(past_items)]
                        if not fav_items.empty:
                            menu_sections["Your Favorites"] = [format_item(row) for _, row in fav_items.iterrows()]
                except Exception as e:
                    print(f"Stats Error (Favorites): {e}")

            # 2. BESTSELLERS
            if not order_items_df.empty:
                try:
                    popular_names = order_items_df['Item_Name'].value_counts().head(6).index
                    bestsellers = active_df[active_df['Item_Name'].isin(popular_names)]
                    if not bestsellers.empty:
                        menu_sections["Bestseller"] = [format_item(row) for _, row in bestsellers.iterrows()]
                except Exception as e:
                    print(f"Stats Error (Bestsellers): {e}")

            # 3. CHEF'S SPECIAL (Price Top 30%)
            try:
                active_df['Price_Float'] = pd.to_numeric(active_df['Current_Price'], errors='coerce').fillna(0)
                sorted_by_price = active_df.sort_values(by='Price_Float', ascending=False)
                chef_special = sorted_by_price.head(max(1, int(len(sorted_by_price) * 0.3))).head(8)
                if not chef_special.empty:
                    menu_sections["Chef Special"] = [format_item(row) for _, row in chef_special.iterrows()]
            except Exception as e:
                print(f"Stats Error (Chef Special): {e}")

            # 4. CATEGORIES
            # Preserve order from sheet: keys of active_df['Item_Category'] in order of appearance
            categories = active_df['Item_Category'].unique()
            for category in categories:
                if not category: continue
                cat_items = active_df[active_df['Item_Category'] == category]
                if not cat_items.empty:
                    menu_sections[category] = [format_item(row) for _, row in cat_items.iterrows()]

            return {
                "status": "success",
                "menu_sections": menu_sections,
                "total_items": len(active_df),
                "categories": list(menu_sections.keys())
            }

        except Exception as e:
            import traceback
            traceback.print_exc()
            return {"status": "error", "message": str(e), "menu_sections": {}}


# ---------------------------------------------------------
# Dependency: MenuAgent instance
# ---------------------------------------------------------
menu_agent = MenuAgent()

def get_menu_agent() -> MenuAgent:
    return menu_agent


# ---------------------------------------------------------
# 🍽️ API Endpoints
# ---------------------------------------------------------
@menu_router.get("/complete")
def fetch_menu(agent: MenuAgent = Depends(get_menu_agent)):
    """
    Fetch full active menu (non-personalized)
    """
    return agent.get_menu()


@menu_router.get("/customized/{customer_id}")
def fetch_custom_menu(
    customer_id: str,
    agent: MenuAgent = Depends(get_menu_agent)
):
    """
    Fetch personalized menu for a customer (using insights)
    """
    return agent.get_customized_menu(customer_id)

@menu_router.post("")
def get_smart_menu_endpoint(
    dataset: dict, 
    agent: MenuAgent = Depends(get_menu_agent)
):
    """
    Main Menu Endpoint - Returns Sections (Favorites, Bestsellers, Categories)
    """
    email = dataset.get("email") or dataset.get("customer_email")
    return agent.get_smart_menu(email)


@menu_router.post("/sync-external")
async def sync_external_menu(agent: MenuAgent = Depends(get_menu_agent)):
    """
    Sync menu from harvestkenya.com/menu using AI extraction.
    """
    try:
        result = agent.sync_external_menu()
        return result
    except Exception as e:
        from fastapi import HTTPException
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

