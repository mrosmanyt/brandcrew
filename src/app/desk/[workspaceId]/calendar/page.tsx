import { CalendarView } from "@/components/desk/calendar-view";

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        Distributor
      </p>
      <h1 className="font-heading mt-1 text-3xl tracking-tight">Content calendar</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        A 30-day plan you can export as Markdown and paste into Docs. Brandcrew
        does not auto-post to LinkedIn.
      </p>
      <div className="mt-6">
        <CalendarView workspaceId={workspaceId} />
      </div>
    </div>
  );
}
