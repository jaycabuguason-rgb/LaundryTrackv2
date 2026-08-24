export interface StaffAccountSummary {
  id: string;
  fullName: string;
  email: string;
  username: string;
  phoneNumber: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
