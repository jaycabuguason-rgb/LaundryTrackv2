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
  paidAt?: string | null;
}

export type StampAwardResult =
  | { stamped: false; reason: string }
  | {
      stamped: true;
      rewarded: boolean;
      memberName: string;
      newStampCount: number;
      cycleStampCount: number;
      washesPerReward: number;
      rewardsAvailable: number;
      rewardDescription: string;
    };

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
  customerName: string;
  customerPhone?: string;
  status: TransactionStatus;
  eta: string | null;
  updatedAt: string | null;
  paymentStatus: PaymentStatus;
  paidAt?: string | null;
  balanceDue: number;
  weight: number;
  washType: string;
  addOns: string[];
  washInstructions: string | null;
  dropOffTime: string;
  shopProfile: PublicShopProfile;
}

export interface PublicLoyaltyMemberRecord {
  id: string;
  name: string;
  phone: string;
  dateJoined: string;
  stampCount: number;
  currentCycleStamps: number;
  washesPerReward: number;
  stampsUntilReward: number;
  progressPct: number;
  rewardsAvailable: number;
  rewardsRedeemed: number;
  rewardDescription: string;
  totalVisits: number;
  totalKgWashed: number;
  laundryRecords: Array<{
    ticketId: string;
    date: string;
    claimedDate?: string | null;
    washType: string;
    weight: number;
    fee: number;
    status: TransactionStatus;
    rewardUsed?: boolean;
  }>;
  rewardHistory: Array<{
    reward: string;
    date: string;
  }>;
  shopProfile: PublicShopProfile;
}

