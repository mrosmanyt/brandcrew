"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Per-role chat desks were removed. Mission Control is the desk. */
export function ChatDesk({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/desk/${workspaceId}`);
  }, [router, workspaceId]);
  return null;
}
