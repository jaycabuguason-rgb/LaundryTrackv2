export interface StaffAccountSummary {
  id: string;
  fullName: string;
  email: string;
  username: string;
  phoneNumber: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  role?: "Admin" | "Staff" | "Cashier" | string;
  shiftStatus?: "On Shift" | "On Break" | "Off Duty" | string;
}

export interface CreateStaffAccountInput {
  fullName: string;
  email: string;
  username: string;
  phoneNumber?: string;
  password: string;
}

export interface UpdateStaffAccountInput {
  fullName: string;
  email: string;
  username: string;
  phoneNumber?: string;
  isActive: boolean;
}

export interface ResetStaffPasswordInput {
  password: string;
}
