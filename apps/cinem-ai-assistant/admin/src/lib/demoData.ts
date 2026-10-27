/** Sample data for DEMO MODE (no Supabase env configured). */
import type { AppUser, License, RegistrationRequest, UsageLog } from "@/lib/types";

const daysAgo = (d: number) => new Date(Date.now() - d * 864e5).toISOString();

export const DEMO_USERS: AppUser[] = [
  { id: "u1", name: "Ayesha Khan", email: "ayesha@example.com", whatsapp: "+92 300 1234567", country: "Pakistan", status: "active", created_at: daysAgo(42), last_active: daysAgo(0), commands_used: 1284, top_agents: ["Research Agent", "Planner Agent", "Finance Agent"] },
  { id: "u2", name: "Daniel Cruz", email: "daniel@example.com", whatsapp: "+1 415 555 0199", country: "USA", status: "active", created_at: daysAgo(30), last_active: daysAgo(1), commands_used: 932, top_agents: ["Security Agent", "Local Agent"] },
  { id: "u3", name: "Mei Lin", email: "mei@example.com", whatsapp: "+86 138 0013 8000", country: "China", status: "frozen", created_at: daysAgo(25), last_active: daysAgo(7), commands_used: 410, top_agents: ["YT & TikTok Manager", "Editor Agent"] },
  { id: "u4", name: "Omar Farouk", email: "omar@example.com", whatsapp: "+20 100 1234567", country: "Egypt", status: "expired", created_at: daysAgo(120), last_active: daysAgo(35), commands_used: 2210, top_agents: ["CRM Agent", "Leads Closer Agent", "Email Agent"] },
  { id: "u5", name: "Sofia Rossi", email: "sofia@example.com", whatsapp: "+39 320 1234567", country: "Italy", status: "active", created_at: daysAgo(12), last_active: daysAgo(0), commands_used: 158, top_agents: ["Personal Manager", "World Reports Agent"] },
  { id: "u6", name: "Spam Bot", email: "bot@spam.io", whatsapp: "—", country: "Unknown", status: "blacklisted", created_at: daysAgo(3), last_active: daysAgo(2), commands_used: 5, top_agents: [] },
];

export const DEMO_LICENSES: License[] = [
  { id: "l1", key: "CINEM-AI-ASSISTANT-A1B2-C3D4-E5F6-G7H8", user_email: "ayesha@example.com", plan: "lifetime", price: 199, hardware_id: "HWID-77AA", status: "active", created_at: daysAgo(42), expires_at: null },
  { id: "l2", key: "CINEM-AI-ASSISTANT-J9K8-L7M6-N5P4-Q3R2", user_email: "daniel@example.com", plan: "yearly", price: 89, hardware_id: "HWID-22BC", status: "active", created_at: daysAgo(30), expires_at: daysAgo(-335) },
  { id: "l3", key: "CINEM-AI-ASSISTANT-S2T3-U4V5-W6X7-Y8Z9", user_email: "omar@example.com", plan: "monthly", price: 12, hardware_id: "HWID-91DE", status: "expired", created_at: daysAgo(120), expires_at: daysAgo(35) },
  { id: "l4", key: "CINEM-AI-ASSISTANT-2A3B-4C5D-6E7F-8G9H", user_email: null, plan: "lifetime", price: 199, hardware_id: null, status: "unused", created_at: daysAgo(1), expires_at: null },
];

export const DEMO_REQUESTS: RegistrationRequest[] = [
  { id: "r1", name: "Hiroshi Tanaka", email: "hiroshi@example.com", whatsapp: "+81 90 1234 5678", country: "Japan", status: "pending", created_at: daysAgo(0) },
  { id: "r2", name: "Grace Mwangi", email: "grace@example.com", whatsapp: "+254 712 345678", country: "Kenya", status: "pending", created_at: daysAgo(1) },
];

const AGENTS = ["Security Agent", "Research Agent", "Finance Agent", "Planner Agent", "Personal Manager", "CRM Agent", "Email Agent"];
export const DEMO_LOGS: UsageLog[] = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  user_email: DEMO_USERS[i % DEMO_USERS.length].email,
  agent: AGENTS[i % AGENTS.length],
  command: ["scan system", "daily research digest", "profit/loss this month", "plan my week", "diet plan"][i % 5],
  created_at: daysAgo((i % 3) * 0.2),
}));
