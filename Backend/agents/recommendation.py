import os
import traceback
import pandas as pd
import math
from typing import List, Dict, Optional
from fastapi import APIRouter
from pydantic import BaseModel

# Centralized Singletons
from services.dependencies import sheets as _sheets, gemini_common as _gemini_combos, groq_common as _groq_pitch
from agents.menu import get_menu_agent

# ---------------------------------------------------------
# Router Setup
# ---------------------------------------------------------
recommendation_router = APIRouter()

# ---------------------------------------------------------
# Request Models
# ---------------------------------------------------------
class AddonRequest(BaseModel):
    customer_email: str
    item_id: str

class PreferencesRequest(BaseModel):
    email: str
    preferences: Dict

class ComboRequest(BaseModel):
    num_combos: int = 3
    customer_id: Optional[str] = None

# Flag for AI vs Smart Combos
GENERATE_AI_COMBOS = True

# ---------------------------------------------------------
# Recommendation Agent Class
# ---------------------------------------------------------
class RecommendationAgent:
    def __init__(self):
        self.spreadsheet_id = os.getenv("SPREADSHEET_ID")
        self.sheets_client   = _sheets
        self.gemini_combos   = _gemini_combos   # combo generation  → GEMINI_API_KEY_COMMON
        self.groq_pitch    = _groq_pitch     # add-on AI pitch   → GROQ_API_KEY
        self.menu_agent = get_menu_agent()
        
        # Strategic Pairings adapted to current Menu
        self.category_pairings = {
            'MAINS FROM THE SEA': {'pairs_with': ['SIDES', 'FROM THE GARDEN', 'DESSERTS'], 'message': 'Perfect with a fresh side or sweet ending!'},
            'GRILLS': {'pairs_with': ['SIDES', 'FROM THE GARDEN', 'DESSERTS'], 'message': 'Complete your grill feast!'},
            'FROM THE GARDEN': {'pairs_with': ['SIDES', 'SOUP', 'DESSERTS'], 'message': 'Healthy and hearty pairings!'},
            'STARTERS FROM THE SEA': {'pairs_with': ['GRILLS', 'MAINS FROM THE SEA', 'SIDES'], 'message': 'Start with seafood, stay with the sea!'},
            'STARTERS FROM THE LAND': {'pairs_with': ['GRILLS', 'MAINS FROM THE SEA', 'MAINS FROM THE LAND'], 'message': 'The perfect opening act!'},
            'SOUP': {'pairs_with': ['FROM THE GARDEN', 'SIDES', 'STARTERS FROM THE LAND'], 'message': 'A warm start to your meal!'},
            'SIDES': {'pairs_with': ['MAINS FROM THE SEA', 'GRILLS', 'FROM THE GARDEN'], 'message': 'Great addition to your main course!'},
            'DESSERTS': {'pairs_with': ['SIDES', 'FROM THE GARDEN'], 'message': 'Sweet treat after your meal!'}
        }
        self._combo_cache = {}

    # ---------------------------------------------------------
    # Core Logic
    # ---------------------------------------------------------
    def get_recommendations(self, email: str, current_item_id: str, skip_pitch: bool = False):
        """Advanced Hybrid Recommendations: History + Category Intelligence"""
        try:
            menu = self.menu_agent.get_menu() # Get active menu
            
            # Find current item details
            current_item = next((i for i in menu if str(i.get("id", "")) == str(current_item_id) or i.get("name") == current_item_id), None)
            
            # Optimization: Read full menu DF once for category lookups
            menu_df = self.sheets_client.read_sheet("Menu")

            # Fetch User Preferences
            diet = self._get_user_dietary_pref(email)

            if not current_item:
                 # Fallback if item not found by ID, try to find by name match or return generic
                 return {"ai_pitch": "Explore our bestsellers!", "add_ons": self._get_popular_fallback(menu_df, diet)[:3]}

            # Strategy 1: Logical Category Pairing
            # Note: menu items from menu_agent might not have 'category' unless we enriched them.
            
            full_item_row = menu_df[menu_df['Item_ID'].astype(str).str.strip() == str(current_item_id).strip()]
            
            if full_item_row.empty:
                 return {"ai_pitch": "Explore our bestsellers!", "add_ons": self._get_popular_fallback(menu_df, diet)[:3]}
            
            item_category = full_item_row.iloc[0]['Item_Category']
            item_name = full_item_row.iloc[0]['Item_Name']

            pairing_info = self.category_pairings.get(item_category, {'pairs_with': ['SIDES', 'DESSERTS']})
            pairing_recs = self._get_items_by_category_from_df(menu_df, pairing_info['pairs_with'], diet, str(current_item_id))

            # Strategy 2: Frequently Bought Together (Order Items Analysis)
            # This uses historical data to find items often ordered with the current item
            history_recs = self._get_frequently_bought_together(str(current_item_id), diet, menu_df)
            
            # Combine and deduplicate
            final_recs = []
            seen_ids = {str(current_item_id)}
            
            # Prioritize history recs, then pairing recs
            for rec in (history_recs + pairing_recs):
                rec_id = str(rec.get('id', ''))
                if rec_id not in seen_ids:
                    final_recs.append(rec)
                    seen_ids.add(rec_id)
                if len(final_recs) >= 3:
                    break

            if not final_recs:
                final_recs = self._get_popular_fallback(menu_df, diet)[:3]

            # AI Pitch - Only if not skipped
            ai_pitch = ""
            if not skip_pitch:
                ai_pitch = self._generate_ai_pitch(item_name, item_category, final_recs)
            else:
                ai_pitch = "Pairs great with your meal!"

            return {"ai_pitch": ai_pitch, "add_ons": final_recs, "item_name": item_name, "category": item_category}

        except Exception as e:
            traceback.print_exc()
            return {"ai_pitch": "Pairs great with your meal!", "add_ons": []}

    def get_upsell_items(self):
        """Simple upsell getter - e.g. desserts or beverages"""
        try:
             menu_df = self.sheets_client.read_sheet("Menu")
             # Filter for 'DESSERTS' or 'SIDES' as upsells
             is_active_mask = menu_df['Is_Active'].astype(str).str.upper().isin(['TRUE', 'ACTIVE', 'YES', '1'])
             upsell_df = menu_df[menu_df['Item_Category'].isin(['DESSERTS', 'SIDES']) & is_active_mask]
             
             # Randomize a bit to keep it fresh
             upsell_items = upsell_df.sample(min(len(upsell_df), 10)).head(5) if not upsell_df.empty else upsell_df

             def _safe_price(value) -> float:
                 try:
                     price = float(str(value).replace(',', ''))
                     return price if math.isfinite(price) else 0.0
                 except (TypeError, ValueError):
                     return 0.0

             def _safe_text(value, fallback=""):
                 if pd.isna(value):
                     return fallback
                 return str(value)

             return [
                 {
                     "id": _safe_text(row.get('Item_ID')),
                     "Item_ID": _safe_text(row.get('Item_ID')),
                     "name": _safe_text(row.get('Item_Name'), 'Unknown Item'),
                     "Item_Name": _safe_text(row.get('Item_Name'), 'Unknown Item'),
                     "price": _safe_price(row.get('Current_Price')),
                     "Current_Price": _safe_price(row.get('Current_Price')),
                     "description": _safe_text(
                         row.get('Item_Description', row.get('Description', 'Delicious add-on')),
                         'Delicious add-on',
                     ),
                     "Is_Veg": (_safe_text(row.get('Is_Veg')).lower() == 'true'),
                     "Category": _safe_text(row.get('Item_Category'), 'Other')
                 }
                 for _, row in upsell_items.iterrows()
             ]
        except Exception:
            return []

    def save_user_preference(self, email: str, preferences: Dict):
        """Saves user preferences to Customer_Preferences sheet"""
        try:
            print(f">>> Saving preferences for {email}")
            
            # 1. Look up User in Customer_Auth to get ID and Name (Case-insensitive)
            auth_rows = self.sheets_client.read_sheet_rows("Customer_Auth")
            target_email = email.strip().lower()
            user_row = next((r for r in auth_rows if str(r.get("Customer_Email", "")).strip().lower() == target_email), None)
            
            if not user_row:
                print(f"!!! User not found in auth: {email}")
                return {"status": "error", "message": "User not found"}
                
            customer_id = user_row.get("Customer_ID", "Unknown")
            customer_name = user_row.get("Customer_Name", "Unknown")

            # 2. Prepare Preference Row
            # Questions mapping: 1:Dietary, 2:Soup, 3:Bun, 4:Dessert
            import time
            new_row = [
                customer_id,
                customer_name,
                email,
                preferences.get("1", ""), # Dietary Type
                preferences.get("2", ""), # Preferred Soup
                preferences.get("3", ""), # Favorite Bun
                preferences.get("4", ""), # Dessert Preference
                time.strftime("%d/%m/%Y %H:%M:%S")
            ]

            # 3. Append to Customer_Preferences
            # Ensure the sheet exists if possible, or just append
            self.sheets_client.append_row("Customer_Preferences", new_row)
            
            # 4. 🔥 Trigger Categorization Agent safely to update insights (Real-time)
            try:
                from agents.categorization import categorize_single_customer
                print(f"Triggering background categorization for {customer_id}")
                categorize_single_customer(customer_id)
            except Exception as cat_err:
                print(f"WARNING: Non-critical error triggering categorization: {cat_err}")
            
            return {"status": "success", "message": "Preferences saved successfully"}
            
        except Exception as e:
            print(f"!!! Error saving preferences: {e}")
            traceback.print_exc()
            return {"status": "error", "message": str(e)}

    def generate_combos(self, num_combos: int = 3, customer_id: str = None) -> List[Dict]:
        """🤖 SUPER AI COMBO GENERATOR - Powered by Gemini with Deep Customer Intelligence"""
        if not GENERATE_AI_COMBOS:
            print("AI Combo Generation is disabled via flag.")
            return []
            
        try:
            # -------------------------------------------------
            # CACHE CHECK
            # -------------------------------------------------
            cache_key = f"{customer_id}_{num_combos}"
            import pandas as pd
            import time
            current_time = time.time()
            CACHE_TTL = 900  # 15 Minutes Cache
            
            if cache_key in self._combo_cache:
                data, timestamp = self._combo_cache[cache_key]
                if current_time - timestamp < CACHE_TTL:
                    return data
            
            # -------------------------------------------------
            # GENERATE NEW
            # -------------------------------------------------
            print(f"Generating {num_combos} Super AI Combos for {customer_id or 'guest'}")
            
            # Step 1: Load active menu
            menu_df = self.sheets_client.read_sheet("Menu")
            is_active_mask = menu_df['Is_Active'].astype(str).str.upper().isin(['TRUE', 'ACTIVE', 'YES', '1'])
            active_items = menu_df[is_active_mask].copy()
            
            if active_items.empty:
                return []

            # Step 2: Gather Customer Intelligence
            customer_insights = self._gather_customer_insights(customer_id) if customer_id else {}
            
            # Step 3: Filter based on dietary preferences (from insights)
            diet = customer_insights.get('dietary_preference', 'General')
            print(f"Applying dietary filter for {customer_id}: {diet}")
            is_veg_diet = any(k in diet.lower() for k in ["veg", "vegetarian", "pure veg"])
            if is_veg_diet:
                if 'Is_Veg' in active_items.columns:
                    active_items = active_items[active_items['Is_Veg'].astype(str).str.upper() == 'TRUE']
                    print(f"Filtered for vegetarian using 'Is_Veg' column. Remaining items: {len(active_items)}")
                else:
                    # Fallback keyword filter
                    non_veg_keywords = ['Chicken', 'Egg', 'Meat', 'Fish', 'Mutton', 'Steak', 'Pork', 'Salmon', 'Beef', 'Prawn']
                    active_items = active_items[~active_items['Item_Name'].str.contains(
                        '|'.join(non_veg_keywords), case=False, na=False
                    )]
                    print(f"Filtered for vegetarian using keyword exclusion. Remaining items: {len(active_items)}")

            # Step 4: Use Gemini AI to generate intelligent combos
            print(f"Calling _generate_ai_super_combos with {len(active_items)} items.")
            ai_combos = self._generate_ai_super_combos(
                active_items=active_items,
                customer_insights=customer_insights,
                num_combos=num_combos
            )

            result = ai_combos[:num_combos]
            
            # UPDATE CACHE
            self._combo_cache[cache_key] = (result, current_time)
            
            return result

        except Exception as e:
            print(f"ERROR: Combo Generation Error: {e}")
            traceback.print_exc()
            return []

    def _gather_customer_insights(self, customer_id: str) -> Dict:
        """🧠 Deep Customer Intelligence Gathering using Customer_Insights & Customer_Preferences"""
        insights = {
            'dietary_preference': 'General',
            'favorite_items': [],
            'preferred_categories': [],
            'order_frequency': 'New Customer',
            'average_order_value': 0,
            'manual_insights': None
        }
        
        try:
            # 1. Primary Source: Customer_Insights sheet
            insights_df = self.sheets_client.read_sheet("Customer_Insights")
            if not insights_df.empty and 'Customer_ID' in insights_df.columns:
                user_insights = insights_df[insights_df['Customer_ID'].astype(str) == str(customer_id)]
                if not user_insights.empty:
                    latest = user_insights.iloc[-1]
                    insights['dietary_preference'] = latest.get('Dietary', 'General')
                    insights['favorite_items'] = str(latest.get('Favorites', '')).split(',')
                    
                    # Handle non-numeric segments in AOV (e.g., 'High Spender')
                    aov_val = latest.get('AOV', 0)
                    try:
                        insights['average_order_value'] = float(str(aov_val).replace(',', '').strip())
                    except:
                        insights['average_order_value'] = 0.0
                        # Preserve the segment name for AI processing
                        insights['aov_segment'] = str(aov_val)
                        
                    insights['order_frequency'] = latest.get('Frequency', 'Occasional Customer')
                    insights['manual_insights'] = latest.get('Attitude', None)
                    print(f"Found data in Customer_Insights for {customer_id}")
                    return insights

            # 2. Fallback: Customer_Preferences sheet (For first-time/new users)
            prefs_df = self.sheets_client.read_sheet("Customer_Preferences")
            if not prefs_df.empty and 'Customer_ID' in prefs_df.columns:
                user_prefs = prefs_df[prefs_df['Customer_ID'].astype(str) == str(customer_id)]
                if not user_prefs.empty:
                    latest_pref = user_prefs.iloc[-1]
                    insights['dietary_preference'] = latest_pref.get('Dietary', 'General')
                    # Could extract prefered bread/beverage here too if needed
                    print(f"Falling back to Customer_Preferences for {customer_id}")
                    
        except Exception as e:
            print(f"WARNING: Error gathering insights for {customer_id}: {e}")
            
        return insights

    def _generate_ai_super_combos(self, active_items, customer_insights: Dict, num_combos: int) -> List[Dict]:
        """🎯 Use Gemini AI to create personalized, intelligent combos"""
        try:
            import json
            import pandas as pd
            
            # Smart Menu Sampling (up to 60 items for context)
            menu_sample = active_items[['Item_Name', 'Item_Category', 'Current_Price']].drop_duplicates().head(60).to_dict('records')
            
            prompt = f"""
            You are an expert restaurant combo designer. Create {num_combos} personalized combo meals.
            
            CUSTOMER PROFILE:
            - Dietary Preference: {customer_insights.get('dietary_preference', 'General')}
            - Order Frequency: {customer_insights.get('order_frequency', 'New Customer')}
            - Favorite Items: {', '.join(customer_insights.get('favorite_items', [])) or 'None yet'}
            - Average Order Value: KSh {customer_insights.get('average_order_value', 0):.0f}
            - Additional Context: {customer_insights.get('manual_insights', 'None')}
            
            AVAILABLE MENU:
            {json.dumps(menu_sample, indent=2)}
            
            RULES:
            1. Each combo must have 2-4 individual items.
            2. Use EXACT item names from the menu.
            3. Balance categories (e.g., Grills/Mains + Side + Soup/Dessert).
            4. Create variety across the {num_combos} combos.
            5. Design combos between KSh {max(1200, customer_insights.get('average_order_value', 0) * 0.8):.0f} and KSh {max(5000, customer_insights.get('average_order_value', 0) * 2.5):.0f}.
            
            Return ONLY a JSON array:
            [
              {{
                "name": "Catchy Combo Name",
                "items": [
                  {{"item_name": "Exact Name", "quantity": 1}},
                  {{"item_name": "Exact Name", "quantity": 1}}
                ],
                "insight": "Explain why this is perfect for them (mention their history/taste)",
                "personalization_score": 95,
                "is_veg": true
              }}
            ]
            """
            
            response = self.gemini_combos.call_gemini_with_retry(prompt)
            if not response: return []
            
            # Clean and parse
            json_str = response.replace("```json", "").replace("```", "").strip()
            if "[" in json_str and "]" in json_str:
                data = json.loads(json_str[json_str.find("["):json_str.rfind("]")+1])
                
                processed = []
                import random
                for i, deal in enumerate(data):
                    combo_items = []
                    for it in deal.get("items", []):
                        it_name = str(it.get('item_name', '')).strip().lower()
                        # Robust matching
                        m = active_items[active_items['Item_Name'].str.strip().str.lower() == it_name]
                        if not m.empty:
                            row = m.iloc[0].to_dict()
                            row['quantity'] = it.get('quantity', 1)
                            combo_items.append(row)
                        else:
                            print(f"WARNING: Could not find menu item: '{it_name}' in active_items ({len(active_items)})")
                            pass # Removed debug print
                    
                    if len(combo_items) >= 2:
                        score = deal.get('personalization_score', 80)
                        discount = 5 + int(score / 20) # 5-10% discount
                        
                        combo_obj = self._create_combo_object(
                            deal.get("name", "Harvest Special"),
                            combo_items,
                            min(15, discount), # cap at 15%
                            deal.get("insight", "Handpicked for you")
                        )
                        combo_obj['personalization_score'] = score
                        # Fix: Ensure Is_Veg reflects actual items if Gemini returns false
                        combo_obj['Is_Veg'] = all(str(i.get('Is_Veg', '')).upper() == 'TRUE' for i in combo_items)
                        processed.append(combo_obj)
                return processed
                
        except Exception as e:
            print(f"AI Super Combo Error: {e}")
            traceback.print_exc()
        return []

    def _create_combo_object(self, name, items, discount_percent, insight):
        """Create combo object with formatted item description including quantities (for Frontend compatibility)"""
        total = sum(float(str(i['Current_Price']).replace(',','')) * i.get('quantity', 1) for i in items)
        price = round(total * (1 - discount_percent/100), 2)
        
        # Format description with quantities
        desc_parts = [f"{i.get('quantity', 1)} {i['Item_Name']}" for i in items]
        description = " + ".join(desc_parts)
        
        # Format items for frontend
        formatted_items = []
        for i in items:
            formatted_items.append({
                "id": str(i.get("Item_ID", i.get("id"))),
                "name": i.get("Item_Name", i.get("name")),
                "price": float(str(i.get("Current_Price", 0)).replace(',','')),
                "quantity": i.get("quantity", 1),
                "category": i.get("Item_Category", "")
            })

        import random
        return {
            "Item_ID": f"combo_{random.randint(1000, 9999)}",
            "Item_Name": name,
            "name": name,
            "Item_Description": description,
            "description": description,
            "Items": formatted_items,
            "items": formatted_items,
            "Combo_Items": formatted_items,
            "Current_Price": price,
            "price": price,
            "Original_Price": total,
            "Discount_Percent": discount_percent,
            "Savings": round(total - price, 2),
            "Is_Personalized": True,
            "Insight": insight,
            "Image_URL": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c"
        }

    def get_offers(self):
        """Returns Tiered Discounts AND Campaign Offers (Migrated from main_Sana.py)"""
        return {
            "offers": [
                {
                    "id": "c1", 
                    "code": "WELCOME50",
                    "title": "Smart Combo Deals",
                    "subtitle": "Best Value Feasts",
                    "discount": "",
                    "discountPercent": 0,
                    "minOrderValue": 0,
                    "bgColor": "gradient-primary",
                    "image": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=300&fit=crop",
                    "type": "campaign"
                },
                {
                    "id": "c2", 
                    "code": "CHEFSPECIAL",
                    "title": "Chef's Specials",
                    "subtitle": "Today's Handpicked",
                    "discount": "",
                    "discountPercent": 0,
                    "minOrderValue": 0,
                    "bgColor": "gradient-gold",
                    "image": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&h=300&fit=crop",
                    "type": "campaign"
                },
                {
                    "id": "c3", 
                    "code": "BESTSELLER",
                    "title": "Bestsellers",
                    "subtitle": "Most Loved Dishes",
                    "discount": "",
                    "discountPercent": 0,
                    "minOrderValue": 0,
                    "bgColor": "gradient-orange",
                    "image": "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&h=300&fit=crop",
                    "type": "campaign"
                }
            ]
        }

    # --- Helpers ---

    def _get_user_dietary_pref(self, email):
        try:
            rows = self.sheets_client.read_sheet_rows("Customer_Preferences")
            user_pref = next((r for r in rows if r.get("Customer_Email") == email), None)
            if user_pref:
                return user_pref.get("Dietary_Type", "General")
            return "General"
        except:
            return "General"

    def _get_items_by_category_from_df(self, df, categories, diet, exclude_id):
        is_active_mask = df['Is_Active'].astype(str).str.upper().isin(['TRUE', 'ACTIVE', 'YES', '1'])
        mask = (df['Item_Category'].isin(categories)) & is_active_mask
        
        # Apply dietary filter
        if diet in ["Vegetarian", "Jain", "Vegan"]:
             if 'Is_Veg' in df.columns:
                 mask &= (df['Is_Veg'].astype(str).str.lower() == 'true')

        if exclude_id:
            mask &= (df['Item_ID'] != exclude_id)
        
        
        items = df[mask].head(3)
        return [
            {
                "id": row['Item_ID'],
                "name": row['Item_Name'],
                "price": float(row['Current_Price']),
                "category": row['Item_Category']
            }
            for _, row in items.iterrows()
        ]

    def _get_frequently_bought_together(self, item_id: str, diet: str, menu_df):
        """Get items frequently bought together based on order history"""
        try:
            order_items_df = self.sheets_client.read_sheet("Order_Items")
            # Clean data
            order_items_df['Item_ID'] = order_items_df['Item_ID'].astype(str).str.strip()
            item_id = str(item_id).strip()
            
            # Find orders containing this item
            order_ids = order_items_df[order_items_df['Item_ID'] == item_id]['Order_ID'].unique()
            
            if len(order_ids) == 0:
                return []

            # Find other items in those orders
            other_items = order_items_df[
                (order_items_df['Order_ID'].isin(order_ids)) & 
                (order_items_df['Item_ID'] != item_id)
            ]
            
            if other_items.empty:
                return []

            # Get top 3 most frequent items
            top_item_ids = other_items['Item_ID'].value_counts().head(3).index.tolist()
            
            return self._format_items_list(top_item_ids, diet, menu_df, "Popular with this item")
            
        except Exception as e:
            print(f"Error in _get_frequently_bought_together: {e}")
            return []

    def _format_items_list(self, item_ids, diet, menu_df, tag=""):
        """Format list of item IDs into recommendation objects"""
        try:
            is_active_mask = menu_df['Is_Active'].astype(str).str.upper().isin(['TRUE', 'ACTIVE', 'YES', '1'])
            active_menu = menu_df[is_active_mask]
            result = []
            
            for item_id in item_ids:
                match = active_menu[active_menu['Item_ID'].astype(str).str.strip() == str(item_id).strip()]
                
                if not match.empty:
                    row = match.iloc[0]
                    
                    # Apply dietary filter
                    is_veg = (str(row.get('Is_Veg', '')).lower() == 'true')
                    if diet in ["Vegetarian", "Jain", "Vegan"] and not is_veg:
                        continue
                    
                    result.append({
                        "id": row['Item_ID'],
                        "Item_ID": row['Item_ID'],
                        "name": row['Item_Name'],
                        "Item_Name": row['Item_Name'],
                        "price": float(str(row['Current_Price']).replace(',', '')),
                        "Current_Price": float(str(row['Current_Price']).replace(',', '')),
                        "Category": row['Item_Category'],
                        "Is_Veg": is_veg,
                        "tag": tag
                    })
            
            return result
        except Exception as e:
            print(f"Error in _format_items_list: {e}")
            return []

    def _get_popular_fallback(self, menu_df, diet="General"):
        """Get popular items as fallback recommendations using Order_Items frequency"""
        try:
            order_items_df = self.sheets_client.read_sheet("Order_Items")
            # Clean data
            order_items_df['Item_ID'] = order_items_df['Item_ID'].astype(str).str.strip()
            
            popular_ids = order_items_df['Item_ID'].value_counts().head(10).index.tolist()
            recs = self._format_items_list(popular_ids, diet, menu_df, "Bestseller")
            
            if recs:
                return recs
                
            # Ultimate fallback if no order history
            is_active_mask = menu_df['Is_Active'].astype(str).str.upper().isin(['TRUE', 'ACTIVE', 'YES', '1'])
            active = menu_df[is_active_mask]
            
            # Simple dietary filter for fallback
            if diet in ["Vegetarian", "Jain", "Vegan"]:
                active = active[active['Is_Veg'].astype(str).str.lower() == 'true']

            return [
                {
                    "id": row['Item_ID'],
                    "Item_ID": row['Item_ID'],
                    "name": row['Item_Name'],
                    "Item_Name": row['Item_Name'],
                    "price": float(str(row['Current_Price']).replace(',', '')),
                    "Current_Price": float(str(row['Current_Price']).replace(',', '')),
                    "Category": row['Item_Category'],
                    "Is_Veg": (str(row.get('Is_Veg', '')).lower() == 'true')
                }
                for _, row in active.head(3).iterrows()
            ]
            
        except Exception as e:
            print(f"Error in _get_popular_fallback: {e}")
            return []

    def _generate_ai_pitch(self, name, cat, recs):
        if not recs: return "Make it a feast with these!"
        try:
            rec_name = recs[0]['name']
            prompt = f"Write a 1-line appetizing pitch for adding {rec_name} to {name} ({cat}). Max 12 words."
            return self.groq_pitch.call_groq_with_retry(prompt) or "Perfect pairing!"
        except:
            return "Perfect combo for your meal! 🍱"


# ---------------------------------------------------------
# DEPENDENCY
# ---------------------------------------------------------
recommendation_agent = RecommendationAgent()

# ---------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------

class PitchRequest(BaseModel):
    item_name: str
    category: str
    recommendations: List[dict]

# ... existing code ...

@recommendation_router.post("/item-addons")
def get_item_addons(req: AddonRequest, skip_pitch: bool = False):
    return recommendation_agent.get_recommendations(req.customer_email, req.item_id, skip_pitch=skip_pitch)

@recommendation_router.post("/ai-pitch")
def get_ai_pitch(req: PitchRequest):
    return {"ai_pitch": recommendation_agent._generate_ai_pitch(req.item_name, req.category, req.recommendations)}

@recommendation_router.get("/upsell-items")
def get_upsell_items():
    return recommendation_agent.get_upsell_items()

@recommendation_router.post("/save-preferences")
def save_preferences(req: PreferencesRequest):
    return recommendation_agent.save_user_preference(req.email, req.preferences)

@recommendation_router.post("/generate-combos")
def generate_combos(req: ComboRequest):
    return {"combos": recommendation_agent.generate_combos(req.num_combos, req.customer_id)}

@recommendation_router.get("/offers")
def get_offers():
    return recommendation_agent.get_offers()

# Alias /coupons to offers for now if needed, or let Order Router handle coupons
