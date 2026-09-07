import { Badge } from "@/components/ui/badge";
import type { LlmStatus } from "@/lib/llm";

export function ProviderBadges({ llm }: { llm: LlmStatus }) {
  if (!llm.configured) {
    return <Badge variant="secondary">Offline demo</Badge>;
  }
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {llm.openai ? <Badge variant="outline">OpenAI</Badge> : null}
      {llm.anthropic ? <Badge variant="outline">Anthropic</Badge> : null}
      {llm.gemini ? <Badge variant="outline">Gemini</Badge> : null}
    </span>
  );
}

export function providerLabel(provider?: string) {
  if (provider === "openai") return "OpenAI";
  if (provider === "anthropic") return "Anthropic";
  if (provider === "gemini") return "Gemini";
  return "Demo";
}
