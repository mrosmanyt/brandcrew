import { prisma } from "@/lib/db";
import { DEMO_BRAND_KIT, stringifyBrandKit } from "@/lib/brand-kit";
import { PLANS } from "@/lib/constants";
import { normalizeModelRouting } from "@/lib/llm-routing";

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
      tasks: {
        create: [
          {
            title: "Create an agent or launch a full business team",
            description:
              "Agents start as “New Agent”. Rename them. Launching a team requires an explicit approve.",
            status: "approve",
            sortOrder: 0,
          },
          {
            title: "Review the Brand Kit",
            description:
              "Northline Studio is loaded as sample company facts — not as fake job results.",
            status: "approve",
            sortOrder: 1,
          },
          {
            title: "Give an agent a real job",
            description: "Plan → tools → artifact. Approve before anything leaves.",
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
  modelRouting?: string | null;
}) {
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    plan: workspace.plan,
    tokenUsed: workspace.tokenUsed,
    tokenBudget: workspace.tokenBudget,
    modelRouting: normalizeModelRouting(workspace.modelRouting),
    createdAt: workspace.createdAt.toISOString(),
  };
}
