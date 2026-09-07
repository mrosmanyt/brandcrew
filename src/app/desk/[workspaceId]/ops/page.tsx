import { KanbanBoard } from "@/components/desk/kanban-board";

export default async function OpsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        Ops
      </p>
      <h1 className="font-heading mt-1 text-3xl tracking-tight">Task board</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        Three columns only: approve, schedule, done. Approving an artifact
        creates a schedule task here. This is not a full project tool.
      </p>
      <div className="mt-6">
        <KanbanBoard workspaceId={workspaceId} />
      </div>
    </div>
  );
}
