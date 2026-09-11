# Whop Support product (tips / patronage)

CINEM Pro already uses Whop `checkoutConfigurations.create` for Pro / Pro Plus / Ultra. Brand Support reuses that same client: a **one-time** inline plan with `initial_price` set to the amount the buyer typed ($1–$99,999). Whop does not expose a pay-what-you-want field on checkout configuration, so each Support checkout creates a hidden one-time plan at that price.

This does **not** change `Workspace.plan`. Cancel/deactivate on a Support membership is ignored for subscriptions.

## Dashboard steps

1. Open [whop.com/dashboard](https://whop.com/dashboard) (or [sandbox.whop.com](https://sandbox.whop.com)).
2. **Products → Create product**. Name it **Support** (or “Support CINEM”). Visibility can be hidden/unlisted — buyers use app checkout, not the Whop storefront.
3. Pricing: one-time. If the UI asks for a fixed price, use **$1** as a placeholder. CINEM Pro **does not** charge that placeholder; the API sends `plan.initial_price` equal to the custom amount and `plan_type: "one_time"`.
4. Copy the product id (`prod_…`) into Vercel env `WHOP_SUPPORT_PRODUCT_ID`.
5. Optional: copy a plan id (`plan_…`) into `WHOP_SUPPORT_PLAN_ID` so `payment.succeeded` payloads that only include that plan id still mark Supporter. Do **not** point this at Pro / Pro Plus / Ultra plan ids.
6. Same company API key and webhook as subscriptions:
   - `WHOP_API_KEY`
   - `WHOP_COMPANY_ID` (`biz_…`, CINEM Tech production: `biz_VrtL8S4duREQg4`). Alias: `WHOP_ACCOUNT_ID`. Live checkout refuses to call Whop if this is empty.
   - Webhook URL `{NEXT_PUBLIC_APP_URL}/api/webhooks/whop`
   - Events: `payment.succeeded`, `membership.activated`, `membership.deactivated`
   - `WHOP_WEBHOOK_SECRET`
7. Grant `checkout_configuration:create` and `plan:create` on the API key (same as paid plans).
8. Production: `BILLING_MOCK=false`. Support checkout is live only when `WHOP_API_KEY` is set. Mock billing marks Supporter locally and never pretends a Whop payment succeeded.

## What CINEM Pro sends

Whop’s payment + inline-plan OpenAPI requires `plan.company_id` (`biz_…`). `@whop/sdk` 1.1.2 still types `account_id` as an alias. CINEM Pro sends **both** so checkout does not 404 with `Account not found`.

```
POST checkoutConfigurations.create
  company_id = WHOP_COMPANY_ID (biz_…)
  account_id = same value (SDK / older API alias)
  mode: payment
  metadata.kind = support
  metadata.amountUsd = "<chosen amount>"
  metadata.workspaceId / userId when signed in
  plan.company_id = same biz_… (required for inline one-time plans)
  plan.account_id = same value (alias)
  plan.plan_type = one_time
  plan.initial_price = <amount USD>
  plan.product_id = WHOP_SUPPORT_PRODUCT_ID (if set)
  plan.visibility = hidden
  plan.force_create_new_plan = true
```

After `payment.succeeded` (or `membership.activated`) with `metadata.kind=support`, the webhook sets `User.supporter` / `Workspace.supporter` and writes a `BrandSupport` row. The thank-you page does **not** flip the badge by itself.
