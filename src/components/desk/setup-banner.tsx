import { getLlmStatus } from "@/lib/llm";
import { billingIsMock } from "@/lib/billing";

export function SetupBanner() {
  const llm = getLlmStatus();
  const mockBilling = billingIsMock();

  if (llm.configured && !mockBilling) return null;

  return (
    <div className="border-b border-border bg-accent/70 px-4 py-2.5 text-sm text-accent-foreground">
      <p>
        {!llm.configured ? (
          <>
            <strong>Offline demo.</strong> No model keys on the server. Jobs that run will use labeled Brand Kit templates, not live model output. Add{" "}
            <code className="rounded bg-card px-1 py-0.5 text-xs">OPENAI_API_KEY</code>
            ,{" "}
            <code className="rounded bg-card px-1 py-0.5 text-xs">ANTHROPIC_API_KEY</code>
            , or{" "}
            <code className="rounded bg-card px-1 py-0.5 text-xs">GEMINI_API_KEY</code>{" "}
            on the server — users never paste keys.
          </>
        ) : (
          <>
            Live models are on (
            {[
              llm.openai ? "OpenAI" : null,
              llm.anthropic ? "Anthropic Claude" : null,
              llm.gemini ? "Google Gemini" : null,
            ]
              .filter(Boolean)
              .join(" + ")}
            ).
          </>
        )}{" "}
        {mockBilling ? (
          <>
            Billing is in mock mode (<code className="rounded bg-card px-1 py-0.5 text-xs">BILLING_MOCK=true</code>
            ): plan changes apply locally without Stripe.
          </>
        ) : null}
      </p>
    </div>
  );
}
