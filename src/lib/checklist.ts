import { parseBrandKit } from "@/lib/brand-kit";

export type ChecklistState = {
  brandKit: boolean;
  strategist: boolean;
  writer: boolean;
  approved: boolean;
  doneCount: number;
  total: number;
};

export function workspaceChecklist(input: {
  brandKit: string;
  artifacts: { agentRole: string; status: string }[];
}): ChecklistState {
  const kit = parseBrandKit(input.brandKit);
  const brandKit = Boolean(kit.voice.trim() && kit.audience.trim() && kit.offer.trim());
  const hasJob = input.artifacts.length > 0;
  const approved = input.artifacts.some((a) => a.status === "approved");
  const flags = [brandKit, hasJob, hasJob, approved];
  return {
    brandKit,
    strategist: hasJob,
    writer: hasJob,
    approved,
    doneCount: flags.filter(Boolean).length,
    total: flags.length,
  };
}
