import { BillingPlans } from "@/components/desk/billing-plans";
import { billingIsMock } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ status?: string; plan?: string }>;
}) {
  const { workspaceId } = await params;
  const query = await searchParams;
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });
  if (!workspace) redirect("/desk");

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        Billing
      </p>
      <h1 className="font-heading mt-1 text-3xl tracking-tight">Plans</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Starter is $79/month for 2 seats. Growth is $199/month for 5 seats.
        Token budgets rise with the plan. There is no self-serve model key
        field — keys stay on the server.
      </p>
      {query.status === "success" ? (
        <p className="mt-4 rounded-lg border border-border bg-card px-3 py-2 text-sm">
          Checkout finished. If you used Stripe test mode, confirm the webhook
          or apply the plan from mock billing on this page.
        </p>
      ) : null}
      <div className="mt-6">
        <BillingPlans
          workspaceId={workspace.id}
          currentPlan={workspace.plan}
          mock={billingIsMock()}
        />
      </div>
    </div>
  );
}
