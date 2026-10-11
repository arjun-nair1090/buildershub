JEWELLERY_TYPES = ("Ring", "Necklace", "Bracelet", "Chain", "Earrings", "Bangle", "Pendant", "Other")

# Karat -> fineness (% pure gold), per BIS hallmark grades.
PURITY_PERCENT = {
    "24K": "99.9",
    "22K": "91.6",
    "18K": "75.0",
    "14K": "58.5",
}

GOLD_COLOURS = ("Yellow gold", "Rose gold", "White gold", "Two-tone", "Multi-tone")

# GST on gold jewellery in India, charged on gold value + making charges + other components.
DEFAULT_GST_PERCENT = "3.00"

RECORD_STATUSES = ("active", "inactive")

# How far the store vouches for a piece. The badge buyers see always matches this.
VERIFICATION_LEVELS = ("declared", "hallmark", "lab")
STOCK_STATUSES = ("in_stock", "reserved", "sold")
DISCOUNT_TYPES = ("percent", "flat")
MAX_PHOTOS = 6
