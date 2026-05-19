import type { BusinessProfile } from "@/lib/business-profile";
import type { PaymentStatus, Transaction, TransactionStatus } from "@/lib/data";

export type CreateTransactionInput = Pick<
  Transaction,
  | "customerName"
  | "phone"
  | "arrivalDateTime"
  | "washType"
  | "weight"
  | "fee"
  | "status"
  | "paymentStatus"
  | "addOns"
  | "washInstructions"
> & {
  dropOffDate?: string;
  eta?: string | null;
};

export interface UpdateTransactionInput {
  status?: TransactionStatus;
  paymentStatus?: PaymentStatus;
  washInstructions?: string;
  eta?: string | null;
  voidReason?: string | null;
}

export type PublicShopProfile = Pick<
  BusinessProfile,
  | "shopName"
  | "tagline"
  | "logoDataUrl"
  | "address"
  | "contactNumber"
  | "email"
  | "receiptFooter"
  | "pickupInstructions"
>;

export interface PublicTrackingRecord {
  ticketId: string;
  status: TransactionStatus;
  eta: string | null;
  updatedAt: string | null;
  paymentStatus: PaymentStatus;
  balanceDue: number;
  weight: number;
  washType: string;
  addOns: string[];
  washInstructions: string | null;
  dropOffTime: string;
  shopProfile: PublicShopProfile;
}
