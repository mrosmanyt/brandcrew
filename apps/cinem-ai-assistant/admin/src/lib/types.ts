/** Cinem AI Assistant ADMIN — shared domain types (mirror supabase/schema.sql). */

export type UserStatus = "active" | "frozen" | "expired" | "blacklisted";
export type LicensePlan = "lifetime" | "monthly" | "yearly";
export type LicenseStatus = "unused" | "active" | "revoked" | "expired";
export type RequestStatus = "pending" | "approved" | "declined";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  country: string;
  status: UserStatus;
  created_at: string;
  last_active: string | null;
  /** denormalized analytics */
  commands_used: number;
  top_agents: string[];
}

export interface License {
  id: string;
  key: string;
  user_email: string | null;
  plan: LicensePlan;
  price: number;
  hardware_id: string | null;
  status: LicenseStatus;
  created_at: string;
  expires_at: string | null;
}

export interface RegistrationRequest {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  country: string;
  status: RequestStatus;
  created_at: string;
}

export interface UsageLog {
  id: number;
  user_email: string;
  agent: string;
  command: string;
  created_at: string;
}

export interface Stats {
  totalUsers: number;
  activeUsers: number;
  revenue: number;
  commandsToday: number;
}
