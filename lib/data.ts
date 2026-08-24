export type TransactionStatus = "Received" | "Washing" | "Drying" | "Ready" | "Claimed" | "Voided";
export type PaymentStatus = "unpaid" | "paid";

export interface Transaction {
  id: string;
  ticketId: string;
  customerName: string;
  phone: string;
  arrivalDateTime: string; // Customer drop-off date & time
  dropOffDate: string;
  washType: string;
  weight: number;
  fee: number;
  status: TransactionStatus;
  paymentStatus: PaymentStatus;
  addOns: string[];
  washInstructions?: string;
  publicTrackingToken?: string;
  updatedAt?: string;
  eta?: string | null;
}

export interface LoyaltyMember {
  id: string;
  name: string;
  email?: string;
  phone: string;
  stampCount: number;
  rewardsAvailable: number;
  rewardsRedeemed: number;
  dateJoined: string;
  stampHistory: { date: string; stamps: number; ticket: string; source?: "auto_claim" | "manual"; notes?: string }[];
  rewardHistory: { date: string; reward: string }[];
  preferences: string;
  notes?: string;
}

export interface AuditLog {
  id: string;
  dateTime: string;
  ticketId: string;
  action: "Scanned" | "Claimed" | "Denied" | "Override";
  staff: string;
  notes: string;
  paymentStatus?: PaymentStatus;
  customerName?: string;
}

export interface Notification {
  id: string;
  type: "ready" | "unclaimed";
  ticketId: string;
  customerName: string;
  time: string;
  createdAt: string; // ISO timestamp for age checks
}

export const transactions: Transaction[] = [
  { id: "1",  ticketId: "TKT-0001", customerName: "Maria Santos",    phone: "09171234567", arrivalDateTime: "2026-04-05 08:14", dropOffDate: "2026-04-05", washType: "Regular",  weight: 5.2, fee: 156, status: "Ready",    paymentStatus: "paid",   addOns: ["Fabcon"],              washInstructions: "Cold water only" },
  { id: "2",  ticketId: "TKT-0002", customerName: "Jose Reyes",      phone: "09281234567", arrivalDateTime: "2026-04-05 09:02", dropOffDate: "2026-04-05", washType: "Express",  weight: 3.8, fee: 228, status: "Washing",  paymentStatus: "unpaid", addOns: ["Fabcon", "Bleach"] },
  { id: "3",  ticketId: "TKT-0003", customerName: "Ana Cruz",        phone: "09351234567", arrivalDateTime: "2026-04-05 09:45", dropOffDate: "2026-04-05", washType: "Delicate", weight: 2.1, fee: 105, status: "Drying", paymentStatus: "unpaid", addOns: [] },
  { id: "4",  ticketId: "TKT-0004", customerName: "Pedro Bautista",  phone: "09461234567", arrivalDateTime: "2026-04-04 10:30", dropOffDate: "2026-04-04", washType: "Regular",  weight: 7.5, fee: 225, status: "Claimed",  paymentStatus: "paid",   addOns: ["Fabcon"] },
  { id: "5",  ticketId: "TKT-0005", customerName: "Rosa Dela Cruz",  phone: "09571234567", arrivalDateTime: "2026-04-04 11:55", dropOffDate: "2026-04-04", washType: "Express",  weight: 4.0, fee: 240, status: "Ready",    paymentStatus: "unpaid", addOns: ["Bleach"] },
  { id: "6",  ticketId: "TKT-0006", customerName: "Carlos Garcia",   phone: "09681234567", arrivalDateTime: "2026-04-04 14:10", dropOffDate: "2026-04-04", washType: "Regular",  weight: 6.3, fee: 189, status: "Received", paymentStatus: "unpaid", addOns: [] },
  { id: "7",  ticketId: "TKT-0007", customerName: "Lita Mendoza",    phone: "09791234567", arrivalDateTime: "2026-04-03 07:50", dropOffDate: "2026-04-03", washType: "Delicate", weight: 1.8, fee: 90,  status: "Claimed",  paymentStatus: "paid",   addOns: ["Fabcon"] },
  { id: "8",  ticketId: "TKT-0008", customerName: "Ramon Torres",    phone: "09821234567", arrivalDateTime: "2026-04-03 08:35", dropOffDate: "2026-04-03", washType: "Regular",  weight: 8.1, fee: 243, status: "Ready",    paymentStatus: "unpaid", addOns: [] },
  { id: "9",  ticketId: "TKT-0009", customerName: "Gloria Aquino",   phone: "09931234567", arrivalDateTime: "2026-04-05 10:20", dropOffDate: "2026-04-05", washType: "Express",  weight: 3.5, fee: 210, status: "Washing",  paymentStatus: "unpaid", addOns: ["Fabcon", "Starch"] },
  { id: "10", ticketId: "TKT-0010", customerName: "Eduardo Lim",     phone: "09041234567", arrivalDateTime: "2026-04-05 11:05", dropOffDate: "2026-04-05", washType: "Regular",  weight: 5.9, fee: 177, status: "Received", paymentStatus: "unpaid", addOns: [] },
];

export const loyaltyMembers: LoyaltyMember[] = [
  { id: "1", name: "Maria Santos",   phone: "09171234567", stampCount: 12, rewardsAvailable: 0, rewardsRedeemed: 1, dateJoined: "2025-10-15", stampHistory: [{ date: "2026-04-05", stamps: 1, ticket: "TKT-0001" }, { date: "2026-03-20", stamps: 1, ticket: "TKT-0089" }], rewardHistory: [{ date: "2026-01-10", reward: "Free Wash" }],   preferences: "Cold water, no bleach" },
  { id: "2", name: "Jose Reyes",     phone: "09281234567", stampCount: 7,  rewardsAvailable: 0, rewardsRedeemed: 0, dateJoined: "2025-11-02", stampHistory: [{ date: "2026-04-05", stamps: 1, ticket: "TKT-0002" }],                                                          rewardHistory: [],                                              preferences: "Regular wash" },
  { id: "3", name: "Rosa Dela Cruz", phone: "09571234567", stampCount: 21, rewardsAvailable: 0, rewardsRedeemed: 3, dateJoined: "2025-08-20", stampHistory: [{ date: "2026-04-04", stamps: 1, ticket: "TKT-0005" }],                                                          rewardHistory: [{ date: "2026-03-01", reward: "Free Wash" }, { date: "2026-01-15", reward: "Free Fabcon" }], preferences: "Express only" },
  { id: "4", name: "Carlos Garcia",  phone: "09681234567", stampCount: 4,  rewardsAvailable: 0, rewardsRedeemed: 0, dateJoined: "2026-01-10", stampHistory: [{ date: "2026-04-04", stamps: 1, ticket: "TKT-0006" }],                                                          rewardHistory: [],                                              preferences: "" },
  { id: "5", name: "Eduardo Lim",    phone: "09041234567", stampCount: 9,  rewardsAvailable: 0, rewardsRedeemed: 1, dateJoined: "2025-12-05", stampHistory: [],                                                                                                                  rewardHistory: [{ date: "2026-02-14", reward: "Free Wash" }],   preferences: "Delicate care" },
];

export const auditLogs: AuditLog[] = [
  { id: "1", dateTime: "2026-04-05 10:32", ticketId: "TKT-0004", action: "Claimed",  staff: "Admin",   notes: "Normal claim" },
  { id: "2", dateTime: "2026-04-05 09:15", ticketId: "TKT-0007", action: "Scanned",  staff: "Staff01", notes: "" },
  { id: "3", dateTime: "2026-04-04 16:45", ticketId: "TKT-0003", action: "Denied",   staff: "Staff01", notes: "Wrong person" },
  { id: "4", dateTime: "2026-04-04 14:20", ticketId: "TKT-0002", action: "Override", staff: "Admin",   notes: "Customer lost ticket, ID verified" },
  { id: "5", dateTime: "2026-04-04 11:05", ticketId: "TKT-0001", action: "Scanned",  staff: "Staff02", notes: "" },
];

export const initialNotifications: Notification[] = [
  { id: "n1", type: "ready",     ticketId: "TKT-0001", customerName: "Maria Santos",   time: "2 min ago",  createdAt: "2026-04-05T08:12:00" },
  { id: "n2", type: "ready",     ticketId: "TKT-0005", customerName: "Rosa Dela Cruz", time: "14 min ago", createdAt: "2026-04-05T08:00:00" },
  { id: "n3", type: "unclaimed", ticketId: "TKT-0008", customerName: "Ramon Torres",   time: "2 days ago", createdAt: "2026-04-03T08:35:00" },
];

// ── Peak Analysis Data ──────────────────────────────────────────────────────

export const peakByHour = [
  { label: "12AM", count: 1 },  { label: "1AM",  count: 0 },
  { label: "2AM",  count: 0 },  { label: "3AM",  count: 0 },
  { label: "4AM",  count: 0 },  { label: "5AM",  count: 1 },
  { label: "6AM",  count: 2 },  { label: "7AM",  count: 3 },
  { label: "8AM",  count: 8 },  { label: "9AM",  count: 12 },
  { label: "10AM", count: 18 }, { label: "11AM", count: 15 },
  { label: "12PM", count: 10 }, { label: "1PM",  count: 7 },
  { label: "2PM",  count: 9 },  { label: "3PM",  count: 14 },
  { label: "4PM",  count: 16 }, { label: "5PM",  count: 11 },
  { label: "6PM",  count: 6 },  { label: "7PM",  count: 4 },
  { label: "8PM",  count: 3 },  { label: "9PM",  count: 2 },
  { label: "10PM", count: 1 },  { label: "11PM", count: 0 },
];

export const peakByDayOfWeek = [
  { label: "Mon", count: 28 },
  { label: "Tue", count: 35 },
  { label: "Wed", count: 30 },
  { label: "Thu", count: 42 },
  { label: "Fri", count: 50 },
  { label: "Sat", count: 68 },
  { label: "Sun", count: 45 },
];

export const peakByWeekOfMonth = [
  { label: "Week 1", count: 120 },
  { label: "Week 2", count: 145 },
  { label: "Week 3", count: 132 },
  { label: "Week 4", count: 158 },
];

export const peakByMonth = [
  { label: "Jan", count: 320 },
  { label: "Feb", count: 295 },
  { label: "Mar", count: 410 },
  { label: "Apr", count: 385 },
  { label: "May", count: 360 },
  { label: "Jun", count: 430 },
  { label: "Jul", count: 455 },
  { label: "Aug", count: 480 },
  { label: "Sep", count: 390 },
  { label: "Oct", count: 420 },
  { label: "Nov", count: 440 },
  { label: "Dec", count: 510 },
];

export const peakBySeason = [
  { label: "Summer (Mar–May)",    count: 1155 },
  { label: "Rainy (Jun–Sep)",     count: 1755 },
  { label: "Cool (Oct–Nov)",      count: 860 },
  { label: "Holiday (Dec–Feb)",   count: 1125 },
];

export const peakByYear = [
  { label: "2022", count: 3200 },
  { label: "2023", count: 3850 },
  { label: "2024", count: 4410 },
  { label: "2025", count: 5120 },
  { label: "2026", count: 1580 },
];

// Legacy exports used by dashboard / revenue charts
export const peakHoursData = peakByHour.slice(7, 19).map((d) => ({ hour: d.label, count: d.count }));
export const busyDayData   = peakByDayOfWeek.map((d) => ({ day: d.label, count: d.count }));

export const weeklyRevenueData = [
  { day: "Mon", revenue: 1820 },
  { day: "Tue", revenue: 2340 },
  { day: "Wed", revenue: 1950 },
  { day: "Thu", revenue: 2780 },
  { day: "Fri", revenue: 3210 },
  { day: "Sat", revenue: 4150 },
  { day: "Sun", revenue: 2890 },
];

export const serviceRevenueData = [
  { service: "Regular",  revenue: 8450, count: 42 },
  { service: "Express",  revenue: 6720, count: 28 },
  { service: "Delicate", revenue: 3200, count: 16 },
];

// ── Revenue Report: Day / Week / Month chart data ──────────────────────────

export interface RevenuePoint {
  label: string;
  paid: number;
  unpaid: number;
  count: number;
}

// Day view — revenue per hour (6 AM–9 PM) for 2026-04-05
export const dayRevenueData: RevenuePoint[] = [
  { label: "6AM",  paid: 0,   unpaid: 0,   count: 0 },
  { label: "7AM",  paid: 0,   unpaid: 0,   count: 0 },
  { label: "8AM",  paid: 156, unpaid: 0,   count: 1 },   // TKT-0001 (Maria Santos, paid)
  { label: "9AM",  paid: 0,   unpaid: 315, count: 2 },   // TKT-0002 (228, unpaid) + TKT-0003 (105, unpaid) ≈ arrival 9:02 & 9:45
  { label: "10AM", paid: 0,   unpaid: 387, count: 2 },   // TKT-0009 (210, unpaid) + TKT-0010 (177, unpaid)
  { label: "11AM", paid: 0,   unpaid: 0,   count: 0 },
  { label: "12PM", paid: 0,   unpaid: 0,   count: 0 },
  { label: "1PM",  paid: 0,   unpaid: 0,   count: 0 },
  { label: "2PM",  paid: 0,   unpaid: 0,   count: 0 },
  { label: "3PM",  paid: 420, unpaid: 180, count: 3 },
  { label: "4PM",  paid: 300, unpaid: 240, count: 4 },
  { label: "5PM",  paid: 195, unpaid: 105, count: 2 },
  { label: "6PM",  paid: 150, unpaid: 90,  count: 2 },
  { label: "7PM",  paid: 0,   unpaid: 120, count: 1 },
  { label: "8PM",  paid: 0,   unpaid: 0,   count: 0 },
  { label: "9PM",  paid: 0,   unpaid: 0,   count: 0 },
];

// Week view — revenue per day for the week of Mar 30–Apr 5, 2026
export const weekRevenueData: RevenuePoint[] = [
  { label: "Mon", paid: 1380, unpaid: 440, count: 9  },
  { label: "Tue", paid: 1890, unpaid: 450, count: 11 },
  { label: "Wed", paid: 1500, unpaid: 450, count: 10 },
  { label: "Thu", paid: 2100, unpaid: 680, count: 14 },
  { label: "Fri", paid: 2520, unpaid: 690, count: 16 },
  { label: "Sat", paid: 3240, unpaid: 910, count: 22 },
  { label: "Sun", paid: 2170, unpaid: 720, count: 14 },
];

// Month view — revenue per day for April 2026 (30 days)
export const monthRevenueData: RevenuePoint[] = [
  { label: "1",  paid: 950,  unpaid: 250, count: 6  },
  { label: "2",  paid: 1100, unpaid: 300, count: 7  },
  { label: "3",  paid: 870,  unpaid: 420, count: 7  },  // TKT-0007, TKT-0008
  { label: "4",  paid: 465,  unpaid: 429, count: 5  },  // TKT-0004, TKT-0005, TKT-0006
  { label: "5",  paid: 156,  unpaid: 1002,count: 5  },  // TKT-0001..0003, 0009, 0010
  { label: "6",  paid: 1340, unpaid: 560, count: 11 },
  { label: "7",  paid: 1680, unpaid: 420, count: 12 },
  { label: "8",  paid: 2100, unpaid: 680, count: 15 },
  { label: "9",  paid: 1890, unpaid: 510, count: 13 },
  { label: "10", paid: 2240, unpaid: 760, count: 17 },
  { label: "11", paid: 1750, unpaid: 400, count: 12 },
  { label: "12", paid: 2060, unpaid: 640, count: 15 },
  { label: "13", paid: 1920, unpaid: 580, count: 14 },
  { label: "14", paid: 2380, unpaid: 820, count: 18 },
  { label: "15", paid: 2150, unpaid: 650, count: 16 },
  { label: "16", paid: 1830, unpaid: 470, count: 13 },
  { label: "17", paid: 2010, unpaid: 590, count: 15 },
  { label: "18", paid: 1700, unpaid: 430, count: 12 },
  { label: "19", paid: 2290, unpaid: 710, count: 17 },
  { label: "20", paid: 2450, unpaid: 850, count: 18 },
  { label: "21", paid: 1980, unpaid: 620, count: 15 },
  { label: "22", paid: 2100, unpaid: 700, count: 16 },
  { label: "23", paid: 1760, unpaid: 440, count: 13 },
  { label: "24", paid: 2320, unpaid: 780, count: 17 },
  { label: "25", paid: 2580, unpaid: 920, count: 20 },
  { label: "26", paid: 2200, unpaid: 700, count: 16 },
  { label: "27", paid: 1940, unpaid: 560, count: 14 },
  { label: "28", paid: 2070, unpaid: 630, count: 15 },
  { label: "29", paid: 2410, unpaid: 790, count: 18 },
  { label: "30", paid: 2650, unpaid: 950, count: 21 },
];

// Previous month (March 2026) total for month-over-month comparison
export const prevMonthRevenue = 48320;

// Service revenue broken down by period
export const serviceRevenueByDay: typeof serviceRevenueData = [
  { service: "Regular",  revenue: 333,  count: 3 },
  { service: "Express",  revenue: 438,  count: 3 },
  { service: "Delicate", revenue: 105,  count: 1 },
];
export const serviceRevenueByWeek: typeof serviceRevenueData = [
  { service: "Regular",  revenue: 8450, count: 42 },
  { service: "Express",  revenue: 6720, count: 28 },
  { service: "Delicate", revenue: 3200, count: 16 },
];
export const serviceRevenueByMonth: typeof serviceRevenueData = [
  { service: "Regular",  revenue: 32480, count: 168 },
  { service: "Express",  revenue: 26100, count: 109 },
  { service: "Delicate", revenue: 12540, count: 63  },
];

export const statusColors: Record<TransactionStatus, string> = {
  Received:   "bg-blue-100 text-blue-700",
  Washing:    "bg-yellow-100 text-yellow-700",
  Drying:     "bg-orange-100 text-orange-700",
  Ready:      "bg-green-100 text-green-700",
  Claimed:    "bg-gray-100 text-gray-600",
  Voided:     "bg-red-100 text-red-800",
};

export const statusOrder: TransactionStatus[] = ["Received", "Washing", "Drying", "Ready", "Claimed"];
