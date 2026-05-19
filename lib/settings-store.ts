"use client";

import { DEFAULT_BUSINESS_PROFILE, type BusinessProfile } from "@/lib/business-profile";

// ─── Shared types ────────────────────────────────────────────────────────────

export type PricingType = "per-kg" | "per-load" | "per-piece";

export interface ServiceType {
  id: string;
  name: string;
  description: string;
  price: string;        // price per unit (kg, load, or piece)
  pricingType: PricingType;
  active: boolean;      // show in New Transaction modal
  showPrice: boolean;   // show price label on the Wash Type button
}

export interface AddOn {
  id: string;
  name: string;
  rate: string;         // flat ₱ added per transaction
}

export type PricingMode = "per-kg" | "per-load" | "both";

export interface LoadTier {
  id: string;
  name: string;
  range: string;
  price: string;
}

export type PriceDisplayMode = "show" | "free" | "hide";

export interface PricingConfig {
  pricePerKg: string;
  minWeight: string;
  pricingMode: PricingMode;
  loadTiers: LoadTier[];
  priceDisplayMode: PriceDisplayMode;
}

// ─── Business Profile ────────────────────────────────────────────────────────

export type { BusinessProfile } from "@/lib/business-profile";
export { DEFAULT_BUSINESS_PROFILE } from "@/lib/business-profile";

// ─── Loyalty Settings ─────────────────────────────────────────────────────────

export interface LoyaltySettings {
  enabled: boolean;
  washesPerReward: string;
  rewardDescription: string;
}

export const DEFAULT_LOYALTY_SETTINGS: LoyaltySettings = {
  enabled:           true,
  washesPerReward:   "10",
  rewardDescription: "Free wash",
};

// ─── localStorage keys ───────────────────────────────────────────────────────

export const LS_SERVICE_TYPES     = "laundrytrack_service_types";
export const LS_ADDONS            = "laundrytrack_addons";
export const LS_PRICING_CONFIG    = "laundrytrack_pricing_config";
export const LS_BUSINESS_PROFILE  = "laundrytrack_business_profile";
export const LS_LOYALTY_SETTINGS  = "laundrytrack_loyalty_settings";

// ─── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_SERVICE_TYPES: ServiceType[] = [
  { id: "1", name: "Regular",           description: "Standard wash & dry",               price: "30",  pricingType: "per-kg",   active: true,  showPrice: true },
  { id: "2", name: "Delicate",          description: "Gentle cycle for delicate fabrics",  price: "40",  pricingType: "per-kg",   active: true,  showPrice: true },
  { id: "3", name: "Express",           description: "Same-day turnaround",                price: "50",  pricingType: "per-kg",   active: true,  showPrice: true },
  { id: "4", name: "Bulk / Commercial", description: "For 10kg and above",                 price: "250", pricingType: "per-load", active: false, showPrice: true },
];

export const DEFAULT_ADDONS: AddOn[] = [
  { id: "1", name: "Fabcon",         rate: "10" },
  { id: "2", name: "Express (+50%)", rate: "50" },
  { id: "3", name: "Bleach",         rate: "15" },
  { id: "4", name: "Starch",         rate: "20" },
];

export const DEFAULT_LOAD_TIERS: LoadTier[] = [
  { id: "1", name: "Small Load",        range: "below 4 kg",   price: "80"  },
  { id: "2", name: "Medium Load",       range: "4 kg – 7 kg",  price: "120" },
  { id: "3", name: "Large Load",        range: "7 kg – 10 kg", price: "180" },
  { id: "4", name: "Bulk / Commercial", range: "10 kg+",       price: "250" },
];

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  pricePerKg:       "30",
  minWeight:        "",
  pricingMode:      "per-kg",
  loadTiers:        DEFAULT_LOAD_TIERS,
  priceDisplayMode: "show",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch { /* ignore */ }
  return fallback;
}

function persist<T>(key: string, value: T): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

// ─── Public read helpers (non-hook, for use inside wizard on mount) ──────────

export function loadServiceTypes(): ServiceType[] {
  return load(LS_SERVICE_TYPES, DEFAULT_SERVICE_TYPES);
}

export function persistServiceTypes(list: ServiceType[]): void {
  persist(LS_SERVICE_TYPES, list);
}

export function loadAddOns(): AddOn[] {
  return load(LS_ADDONS, DEFAULT_ADDONS);
}

export function persistAddOns(list: AddOn[]): void {
  persist(LS_ADDONS, list);
}

export function loadPricingConfig(): PricingConfig {
  return load(LS_PRICING_CONFIG, DEFAULT_PRICING_CONFIG);
}

export function persistPricingConfig(cfg: PricingConfig): void {
  persist(LS_PRICING_CONFIG, cfg);
}

export function loadBusinessProfile(): BusinessProfile {
  return {
    ...DEFAULT_BUSINESS_PROFILE,
    ...load(LS_BUSINESS_PROFILE, DEFAULT_BUSINESS_PROFILE),
  };
}

export function persistBusinessProfile(profile: BusinessProfile): void {
  persist(LS_BUSINESS_PROFILE, profile);
}

export function loadLoyaltySettings(): LoyaltySettings {
  return load(LS_LOYALTY_SETTINGS, DEFAULT_LOYALTY_SETTINGS);
}

export function persistLoyaltySettings(settings: LoyaltySettings): void {
  persist(LS_LOYALTY_SETTINGS, settings);
}
