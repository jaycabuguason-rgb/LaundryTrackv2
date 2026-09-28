-- ============================================================
-- LaundryTrack: Complete Database Reset & Admin Setup Script
-- Run this in your Supabase Dashboard SQL Editor if needed
-- ============================================================

-- 1. Truncate all transactional & operational tables (CASCADE)
TRUNCATE TABLE 
  public.notifications,
  public.audit_logs,
  public.reward_history,
  public.stamp_history,
  public.transactions,
  public.loyalty_members
RESTART IDENTITY CASCADE;

-- 2. Clean and re-seed Service Types
DELETE FROM public.service_types;

INSERT INTO public.service_types (name, description, price, pricing_type, is_active, show_price)
VALUES
  ('Regular', 'Standard wash and dry', 30, 'per-kg', true, true),
  ('Delicate', 'Gentle cycle for delicate fabrics', 40, 'per-kg', true, true),
  ('Express', 'Same-day turnaround', 50, 'per-kg', true, true),
  ('Bulk / Commercial', 'For 10kg and above', 250, 'per-load', false, true);

-- 3. Clean and re-seed Add-ons
DELETE FROM public.add_ons;

INSERT INTO public.add_ons (name, rate, is_active)
VALUES
  ('Fabcon', 10, true),
  ('Express (+50%)', 50, true),
  ('Bleach', 15, true),
  ('Starch', 20, true);

-- 4. Clean and re-seed Settings
DELETE FROM public.settings;

INSERT INTO public.settings (key, value)
VALUES
  (
    'pricing',
    jsonb_build_object(
      'pricePerKg', '30',
      'minWeight', '',
      'pricingMode', 'per-kg',
      'loadTiers', jsonb_build_array(
        jsonb_build_object('id', '1', 'name', 'Small Load', 'range', 'below 4 kg', 'price', '80'),
        jsonb_build_object('id', '2', 'name', 'Medium Load', 'range', '4 kg - 7 kg', 'price', '120'),
        jsonb_build_object('id', '3', 'name', 'Large Load', 'range', '7 kg - 10 kg', 'price', '180'),
        jsonb_build_object('id', '4', 'name', 'Bulk / Commercial', 'range', '10 kg+', 'price', '250')
      ),
      'priceDisplayMode', 'show'
    )
  ),
  (
    'loyalty',
    jsonb_build_object(
      'enabled', true,
      'washesPerReward', '10',
      'rewardDescription', 'Free wash'
    )
  ),
  (
    'business_profile',
    jsonb_build_object(
      'shopName', 'Sunshine Laundry Shop',
      'tagline', 'Powered by LaundryTrack',
      'address', '123 Magsaysay Ave, Brgy. Sta. Cruz, Manila',
      'contactNumber', '(02) 8123-4567',
      'email', 'admin@gmail.com',
      'logoDataUrl', '',
      'receiptFooter', 'Thank you for choosing Sunshine Laundry Shop!',
      'pickupInstructions', 'Present this receipt or QR code upon claiming.'
    )
  );

-- 5. Delete staff profiles
DELETE FROM public.profiles WHERE role = 'staff';

-- 6. Purge avatars from storage bucket
DELETE FROM storage.objects WHERE bucket_id = 'avatars';
