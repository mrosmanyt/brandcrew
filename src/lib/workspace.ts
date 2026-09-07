import { prisma } from "@/lib/db";
import { DEMO_BRAND_KIT, stringifyBrandKit } from "@/lib/brand-kit";
import { PLANS } from "@/lib/constants";

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base || "workspace"}-${suffix}`;
}

export async function createDemoWorkspace(userId: string, name?: string) {
  const workspaceName = name?.trim() || "Northline Studio";
  const workspace = await prisma.workspace.create({
    data: {
      name: workspaceName,
      slug: slugify(workspaceName),
      plan: "demo",
      tokenBudget: PLANS.demo.tokenBudget,
      brandKit: stringifyBrandKit(DEMO_BRAND_KIT),
      members: {
        create: { userId, role: "owner" },
      },
      conversations: {
        create: [
          { agentRole: "strategist" },
          { agentRole: "writer" },
          { agentRole: "distributor" },
          { agentRole: "sales" },
          { agentRole: "ads" },
          { agentRole: "ops" },
        ],
      },
      tasks: {
        create: [
          {
            title: "Review the sample Brand Kit",
            description:
              "Northline Studio is loaded so you can try the agents. Replace voice, audience, and offer when you are ready.",
            status: "approve",
            sortOrder: 0,
          },
          {
            title: "Generate a Strategist brief",
            description: "One ICP + offer + pillars artifact.",
            status: "approve",
            sortOrder: 1,
          },
          {
            title: "Schedule the first approved post",
            description: "After Writer + Distributor, move a post to Schedule.",
            status: "schedule",
            sortOrder: 2,
          },
        ],
      },
    },
  });
  return workspace;
}

export async function listUserWorkspaces(userId: string) {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: { workspace: true },
    orderBy: { workspace: { createdAt: "asc" } },
  });
  return memberships.map((m) => m.workspace);
}

export function serializeWorkspace(workspace: {
  id: string;
  name: string;
  slug: string;
  plan: string;
  tokenUsed: number;
  tokenBudget: number;
  brandKit: string;
  createdAt: Date;
}) {
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    plan: workspace.plan,
    tokenUsed: workspace.tokenUsed,
    tokenBudget: workspace.tokenBudget,
    createdAt: workspace.createdAt.toISOString(),
  };
}
