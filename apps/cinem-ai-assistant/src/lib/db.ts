/**
 * Cinem AI Assistant user-management backend FACADE.
 *
 * The whole app imports from HERE (never from localDb/cloudDb directly):
 *   - Cloud (Supabase)  → active when VITE_SUPABASE_URL + ANON KEY are set
 *   - Local (JSON/db-server) → automatic fallback / 100% offline mode
 *
 * Both implementations expose the identical function surface, so switching
 * backends is purely a .env change — no code changes anywhere else.
 */
import * as local from "@/lib/localDb";
import * as cloud from "@/lib/cloudDb";

export type {
  UserRecord, RegistrationInput, ActivityEntry, ActivityType, RequestStatus,
  UsageKind, UsageSummary,
} from "@/lib/localDb";

/** Which backend is live (shown in logs; useful for debugging). */
export const BACKEND: "cloud" | "local" = cloud.CLOUD_CONFIGURED ? "cloud" : "local";
console.info(`[Cinem AI Assistant] user-management backend: ${BACKEND.toUpperCase()}`);

const impl = cloud.CLOUD_CONFIGURED ? cloud : local;

/* User-facing */
export const submitRequest = impl.submitRequest;
export const getDeviceUser = impl.getDeviceUser;
export const resetDeviceLink = impl.resetDeviceLink;
export const recordLogin = impl.recordLogin;
export const logActivity = impl.logActivity;

/* Single active session (one login at a time) */
export const claimSession = impl.claimSession;
export const localSession = impl.localSession;

/* Admin */
export const verifyAdmin = impl.verifyAdmin;
export const listUsers = impl.listUsers;
export const approveUser = impl.approveUser;
export const rejectUser = impl.rejectUser;
export const deleteUser = impl.deleteUser;
export const bulkDelete = impl.bulkDelete;
export const setFrozen = impl.setFrozen;
export const bulkSetFrozen = impl.bulkSetFrozen;
export const resetPassword = impl.resetPassword;
export const setPaidAmount = impl.setPaidAmount;
export const updateAdminCredentials = impl.updateAdminCredentials;
export const listActivity = impl.listActivity;
export const clearActivity = impl.clearActivity;

/* Usage analytics */
export const logUsage = impl.logUsage;
export const getUsageSummary = impl.getUsageSummary;
export const setUserLimits = impl.setUserLimits;
