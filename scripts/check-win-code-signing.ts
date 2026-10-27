/**
 * Windows code-signing path: env-gated electron-builder overlay, docs, no secrets.
 * No Azure account and no .exe build.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  applyWinSigning,
  describeWinSigning,
  detectWinSigning,
} = require("./win-code-signing.cjs") as {
  applyWinSigning: (
    config: Record<string, unknown>,
    env: NodeJS.ProcessEnv,
  ) => {
    config: { win: { signAndEditExecutable: boolean; azureSignOptions?: Record<string, string> } };
    detected: { mode: string; signAndEditExecutable: boolean; warning: string | null };
  };
  describeWinSigning: (detected: { mode: string }) => string;
  detectWinSigning: (env: NodeJS.ProcessEnv) => {
    mode: string;
    signAndEditExecutable: boolean;
    azureSignOptions: Record<string, string> | null;
    warning: string | null;
  };
};

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
  build: { win: { signAndEditExecutable: boolean } };
  scripts: Record<string, string>;
  devDependencies: Record<string, string>;
};

assert.equal(pkg.build.win.signAndEditExecutable, false);
assert.match(pkg.devDependencies["electron-builder"] ?? "", /\^26\./);
assert.equal(pkg.scripts["desktop:build:win"], "node scripts/desktop-build.mjs --win");
console.log("ok: package.json stays unsigned by default; electron-builder 26.x");

const empty = detectWinSigning({});
assert.equal(empty.mode, "none");
assert.equal(empty.signAndEditExecutable, false);
assert.equal(empty.azureSignOptions, null);
assert.equal(empty.warning, null);
assert.match(describeWinSigning(empty), /OFF/);

const exampleEnv = readFileSync(".env.example", "utf8");
assert.match(exampleEnv, /^AZURE_TENANT_ID=$/m);
assert.match(exampleEnv, /^AZURE_CLIENT_ID=$/m);
assert.match(exampleEnv, /^AZURE_CLIENT_SECRET=$/m);
assert.match(exampleEnv, /^AZURE_TRUSTED_SIGNING_ENDPOINT=$/m);
assert.match(exampleEnv, /^AZURE_TRUSTED_SIGNING_ACCOUNT_NAME=$/m);
assert.match(exampleEnv, /^AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE_NAME=$/m);
assert.match(exampleEnv, /^AZURE_TRUSTED_SIGNING_PUBLISHER_NAME=$/m);
assert.doesNotMatch(exampleEnv, /AZURE_CLIENT_SECRET=.+/);
const overlayEmpty = applyWinSigning(structuredClone(pkg.build), {});
assert.equal(overlayEmpty.config.win.signAndEditExecutable, false);
assert.equal(overlayEmpty.config.win.azureSignOptions, undefined);
console.log("ok: empty env keeps signAndEditExecutable false");

const partialAzure = detectWinSigning({
  AZURE_TENANT_ID: "11111111-1111-1111-1111-111111111111",
  AZURE_CLIENT_ID: "22222222-2222-2222-2222-222222222222",
});
assert.equal(partialAzure.mode, "none");
assert.equal(partialAzure.signAndEditExecutable, false);
assert.ok(partialAzure.warning);

const azureEnv: NodeJS.ProcessEnv = {
  AZURE_TENANT_ID: "11111111-1111-1111-1111-111111111111",
  AZURE_CLIENT_ID: "22222222-2222-2222-2222-222222222222",
  AZURE_CLIENT_SECRET: "not-a-real-secret",
  AZURE_TRUSTED_SIGNING_ENDPOINT: "https://wus2.codesigning.azure.net/",
  AZURE_TRUSTED_SIGNING_ACCOUNT_NAME: "cinem-signing",
  AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE_NAME: "cinem-pro-public",
  AZURE_TRUSTED_SIGNING_PUBLISHER_NAME: "CINEM Tech",
};
const azure = detectWinSigning(azureEnv);
assert.equal(azure.mode, "azure");
assert.equal(azure.signAndEditExecutable, true);
assert.equal(azure.azureSignOptions?.endpoint, "https://wus2.codesigning.azure.net/");
assert.equal(azure.azureSignOptions?.codeSigningAccountName, "cinem-signing");
assert.equal(azure.azureSignOptions?.certificateProfileName, "cinem-pro-public");
assert.equal(azure.azureSignOptions?.publisherName, "CINEM Tech");
assert.equal(azure.azureSignOptions?.timestampRfc3161, "http://timestamp.acs.microsoft.com");
const overlayAzure = applyWinSigning(structuredClone(pkg.build), azureEnv);
assert.equal(overlayAzure.config.win.signAndEditExecutable, true);
assert.ok(overlayAzure.config.win.azureSignOptions);
console.log("ok: complete Azure env enables azureSignOptions");

const pfx = detectWinSigning({
  CSC_LINK: "C:\\certs\\cinem.pfx",
  CSC_KEY_PASSWORD: "not-a-real-password",
});
assert.equal(pfx.mode, "pfx");
assert.equal(pfx.signAndEditExecutable, true);
assert.equal(pfx.azureSignOptions, null);
console.log("ok: complete CSC_LINK PFX env enables signing without Azure options");

const desktopBuild = readFileSync("scripts/desktop-build.mjs", "utf8");
assert.match(desktopBuild, /electron-builder\.config\.cjs/);
assert.match(desktopBuild, /detectWinSigning/);
assert.doesNotMatch(desktopBuild, /AZURE_CLIENT_SECRET=./);
const builderConfig = readFileSync("scripts/electron-builder.config.cjs", "utf8");
assert.match(builderConfig, /applyWinSigning/);
assert.ok(existsSync("docs/windows-code-signing.md"));
const docs = readFileSync("docs/windows-code-signing.md", "utf8");
assert.match(docs, /Azure Artifact Signing/);
assert.match(docs, /\$9\.99/);
assert.match(docs, /CINEM Tech/);
assert.match(docs, /AZURE_TENANT_ID/);
assert.match(docs, /AZURE_TRUSTED_SIGNING_ENDPOINT/);
assert.match(docs, /cinem-pro-releases/);
assert.match(docs, /More info/);
assert.match(docs, /afterSign/);
assert.match(docs, /signAndEditExecutable/);
assert.doesNotMatch(docs, /BEGIN RSA PRIVATE KEY/);
assert.match(readFileSync("src/app/download/page.tsx", "utf8"), /SmartScreen/);
assert.match(readFileSync(".gitignore", "utf8"), /\*\.pfx/);
console.log("ok: docs + download note + gitignore; no secrets committed");

console.log("Windows code-signing checks passed.");
