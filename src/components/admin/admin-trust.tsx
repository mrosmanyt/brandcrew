"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { AdminTrustPayload } from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AdminConfirm,
  AdminPageFrame,
  UserActionList,
  WorkspaceTable,
  fetchAdminJson,
  useAdminMutation,
} from "@/components/admin/admin-shared";

export function AdminTrust({
  initial,
  initialQuery,
}: {
  initial: AdminTrustPayload;
  initialQuery: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [data, setData] = useState(initial);
  const [searched, setSearched] = useState(Boolean(initialQuery));

  async function load(nextQuery: string) {
    const params = new URLSearchParams({ section: "trust" });
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    setData(await fetchAdminJson<AdminTrustPayload>(`/api/admin?${params}`));
  }

  const { busy, setBusy, pending, setPending, runPending } = useAdminMutation(() => load(query));

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await load(query);
      setSearched(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Search failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPageFrame
      kicker="Internal Admin HQ"
      title="Trust & safety"
      hint="Ban-lite only: search a user or workspace, then force Demo / suspend. There is no separate abuse pipeline yet."
    >
      <form onSubmit={onSearch} className="flex w-full max-w-lg items-end gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="trust-search">User email or workspace id</Label>
          <Input
            id="trust-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="email or workspace id"
          />
        </div>
        <Button type="submit" variant="secondary" disabled={busy}>
          Search
        </Button>
      </form>

      {!searched ? (
        <p className="mt-6 text-sm text-muted-foreground">Search before any rows load.</p>
      ) : (
        <>
          <section className="mt-6 rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-medium">Users</h2>
            <UserActionList rows={data.users} onPending={setPending} />
          </section>
          <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-medium">Workspaces</h2>
            </div>
            <WorkspaceTable
              rows={data.workspaces}
              disabled={busy}
              empty="No workspaces match."
              onPending={setPending}
            />
          </section>
        </>
      )}

      <AdminConfirm
        pending={pending}
        busy={busy}
        onClose={() => setPending(null)}
        onConfirm={() => void runPending()}
      />
    </AdminPageFrame>
  );
}
