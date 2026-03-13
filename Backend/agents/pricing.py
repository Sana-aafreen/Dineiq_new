from typing import List, Dict
# import traceback

class PricingAgent:
    def __init__(self):
        # Pricing rules (Zomato-style logic) 
        self.discount_tiers = [
            {"threshold": 500, "discount": 5, "name": "DINE5"},
            {"threshold": 800, "discount": 10, "name": "DINE10"},
            {"threshold": 1200, "discount": 15, "name": "DINE15"}
        ]
        
        # Loyalty Tiers structure 
        self.loyalty_tiers = {
            "Bronze": {"min_orders": 0, "points_multiplier": 1},
            "Silver": {"min_orders": 3, "points_multiplier": 1.5},
            "Gold": {"min_orders": 7, "points_multiplier": 2},
            "Platinum": {"min_orders": 15, "points_multiplier": 2.5}
        }

    def get_pricing_strategy(self, subtotal: float, order_count: int, cart_items: List[Dict] = None):
        """Generate comprehensive pricing intelligence for DineIQ"""
        try:
            subtotal = float(subtotal) if subtotal is not None else 0.0
            order_count = int(order_count) if order_count is not None else 0
            
            # 1. Loyalty Tier & Rewards Calculation
            tier_info = self._get_loyalty_info(order_count)
            # Logic: Har ₹10 par multiplier ke hisaab se points
            points = int((subtotal // 10) * tier_info["multiplier"])
            
            # 2. Tier Discount Calculation
            applicable_discount = self._find_discount_tier(subtotal)
            discount_amount = (subtotal * (applicable_discount["discount"] / 100)) if applicable_discount else 0.0
            
            # 3. Dynamic Combo Check (Smart detection for balanced meal)
            combo_info = self._calculate_combo_discount(cart_items)
            
            # 4. Upsell Nudge Generation (The 'Greedy' Salesman)
            upsell_nudge = self._generate_upsell_nudge(subtotal)
            
            # 5. Dynamic Coupon List
            available_coupons = self._get_coupons(order_count, subtotal)
            
            final_total = subtotal - discount_amount
            
            return {
                "pricing": {
                    "subtotal": round(subtotal, 2),
                    "discount_applied": {
                        "name": applicable_discount["name"] if applicable_discount else None,
                        "percent": applicable_discount["discount"] if applicable_discount else 0,
                        "amount": round(discount_amount, 2)
                    },
                    "final_total": round(final_total, 2),
                    "reward_points": {
                        "earned": points,
                        "tier": tier_info["tier"],
                        "message": f"✨ You earned {points} points!"
                    },
                    "loyalty_status": {
                        "current_tier": tier_info["tier"],
                        "next_tier": tier_info["next_tier"],
                        "orders_to_next": tier_info["to_next"]
                    },
                    "available_coupons": available_coupons,
                    "upsell_nudge": upsell_nudge,
                    "combo_details": combo_info,
                    "savings_summary": f"💰 You saved KSh {round(discount_amount, 2)} on this order!" if discount_amount > 0 else None
                }
            }
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {"pricing": {"subtotal": subtotal, "final_total": subtotal, "error": str(e)}}

    # --- Internal Helper Methods ---

    def _get_loyalty_info(self, count):
        """Calculates current tier and distance to the next one"""
        if count >= 15: 
            return {"tier": "Platinum", "multiplier": 2.5, "next_tier": None, "to_next": 0}
        elif count >= 7: 
            return {"tier": "Gold", "multiplier": 2.0, "next_tier": "Platinum", "to_next": 15 - count}
        elif count >= 3: 
            return {"tier": "Silver", "multiplier": 1.5, "next_tier": "Gold", "to_next": 7 - count}
        return {"tier": "Bronze", "multiplier": 1.0, "next_tier": "Silver", "to_next": 3 - count}

    def _find_discount_tier(self, subtotal):
        applicable = None
        # Sort desc taaki sabse bada eligible discount mile
        for tier in sorted(self.discount_tiers, key=lambda x: x['threshold'], reverse=True):
            if subtotal >= tier['threshold']:
                applicable = tier
                break
        return applicable

    def _generate_upsell_nudge(self, subtotal):
        """Visual nudge to push users to cross the next discount threshold"""
        next_t = next((t for t in self.discount_tiers if subtotal < t['threshold']), None)
        if next_t:
            gap = next_t['threshold'] - subtotal
            return {
                "show": True,
                "message": f"Add KSh {int(gap)} more to unlock {next_t['discount']}% OFF! 🚀",
                "gap": round(gap, 2)
            }
        return {"show": False, "message": "Max discount reached! 🎉"}

    def _calculate_combo_discount(self, cart):
        """DineIQ logic: detecting if Main Course + Starters/Sides + Desserts are present"""
        if not cart or len(cart) < 2: return None
        # Normalizing categories for matching
        cats = [str(i.get('category', '')).upper().strip() for i in cart]
        
        has_main = any(c in ['MAINS FROM THE SEA', 'MAINS FROM THE LAND', 'GRILLS', 'BURGERS & SANDWICHES'] for c in cats)
        has_side = any(c in ['SIDES', 'STARTERS FROM THE SEA', 'STARTERS FROM THE LAND', 'SOUP', 'STEAMED BAO BUNS'] for c in cats)
        has_dessert = any(c in ['DESSERTS'] for c in cats)
        
        if has_main and has_side and has_dessert:
            return {"eligible": True, "type": "Grand Harvest Feast", "msg": "🎊 Smart Combo: 15% Savings Unlocked!"}
        elif has_main and (has_side or has_dessert):
            return {"eligible": True, "type": "Harvest Meal", "msg": "🍽️ Smart Combo Applied!"}
        return None

    def _get_coupons(self, order_count, subtotal):
        """Returns valid coupon codes including Campaign Coupons (Rich UI Data)"""
        coupons = []
        
        # 1. Static Campaign Coupons (Rich Data for Frontend)
        # Adapted for KSh and current loyalty rules
        campaign_coupons = [
            {
                "code": "HARVEST50",
                "title": "Flat KSh 50 OFF",
                "subtitle": "On orders above KSh 299",
                "minOrderValue": 299,
                "discountAmount": 50,
                "type": "flat",
                "color": "from-orange-500 to-red-500",
                "status": "Available" if subtotal >= 299 else f"Add items worth KSh {int(299-subtotal)}"
            },
            {
                "code": "COMBO30",
                "title": "30% OFF",
                "subtitle": "On all combo meals",
                "minOrderValue": 199,
                "discountPercent": 30,
                "type": "percent",
                "color": "from-green-500 to-emerald-500",
                "status": "Available" if subtotal >= 199 else "Locked"
            },
            {
                "code": "WELCOME100",
                "title": "KSh 100 OFF",
                "subtitle": "First order bonus",
                "minOrderValue": 399,
                "discountAmount": 100,
                "type": "flat",
                "color": "from-purple-500 to-pink-500",
                "status": "Available" if order_count == 0 else "New Users Only"
            },
             {
                "code": "FEAST20",
                "title": "Flat 20% OFF",
                "subtitle": "On orders above KSh 1000",
                "minOrderValue": 1000,
                "discountPercent": 20,
                "type": "percent",
                "color": "from-blue-500 to-indigo-500",
                "status": "Available" if subtotal >= 1000 else "Locked"
            }
        ]
        
        # 2. Add Dynamic Tier Coupons if met
        for t in self.discount_tiers:
            # For simplicity, we stick to the nice campaign ones above as defaults.
            # But let's add the dynamic ones if they are NOT in the static list
            if not any(c['code'] == t['name'] for c in campaign_coupons):
                status = "Unlocked ✅" if subtotal >= t['threshold'] else f"Add KSh {int(t['threshold']-subtotal)} more 🔒"
                coupons.append({
                    "code": t['name'], 
                    "title": f"{t['discount']}% OFF",
                    "subtitle": f"Above KSh {t['threshold']}",
                    "discountPercent": t['discount'],
                    "minOrderValue": t['threshold'],
                    "type": "tiered",
                    "color": "from-gray-700 to-gray-900",
                    "status": status
                })

        return campaign_coupons + coupons
