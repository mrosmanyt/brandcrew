/**
 * Optional approval gate before publish/post clicks in social playbooks.
 * When admin approval is required, the run pauses until the user confirms.
 */

export interface PendingSocialPublish {
  platform: string;
  file?: string;
  caption: string;
  requestedAt: number;
}

let pending: PendingSocialPublish | null = null;
let requireApproval = true;

export function setPublishApprovalRequired(on: boolean): void {
  requireApproval = on;
}

export function publishApprovalRequired(): boolean {
  return requireApproval;
}

export function getPendingPublish(): PendingSocialPublish | null {
  return pending;
}

export function preparePublish(input: PendingSocialPublish): void {
  pending = input;
}

export function clearPendingPublish(): void {
  pending = null;
}

export function isPublishConfirmation(text: string): boolean {
  return /^(haan|han|yes|yep|ok|okay|confirm|kar ?do|theek|sahi|go|publish|post|👍)\b/i.test(text.trim());
}

export function consumePendingPublish(): PendingSocialPublish | null {
  const p = pending;
  pending = null;
  return p;
}
