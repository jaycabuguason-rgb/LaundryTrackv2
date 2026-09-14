import type { Transaction } from "@/lib/data";
import { loadAddOns, loadServiceTypes, loadPricingConfig } from "@/lib/settings-store";

export interface ReceiptAddOnItem {
  name: string;
  rate: number;
}

export interface ReceiptCostBreakdown {
  serviceName: string;
  serviceDetail: string;
  serviceAmount: number;
  addOns: ReceiptAddOnItem[];
  addOnsTotal: number;
  subtotal: number;
  total: number;
}

/**
 * Calculates itemized breakdown for a transaction receipt:
 * - Base service fee with weight × rate/kg or per-load detail
 * - Each add-on with its individual rate
 * - Subtotal and final total
 */
export function getReceiptCostBreakdown(transaction: Transaction): ReceiptCostBreakdown {
  const allAddOns = loadAddOns();
  const allServices = loadServiceTypes();
  const pricingCfg = loadPricingConfig();

  // Look up itemized add-on rates
  const addOns: ReceiptAddOnItem[] = (transaction.addOns || []).map((name) => {
    const found = allAddOns.find(
      (a) => a.name.trim().toLowerCase() === name.trim().toLowerCase()
    );
    const rate = found ? parseFloat(found.rate) || 0 : 0;
    return { name, rate };
  });

  const addOnsTotal = addOns.reduce((sum, item) => sum + item.rate, 0);

  // If total fee is greater than add-ons, remainder is the base service fee
  // If transaction.fee is 0 (e.g. free promo / reward), service amount is 0
  let serviceAmount = Math.max(0, transaction.fee - addOnsTotal);

  let serviceDetail = "";
  if (transaction.weight > 0) {
    // If we have a matching service price, verify or derive the rate/kg
    const matchedService = allServices.find(
      (s) => s.name.trim().toLowerCase() === transaction.washType.trim().toLowerCase()
    );
    const configRate = matchedService
      ? parseFloat(matchedService.price) || 0
      : parseFloat(pricingCfg.pricePerKg) || 0;

    const derivedRate = Math.round((serviceAmount / transaction.weight) * 100) / 100;
    const effectiveRate = derivedRate > 0 ? derivedRate : configRate;

    serviceDetail = `${transaction.weight} kg @ ₱${effectiveRate.toFixed(2)}/kg`;
  } else {
    serviceDetail = "Per Load";
  }

  const subtotal = serviceAmount + addOnsTotal;

  return {
    serviceName: transaction.washType || "Laundry Service",
    serviceDetail,
    serviceAmount,
    addOns,
    addOnsTotal,
    subtotal,
    total: transaction.fee,
  };
}
