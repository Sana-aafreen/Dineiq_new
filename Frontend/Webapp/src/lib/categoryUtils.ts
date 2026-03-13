import { Category, MenuItem } from './data';

/**
 * Eagerly load all menu images from src/assets/menu-images.
 * This is the most robust way in Vite to handle dynamic assets while keeping paths relative.
 */
const menuImageAssets = import.meta.glob('../assets/menu-images/**/*.{jpeg,jpg,png,webp,svg}', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

/**
 * Helper to resolve a path relative to 'src/assets/menu-images'
 */
function resolveMenuAsset(relativePath: string): string {
  // The keys in menuImageAssets are relative to this file: '../assets/menu-images/...'
  const key = `../assets/menu-images/${relativePath}`;
  return menuImageAssets[key] || '';
}

// Map of category names to local representative images
const CATEGORY_IMAGES: Record<string, string> = {
  'FROM THE GARDEN': resolveMenuAsset('from-the-garden/Summer-Salad.jpeg'),
  'SOUP': resolveMenuAsset('soup/Bone-Broth-&-Mushroom-Soup.jpeg'),
  'STARTERS FROM THE SEA': resolveMenuAsset('starters-from-the-sea/Torched-Salmon.jpeg'),
  'STARTERS FROM THE LAND': resolveMenuAsset('starters-from-the-land/Dry-Rub-Chicken-Wings.jpeg'),
  'STEAMED BAO BUNS': resolveMenuAsset('steamed-bao-buns/Paneer-Bao.jpeg'),
  'BURGERS & SANDWICHES': resolveMenuAsset('burgers-and-sandwiches/Giant-Burger.jpeg'),
  'PASTA': resolveMenuAsset('pasta/Spaghetti-Carbonara.jpeg'),
  'MAINS FROM THE LAND': resolveMenuAsset('mains-from-the-land/Ash-Roasted-Chicken-Espetada.jpeg'),
  'MAINS FROM THE SEA': resolveMenuAsset('mains-from-the-sea/Catch-of-the-Day.jpeg'),
  'GRILLS': resolveMenuAsset('grills/TOMAHAWK-STEAK.jpeg'),
  'SIDES': resolveMenuAsset('sides/Garlic,-Paprika,-Cumin-&-Coriander-Fries.jpeg'),
  "CHILDREN'S MENU": resolveMenuAsset('childrens-menu/BREADED-CHICKEN-BREAST.jpeg'),
  'DESSERTS': resolveMenuAsset('desserts/Basque-Cheesecake.jpeg'),
  "CHEF SPECIAL": resolveMenuAsset('recommendations/chef-special.jpeg'),
  'BESTSELLER': resolveMenuAsset('recommendations/bestseller.jpeg'),
};

// Comprehensive map of specific menu items to local images
const ITEM_IMAGES: Record<string, string> = {
  // FROM THE GARDEN
  'AGED STEAK & BRIE': resolveMenuAsset('from-the-garden/Aged-Steak-&-Brie-Salad.jpeg'),
  'BURRATA SALAD': resolveMenuAsset('from-the-garden/Burrata-Salad.jpeg'),
  'CALIFORNIA SALAD BOWL': resolveMenuAsset('from-the-garden/California-Salad-Bowl.jpeg'),
  'CHICKEN CAESAR': resolveMenuAsset('from-the-garden/Chicken-Caesar.jpeg'),
  'HARVEST SALAD': resolveMenuAsset('from-the-garden/Harvest-Salad.jpeg'),
  'SEARED TUNA SALAD': resolveMenuAsset('from-the-garden/Seared-Tuna-Salad.jpeg'),
  'SUMMER SALAD': resolveMenuAsset('from-the-garden/Summer-Salad.jpeg'),

  // SOUP
  'BONE BROTH & MUSHROOM SOUP': resolveMenuAsset('soup/Bone-Broth-&-Mushroom-Soup.jpeg'),
  'GREEN SOUP': resolveMenuAsset('soup/Green-Soup.jpeg'),
  'MULLIGATAWNY SOUP': resolveMenuAsset('soup/Mulligatawny-Soup.jpeg'),
  'TUSCAN WHITE BEAN': resolveMenuAsset('soup/Tuscan-White-Bean.jpeg'),

  // STARTERS FROM THE SEA
  'FISH CEVICHE SALAD': resolveMenuAsset('starters-from-the-sea/Fish-Ceviche-Salad.jpeg'),
  'GINGER & SESAME SALMON': resolveMenuAsset('starters-from-the-sea/Ginger-&-Sesame-Salmon.jpeg'),
  'TORCHED SALMON': resolveMenuAsset('starters-from-the-sea/Torched-Salmon.jpeg'),

  // STARTERS FROM THE LAND
  'CRISPY FRIED CAULIFLOWER': resolveMenuAsset('starters-from-the-land/Crispy-Fried-Cauliflower.jpeg'),
  'DRY-RUB CHICKEN WINGS': resolveMenuAsset('starters-from-the-land/Dry-Rub-Chicken-Wings.jpeg'),
  'MUSHROOM CEVICHE': resolveMenuAsset('starters-from-the-land/Mushroom-Ceviche.jpeg'),
  'SPINACH & MUSHROOM WRAP': resolveMenuAsset('starters-from-the-land/Spinach-&-Mushroom-Wrap.jpeg'),

  // STEAMED BAO BUNS
  'PANEER BAO': resolveMenuAsset('steamed-bao-buns/Paneer-Bao.jpeg'),
  'PRESSED PORK BELLY': resolveMenuAsset('steamed-bao-buns/Pressed-Pork-Belly.jpeg'),
  'SLOW-COOKED BEEF BRISKET': resolveMenuAsset('steamed-bao-buns/Slow-Cooked-Beef-Brisket.jpeg'),

  // BURGERS & SANDWICHES
  'CHICKEN & GOAT CHEESE QUESADILLA': resolveMenuAsset('burgers-and-sandwiches/Chicken-&-Goat-Cheese-Quesadilla.jpeg'),
  'CHICKEN KEBAB SANDWICH': resolveMenuAsset('burgers-and-sandwiches/Chicken-Kebab-Sandwich.jpeg'),
  'CUBANO SANDWICH': resolveMenuAsset('burgers-and-sandwiches/Cubano-Sandwich.jpeg'),
  'GIANT BURGER': resolveMenuAsset('burgers-and-sandwiches/Giant-Burger.jpeg'),
  'GRILLED TOFU & VEGGIE SANDWICH': resolveMenuAsset('burgers-and-sandwiches/Grilled-Tofu-&-Veggie-Sandwich.jpeg'),
  'HARVEST BRISKET BURGER': resolveMenuAsset('burgers-and-sandwiches/Harvest-Brisket-Burger.jpeg'),
  'HARVEST CLUB SANDWICH': resolveMenuAsset('burgers-and-sandwiches/Harvest-Club-Sandwich.jpeg'),
  'KOREAN FRIED MUSHROOM TACOS': resolveMenuAsset('burgers-and-sandwiches/Korean-Fried-Mushroom-Tacos.jpeg'),
  'PICANHA STEAK SANDWICH': resolveMenuAsset('burgers-and-sandwiches/Picanha-Steak-Sandwich.jpeg'),
  'PROSCIUTTO OPEN SANDWICH': resolveMenuAsset('burgers-and-sandwiches/Prosciutto-Open-Sandwich.jpeg'),
  'PULLED PORK & CARAMELIZED ONION': resolveMenuAsset('burgers-and-sandwiches/Pulled-Pork-&-Caramelized-Onion.jpeg'),

  // PASTA
  'BACON RIGATONI': resolveMenuAsset('pasta/Bacon-Rigatoni.jpeg'),
  'BEEF CARBONARA': resolveMenuAsset('pasta/Beef-Carbonara.jpeg'),
  'BUTTERNUT & SAGE RAVIOLI': resolveMenuAsset('pasta/Butternut-&-Sage-Ravioli.jpeg'),
  'SPAGHETTI CARBONARA': resolveMenuAsset('pasta/Spaghetti-Carbonara.jpeg'),
  'TRADIZIONALE': resolveMenuAsset('pasta/Tradizionale.jpeg'),

  // MAINS FROM THE LAND
  'ASH-ROASTED CHICKEN ESPETADA': resolveMenuAsset('mains-from-the-land/Ash-Roasted-Chicken-Espetada.jpeg'),
  'CHIMICHURRI CHARRED CAULIFLOWER STEAK': resolveMenuAsset('mains-from-the-land/Chimichurri-Charred-Cauliflower-Steak.jpeg'),
  'GLAZED LAMB STEAKS': resolveMenuAsset('mains-from-the-land/Glazed-Lamb-Steaks.jpeg'),
  'HERB CRUSTED LAMB SHANK': resolveMenuAsset('mains-from-the-land/Herb-Crusted-Lamb-Shank.jpeg'),
  'OSTRICH WELLINGTON': resolveMenuAsset('mains-from-the-land/Ostrich-Wellington.jpeg'),
  'PERSIAN LAMB KEBAB': resolveMenuAsset('mains-from-the-land/Persian-Lamb-Kebab.jpeg'),
  'ROASTED PORK BELLY': resolveMenuAsset('mains-from-the-land/Roasted-Pork-Belly.jpeg'),
  'SMOKED BEEF BRISKET': resolveMenuAsset('mains-from-the-land/Smoked-Beef-Brisket.jpeg'),
  'VEGETABLE KEBAB': resolveMenuAsset('mains-from-the-land/Vegetable-Kebab.jpeg'),
  'WHOLE ROAST BABY CHICKEN': resolveMenuAsset('mains-from-the-land/Whole-Roast-Baby-Chicken.jpeg'),
  'ZUCCHINI INVOLTINI': resolveMenuAsset('mains-from-the-land/Zucchini-Involtini.jpeg'),

  // MAINS FROM THE SEA
  'CATCH OF THE DAY': resolveMenuAsset('mains-from-the-sea/Catch-of-the-Day.jpeg'),
  'FISH + CHIPS': resolveMenuAsset('mains-from-the-sea/Fish-+-Chips.jpeg'),
  'FRITTO MISTO': resolveMenuAsset('mains-from-the-sea/Fritto-Misto.jpeg'),
  'OLIVE OIL ROASTED SALMON': resolveMenuAsset('mains-from-the-sea/Olive-Oil-Roasted-Salmon.jpeg'),

  // GRILLS
  'DRY AGED PORK CHOPS': resolveMenuAsset('grills/DRY-AGED-PORK-CHOPS.jpeg'),
  'FARMER MAX\' CHICKEN': resolveMenuAsset('grills/Farmer-Max\'-Chicken.jpeg'),
  'GRILLED JUMBO PRAWNS': resolveMenuAsset('grills/GRILLED-JUMBO-PRAWNS.jpeg'),
  'GRILLED RIB RACK': resolveMenuAsset('grills/GRILLED-RIB-RACK.jpeg'),
  'MEAT LOVERS PLATTER': resolveMenuAsset('grills/MEAT-LOVERS-PLATTER.jpeg'),
  'MIXED SEAFOOD PLATTER': resolveMenuAsset('grills/MIXED-SEAFOOD-PLATTER.jpeg'),
  // Note: NEW YORK STEAK has 2 variants — handled by nameEncounterCounter in getMenuItemImage
  'RIBEYE': resolveMenuAsset('grills/RIBEYE.jpeg'),
  'SURF & TURF': resolveMenuAsset('grills/SURF-&-TURF.jpeg'),
  'T-BONE STEAK': resolveMenuAsset('grills/T-BONE-STEAK.jpeg'),
  'TOMAHAWK STEAK': resolveMenuAsset('grills/TOMAHAWK-STEAK.jpeg'),

  // SIDES
  'GARLIC, PAPRIKA, CUMIN & CORIANDER FRIES': resolveMenuAsset('sides/Garlic,-Paprika,-Cumin-&-Coriander-Fries.jpeg'),
  'OREGANO, ROSEMARY, GARLIC, CHEESE & ONION FRIES': resolveMenuAsset('sides/Oregano,-Rosemary,-Garlic,-Cheese-&-Onion-Fries.jpeg'),
  'SPICY DEHYDRATED PICKLED FRIES': resolveMenuAsset('sides/Spicy-Dehydrated-Pickled-Fries.jpeg'),

  // CHILDREN'S MENU
  'BREADED CHICKEN BREAST': resolveMenuAsset('childrens-menu/BREADED-CHICKEN-BREAST.jpeg'),
  'GRILLED FISH FILLET': resolveMenuAsset('childrens-menu/GRILLED-FISH-FILLET.jpeg'),
  'PAN FRIED BEEF PATTY': resolveMenuAsset('childrens-menu/PAN-FRIED-BEEF-PATTY.jpeg'),
  'POTATO GNOCCHI': resolveMenuAsset('childrens-menu/POTATO-GNOCCHI.jpeg'),
  'STIR FRIED NOODLES': resolveMenuAsset('childrens-menu/STIR-FRIED-NOODLES.jpeg'),
  'VANILLA ICE CREAM': resolveMenuAsset('childrens-menu/VANILLA-ICE-CREAM.jpeg'),

  // DESSERTS
  'BASQUE CHEESECAKE': resolveMenuAsset('desserts/Basque-Cheesecake.jpeg'),
  'CHOCOLATE OVERLOAD': resolveMenuAsset('desserts/Chocolate-Overload.jpeg'),
  'CYCLIC CHURROS': resolveMenuAsset('desserts/Cyclic-Churros.jpeg'),
  'FRESH FRUIT SALAD': resolveMenuAsset('desserts/Fresh-Fruit-Salad.jpeg'),
  'ICE CREAM OF THE DAY': resolveMenuAsset('desserts/Ice-Cream-of-the-Day.jpeg'),
  'LAVENDER PARFAIT': resolveMenuAsset('desserts/Lavender-Parfait.jpeg'),
  'SORBET OF THE DAY': resolveMenuAsset('desserts/Sorbet-of-the-Day.jpeg'),
  'VANILLA MILLEFEUILLE': resolveMenuAsset('desserts/Vanilla-Millefeuille.jpeg'),
};

// Two variants for 'New York Steak' — alternated per render cycle
const NEW_YORK_STEAK_IMAGES = [
  resolveMenuAsset('grills/NEW-YORK-STEAK-1.jpeg'),
  resolveMenuAsset('grills/NEW-YORK-STEAK-2.jpeg'),
];

// Tracks how many times a specific item name has been resolved this session
const nameEncounterCounter = new Map<string, number>();

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=400&fit=crop';

/**
 * Get the image URL for a category
 */
export function getCategoryImage(categoryName: string): string {
  const normalized = categoryName.trim().toUpperCase();

  // Robust matching for keywords
  if (normalized.includes('GARDEN') || normalized.includes('SALAD')) return CATEGORY_IMAGES['FROM THE GARDEN'];
  if (normalized.includes('SOUP')) return CATEGORY_IMAGES['SOUP'];
  if (normalized.includes('BAO')) return CATEGORY_IMAGES['STEAMED BAO BUNS'];
  if (normalized.includes('BURGER') || normalized.includes('SANDWICH')) return CATEGORY_IMAGES['BURGERS & SANDWICHES'];
  if (normalized.includes('PASTA')) return CATEGORY_IMAGES['PASTA'];
  if (normalized.includes('GRILL')) return CATEGORY_IMAGES['GRILLS'];
  if (normalized.includes('SIDE')) return CATEGORY_IMAGES['SIDES'];
  if (normalized.includes('DESSERT')) return CATEGORY_IMAGES['DESSERTS'];
  if (normalized.includes('CHILD') || normalized.includes('KID')) return CATEGORY_IMAGES["CHILDREN'S MENU"];
  if (normalized.includes('BESTSELLER')) return CATEGORY_IMAGES['BESTSELLER'];
  if (normalized.includes('CHEF') || normalized.includes('SPECIAL') || normalized.includes('RECOMMENDATION')) return CATEGORY_IMAGES['CHEF SPECIAL'];

  // Handle Land/Sea starters vs mains
  if (normalized.includes('LAND')) {
    if (normalized.includes('START') || normalized.includes('APPETIZER') || !normalized.includes('MAIN')) return CATEGORY_IMAGES['STARTERS FROM THE LAND'];
    return CATEGORY_IMAGES['MAINS FROM THE LAND'];
  }
  if (normalized.includes('SEA')) {
    if (normalized.includes('START') || normalized.includes('APPETIZER') || !normalized.includes('MAIN')) return CATEGORY_IMAGES['STARTERS FROM THE SEA'];
    return CATEGORY_IMAGES['MAINS FROM THE SEA'];
  }

  return CATEGORY_IMAGES[normalized] || CATEGORY_IMAGES[categoryName] || FALLBACK_IMAGE;
}

/**
 * Get the image URL for a specific menu item
 */
export function getMenuItemImage(item: any): string {
  const name = String(item.Item_Name || item.name || '').toUpperCase().trim();
  const category = String(item.Item_Category || item.category || '').toUpperCase().trim();

  // Special case: 'New York Steak' — alternate between two images
  if (name.includes('NEW YORK STEAK')) {
    const count = nameEncounterCounter.get('NEW YORK STEAK') || 0;
    nameEncounterCounter.set('NEW YORK STEAK', count + 1);
    return NEW_YORK_STEAK_IMAGES[count % NEW_YORK_STEAK_IMAGES.length];
  }

  // 1. Direct item match from local library
  for (const [key, path] of Object.entries(ITEM_IMAGES)) {
    if (name.includes(key)) return path;
  }

  // 2. Fallback to Image_URL from backend if available and not a placeholder
  const backendImage = item.Image_URL || item.image;
  if (backendImage && !backendImage.includes('unsplash.com') && !backendImage.includes('placeholder')) {
    return backendImage;
  }

  // 3. Fallback to category image
  return getCategoryImage(category);
}

/**
 * Sort categories alphabetically
 */
export function sortCategoriesAlphabetically(categories: Category[]): Category[] {
  return [...categories].sort((a, b) => a.name.localeCompare(b.name));
}

// Map of category names to Taglines
const CATEGORY_TAGLINES: Record<string, string> = {
  'FROM THE GARDEN': 'Fresh & Crisp Salads',
  'SOUP': 'Warm & Comforting',
  'STARTERS FROM THE SEA': 'Ocean Fresh Bites',
  'STARTERS FROM THE LAND': 'Savoury Meat Treats',
  'STEAMED BAO BUNS': 'Soft & Fluffy Delight',
  'BURGERS & SANDWICHES': 'Hearty & Satisfying',
  'PASTA': 'Italian Classics',
  'MAINS FROM THE LAND': 'Hearty Meat Feasts',
  'MAINS FROM THE SEA': 'Seafood Specialties',
  'GRILLS': 'Smoky & Charred',
  'SIDES': 'Perfect Companions',
  "CHILDREN'S MENU": 'Little Bites for Little Ones',
  'DESSERTS': 'Sweet Endings',
};

const FALLBACK_TAGLINE = 'Delicious Selection';

/**
 * Get the tagline for a category
 */
export function getCategoryTagline(categoryName: string): string {
  const normalized = categoryName.toUpperCase().trim();

  if (normalized.includes('GARDEN') || normalized.includes('SALAD')) return CATEGORY_TAGLINES['FROM THE GARDEN'];
  if (normalized.includes('CHILD') || normalized.includes('KID')) return CATEGORY_TAGLINES["CHILDREN'S MENU"];

  return CATEGORY_TAGLINES[normalized] || CATEGORY_TAGLINES[categoryName] || FALLBACK_TAGLINE;
}

/**
 * Extract dynamic categories
 */
export function extractDynamicCategories(
  menuSections: Record<string, any[]> | undefined
): Category[] {
  if (!menuSections || Object.keys(menuSections).length === 0) return [];

  const categoryNames = Object.keys(menuSections);

  return categoryNames.map((name) => ({
    id: name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''),
    name,
    image: getCategoryImage(name),
    tagline: getCategoryTagline(name),
  }));
}
