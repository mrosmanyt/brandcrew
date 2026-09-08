/**
 * Google *user login* vs Marketplace Gmail plugin OAuth.
 * Mocked token exchange. No live Google calls.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  googleAuthErrorMessage,
  googleEmailIsVerified,
  googleLoginStartHref,
  GOOGLE_LOGIN_CALLBACK_PATH,
  GOOGLE_LOGIN_SCOPES,
  safeNextPath,
} from "../src/lib/google-auth-shared";
import {
  exchangeGoogleLoginCode,
  googleLoginAuthorizeUrl,
  googleLoginClient,
  googleLoginMissingEnv,
  googleLoginPublicStatus,
  googleLoginReady,
  googleLoginRedirectUri,
  googleLoginSetupHint,
  upsertGoogleUser,
} from "../src/lib/google-auth";
import { oauthRedirectUri } from "../src/lib/plugins";
import { prisma } from "../src/lib/db";

const saved = {
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_LOGIN_CLIENT_ID: process.env.GOOGLE_LOGIN_CLIENT_ID,
  GOOGLE_LOGIN_CLIENT_SECRET: process.env.GOOGLE_LOGIN_CLIENT_SECRET,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

delete process.env.GOOGLE_CLIENT_ID;
delete process.env.GOOGLE_CLIENT_SECRET;
delete process.env.GOOGLE_LOGIN_CLIENT_ID;
delete process.env.GOOGLE_LOGIN_CLIENT_SECRET;
assert.equal(googleLoginReady(), false);
assert.deepEqual(googleLoginMissingEnv(), ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]);
assert.match(googleLoginSetupHint(), /GOOGLE_CLIENT_ID/);
assert.match(googleLoginSetupHint(), /127\.0\.0\.1:43180\/api\/auth\/google\/callback/);
assert.match(googleLoginSetupHint(), /brandcrew\.vercel\.app\/api\/auth\/google\/callback/);
assert.equal(googleLoginPublicStatus().ready, false);
assert.equal(googleLoginPublicStatus().purpose, "user_login");
console.log("ok: Google sign-in stays honest when client env is missing");

process.env.GOOGLE_CLIENT_ID = "login-client";
process.env.GOOGLE_CLIENT_SECRET = "login-secret";
assert.equal(googleLoginReady(), true);
assert.deepEqual(googleLoginClient(), { id: "login-client", secret: "login-secret" });
assert.equal(googleLoginRedirectUri().endsWith(GOOGLE_LOGIN_CALLBACK_PATH), true);
assert.notEqual(googleLoginRedirectUri(), oauthRedirectUri());
assert.equal(oauthRedirectUri().endsWith("/api/oauth/callback"), true);
console.log("ok: login callback is distinct from Gmail plugin callback");

const authorize = googleLoginAuthorizeUrl("state-token");
assert.match(authorize, /accounts\.google\.com/);
assert.match(authorize, /scope=openid\+email\+profile/);
assert.match(authorize, /redirect_uri=.*api%2Fauth%2Fgoogle%2Fcallback/);
assert.doesNotMatch(authorize, /gmail/);
assert.deepEqual([...GOOGLE_LOGIN_SCOPES], ["openid", "email", "profile"]);
console.log("ok: login scopes are OpenID only (not Gmail plugin scopes)");

assert.equal(safeNextPath("/desk/abc/settings"), "/desk/abc/settings");
assert.equal(safeNextPath("/desk?checkout=pro"), "/desk?checkout=pro");
assert.equal(safeNextPath("https://evil.example/phish"), "/desk");
assert.equal(safeNextPath("//evil.example"), "/desk");
assert.equal(
  googleLoginStartHref({ intent: "signup", invite: "tok" }),
  "/api/auth/google?intent=signup&invite=tok",
);
assert.match(
  googleLoginStartHref({ intent: "signup", next: "/desk?checkout=pro" }),
  /next=%2Fdesk%3Fcheckout%3Dpro/,
);
assert.match(googleAuthErrorMessage("google_not_configured") || "", /GOOGLE_CLIENT_ID/);
assert.equal(googleEmailIsVerified(true), true);
assert.equal(googleEmailIsVerified(false), false);
assert.equal(googleEmailIsVerified(undefined), false);
console.log("ok: next-path hardening + start href");

const root = process.cwd();
const loginScreen = readFileSync(join(root, "src/app/login/login-screen.tsx"), "utf8");
const signupScreen = readFileSync(join(root, "src/app/signup/signup-screen.tsx"), "utf8");
const googleBtn = readFileSync(join(root, "src/components/auth/google-continue.tsx"), "utf8");
const nav = readFileSync(join(root, "src/components/marketing/site-nav.tsx"), "utf8");
const router = readFileSync(join(root, "src/server/api/router.ts"), "utf8");
assert.match(loginScreen, /GoogleContinueButton/);
assert.match(signupScreen, /GoogleContinueButton/);
assert.match(signupScreen, /safeNextPath\(next/);
assert.match(signupScreen, /checkoutPlanFromNextPath/);
assert.match(loginScreen, /authHrefWithNext\("\/signup"/);
assert.match(googleBtn, /Continue with Google/);
assert.match(nav, /Account/);
assert.match(nav, /accountHref/);
assert.match(router, /\["api", "auth", "google"\]/);
assert.match(router, /\["api", "auth", "google", "callback"\]/);
console.log("ok: login, signup, and landing Account use CINEM Google entry");

const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("oauth2.googleapis.com/token")) {
    return new Response(
      JSON.stringify({
        access_token: "ya29.login-access",
        token_type: "Bearer",
        expires_in: 3600,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
  if (url.includes("openidconnect.googleapis.com/v1/userinfo")) {
    return new Response(
      JSON.stringify({
        sub: "google-sub-99",
        email: "ada@example.com",
        email_verified: true,
        name: "Ada Lovelace",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
  return new Response(JSON.stringify({ error: "unexpected fetch " + url }), {
    status: 500,
  });
}) as typeof fetch;

async function run() {
  const profile = await exchangeGoogleLoginCode("code-login");
  assert.equal(profile.googleId, "google-sub-99");
  assert.equal(profile.email, "ada@example.com");
  assert.equal(profile.emailVerified, true);
  console.log("ok: mocked Google OpenID token + userinfo");

  if (!process.env.DATABASE_URL) {
    console.log("skip: Postgres Google-user smoke (start docker compose or set DATABASE_URL)");
    return;
  }
  try {
    const created = await upsertGoogleUser(profile);
    assert.equal(created.created, true);
    assert.equal(created.user.googleId, "google-sub-99");
    const linked = await upsertGoogleUser(profile);
    assert.equal(linked.created, false);
    assert.equal(linked.user.id, created.user.id);
    await prisma.user.delete({ where: { id: created.user.id } }).catch(() => undefined);
    console.log("ok: Google user create + link by googleId");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/P1001|Can't reach database|Environment variable not found: DATABASE_URL/i.test(message)) {
      console.log("skip: Postgres Google-user smoke (start docker compose or set DATABASE_URL)");
    } else {
      throw error;
    }
  }
}

run()
  .then(() => {
    console.log("Google sign-in checks passed.");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    globalThis.fetch = originalFetch;
    restoreEnv();
  });
