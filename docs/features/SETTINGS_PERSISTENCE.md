# Settings Persistence Implementation

## Overview
All settings are now automatically saved to the database and persist across sessions.

## What Gets Saved

### 1. Business Profile Settings
- Shop Name
- Shop Logo (base64 data URL)
- Tagline
- Address
- Contact Number
- Email
- Receipt Footer Message
- Pickup Instructions

**Location:** Settings → Business Profile

### 2. Pricing Settings
- Pricing Mode (Per Kilogram / Per Load / Both)
- Price per kg
- Minimum weight
- Load Tiers (name, range, price)
- Price Display Mode (Show / Free / Hide)

**Location:** Settings → Pricing

### 3. Service Types
- Service name
- Description
- Price
- Pricing type (per-kg / per-load / per-piece)
- Active status
- Show price toggle

**Location:** Settings → Pricing → Service Types

### 4. Add-ons
- Add-on name
- Rate (price)

**Location:** Settings → Pricing → Add-on Rates

### 5. Loyalty Program Settings
- Enabled/Disabled status
- Washes per reward
- Reward description

**Location:** Settings → Loyalty Program

## How It Works

### Saving Process
1. Admin changes settings in the Settings page
2. Clicks "Save Changes" button
3. Settings are saved to:
   - **localStorage** (for immediate local access)
   - **Database** (for persistence and cross-device sync)
4. Success message appears

### Loading Process
1. Page loads with default values from localStorage
2. Fetches latest settings from database
3. Updates UI with database values
4. Saves to localStorage for offline access

### Database Structure
All settings are stored in the `settings` table with key-value pairs:

| Key | Value Type |
|-----|------------|
| `business_profile` | BusinessProfile object |
| `pricing_config` | PricingConfig object |
| `service_types` | ServiceType[] array |
| `addons` | AddOn[] array |
| `loyalty_settings` | LoyaltySettings object |

## API Endpoints

### Business Profile
- **GET** `/api/settings/business-profile` - Load business profile
- **PUT** `/api/settings/business-profile` - Save business profile

### Pricing & Services
- **GET** `/api/settings/pricing` - Load all pricing settings
- **PUT** `/api/settings/pricing` - Save pricing settings

## Customer Tracking Page Integration

The customer tracking page automatically pulls the latest business profile:
- Shop Logo
- Shop Name
- Address
- Contact Number
- Email
- Receipt Footer
- Pickup Instructions

**No manual update needed** - changes appear immediately when customers refresh the page.

## Benefits

✅ **Persistent** - Settings survive browser cache clears
✅ **Cross-device** - Same settings on all devices
✅ **Real-time** - Customer tracking page shows latest info
✅ **Audit trail** - All changes logged in audit logs
✅ **Backup-friendly** - Settings stored in database backups
✅ **Offline-ready** - localStorage fallback when offline

## Testing

To verify settings are saving:
1. Change any setting in Settings page
2. Click "Save Changes"
3. Refresh the page
4. Settings should remain changed
5. Open in different browser/device
6. Settings should be the same

## Troubleshooting

If settings are not saving:
1. Check browser console for errors
2. Verify Supabase connection is working
3. Check that `settings` table exists in database
4. Verify API endpoints are accessible
5. Check audit logs for save attempts
