"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

/** Handles /desk?companion=1 and /desk?action=research deep links from mobile companion. */
export function DeskCompanionDeepLink({ workspaceId }: { workspaceId: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    const companion = params.get("companion");
    const action = params.get("action");
    if (!companion && !action) return;
    handled.current = true;

    if (companion === "1") {
      toast.message("Mobile companion", {
        description: "Pair your phone in Settings → Remote, or open /companion/pair on your phone.",
      });
    }

    if (action === "research") {
      void (async () => {
        const agentsRes = await fetch(`/api/workspaces/${workspaceId}/agents`);
        const agentsData = await agentsRes.json();
        const agentId = agentsData.agents?.[0]?.id;
        if (!agentId) {
          toast.error("Add an agent before running research.");
          return;
        }
        const res = await fetch(`/api/workspaces/${workspaceId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId,
            message: "Multi-tab research from mobile companion deep link.",
            playbookKey: "multi_tab_research",
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Could not start research.");
          return;
        }
        toast.success("Research job started on your desk.");
        if (data.job?.id) {
          router.push(`/desk/${workspaceId}?job=${data.job.id}`);
        }
      })();
    }

    const next = new URLSearchParams(params.toString());
    next.delete("companion");
    next.delete("action");
    const qs = next.toString();
    router.replace(qs ? `/desk/${workspaceId}?${qs}` : `/desk/${workspaceId}`);
  }, [action, companion, params, router, workspaceId]);

  return null;
}
