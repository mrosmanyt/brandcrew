export type OnboardingStepId = "agent" | "job" | "approve";

export type OnboardingState = {
  dismissed: boolean;
  completed: boolean;
  steps: { id: OnboardingStepId; label: string; done: boolean }[];
  doneCount: number;
  total: number;
};

export function workspaceOnboarding(input: {
  dismissed: boolean;
  agentCount: number;
  jobCount: number;
  approvedCount: number;
}): OnboardingState {
  const steps: OnboardingState["steps"] = [
    {
      id: "agent",
      label: "Create or select New Agent",
      done: input.agentCount > 0,
    },
    {
      id: "job",
      label: "Run a first job",
      done: input.jobCount > 0,
    },
    {
      id: "approve",
      label: "Approve what leaves",
      done: input.approvedCount > 0,
    },
  ];
  const doneCount = steps.filter((step) => step.done).length;
  const completed = doneCount === steps.length;
  return {
    dismissed: input.dismissed,
    completed,
    steps,
    doneCount,
    total: steps.length,
  };
}

export function shouldShowOnboarding(state: OnboardingState) {
  return !state.dismissed && !state.completed;
}
