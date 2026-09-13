# Windows code signing (CINEM Pro Setup.exe)

Unsigned `CINEM-Pro-Setup.exe` shows **Unknown publisher**. Windows Defender SmartScreen then warns “Windows protected your PC.” That is expected until a **signed** installer is published to [cinem-pro-releases](https://github.com/mrosmanyt/cinem-pro-releases).

This repo does **not** buy certificates and does **not** commit secrets. The founder must create an Azure Artifact Signing account, verify **CINEM Tech**, put credentials on the **Windows release machine** (or the CI job that runs `npm run desktop:build:win`), rebuild, and upload the new Setup.exe.

Vercel hosts the website and `/download` links. It does **not** sign `.exe` files. Signing env belongs on the packager, not on the Next.js deployment.

## Why SmartScreen appears

Windows treats an Authenticode signature as the publisher identity. Without one:

- File properties → Digital Signatures is empty.
- SmartScreen has no reputation for “CINEM Pro” as a signed publisher.
- First-time downloads look like unknown software even when the bytes came from GitHub Releases.

A Public Trust signature from Azure Artifact Signing (formerly **Trusted Signing**) gives SmartScreen a Microsoft-backed publisher. Reputation still builds over a few signed releases and download volume; the warning usually recedes after signed builds ship, it does not vanish the minute the first file is signed.

## Recommended: Azure Artifact Signing (Trusted Signing) Basic

Cheapest production path for CINEM launch:

| | |
| --- | --- |
| Product | [Azure Artifact Signing](https://azure.microsoft.com/en-us/products/artifact-signing) (renamed from Trusted Signing; same service) |
| SKU | **Basic** ≈ **USD $9.99 / month** per account, 5,000 signatures included, $0.005 after that |
| Alternative SKU | Premium ≈ $99.99 / month (not needed for Setup.exe) |
| Docs | [Quickstart](https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart), [signing integrations](https://learn.microsoft.com/en-us/azure/artifact-signing/how-to-signing-integrations), [FAQ](https://learn.microsoft.com/en-us/azure/artifact-signing/faq), [pricing](https://azure.microsoft.com/en-us/pricing/details/trusted-signing/) |

Requirements Microsoft currently documents:

- A **paid** Azure subscription (free / trial / sponsored subscriptions cannot create Artifact Signing accounts).
- Resource provider **`Microsoft.CodeSigning`** registered on that subscription.
- Public Trust identity validation for organizations in the USA, Canada, the EU, and the UK (individual-developer Public Trust is USA/Canada only).

electron-builder **26.x** in this repo supports Azure Trusted Signing natively via `win.azureSignOptions`. `npm run desktop:build:win` turns `signAndEditExecutable` **on** only when the env below is complete; otherwise the build stays unsigned.

## Alternative: traditional OV / EV Authenticode PFX

Buy an Organization Validation (OV) or Extended Validation (EV) code-signing certificate from a public CA, install it as a `.pfx` on the Windows packager (or a USB/HSM for EV). electron-builder’s standard env:

| Variable | Meaning |
| --- | --- |
| `CSC_LINK` or `WIN_CSC_LINK` | Path or URL to the `.pfx` (never commit the file) |
| `CSC_KEY_PASSWORD` or `WIN_CSC_KEY_PASSWORD` | PFX password |

EV is stronger against SmartScreen (USB/HSM, hardware-backed). It costs more than Artifact Signing Basic and is **not** required for launch. Prefer Azure unless a CA/PFX is already purchased.

## Identity verification (company: CINEM Tech)

Do this in the [Azure portal](https://portal.azure.com/). Identity validation **cannot** be completed with the Azure CLI.

1. Use a pay-as-you-go (or EA) subscription whose **billing account legal name and address** match CINEM Tech’s official registration. Microsoft copies billing data onto Public Trust certificates; mismatches cause wrong CN/O or failed validation.
2. Register resource provider **Microsoft.CodeSigning**.
3. Create an **Artifact Signing account** in a supported region (West US 2 is a common choice). Pick SKU **Basic**. Account names: 3–24 alphanumeric characters, globally unique, start with a letter.
4. Assign yourself **Artifact Signing Identity Verifier** (the **New identity** button stays disabled without it). Role tutorial: [Assign roles in Artifact Signing](https://learn.microsoft.com/en-us/azure/artifact-signing/tutorial-assign-roles).
5. **Identity validations** → **Organization** → **New Identity** → **Public** (needed for SmartScreen / Win32).
6. Fill the legal entity exactly as registered, not the marketing product name:

   | Field | CINEM notes |
   | --- | --- |
   | Organization Name | Legal business entity (CINEM Tech as on company records) |
   | Website URL | Company site that belongs to that entity |
   | Primary / secondary email | Entity mailboxes that can receive external links (primary link expires in **7 days**) |
   | Business identifier | Company registration / tax id as Microsoft’s form requests |
   | Address | Registered business address |
   | Representative first / last name | Exact government-ID spelling |

7. Complete the representative’s Verified ID (government photo ID + Microsoft Authenticator). Status **Action Required** is when extra documents upload; **Failed** requests are not reopened — start a new validation.
8. Wait **1–20 business days** (longer if they ask for documents). Status **Completed** is required before a certificate profile exists.
9. **Certificate profiles** → **Create** → type **Public Trust**. Name it something like `cinem-pro-public`. Select the verified CINEM Tech identity for **Verified CN and O**.
10. Create a Microsoft Entra **App registration** (service principal) for the packager. Create a **client secret**. Assign that app **Artifact Signing Certificate Profile Signer** on the certificate profile (or account, per current RBAC docs).

Public Trust CN/O cannot be a custom marketing string. After validation, copy the certificate **Common Name** into `AZURE_TRUSTED_SIGNING_PUBLISHER_NAME` (electron-builder requires an exact match).

## Environment variables (release machine / CI)

Copy from [`.env.example`](../.env.example). Empty values keep local builds unsigned. Never commit filled secrets.

### Azure Artifact Signing (recommended)

Microsoft’s SignTool metadata uses `Endpoint`, `CodeSigningAccountName`, and `CertificateProfileName`. electron-builder v26 maps those to `win.azureSignOptions`. Auth is DefaultAzureCredential; the service-principal-with-secret path needs:

| Variable | Maps to |
| --- | --- |
| `AZURE_TENANT_ID` | Entra tenant ID |
| `AZURE_CLIENT_ID` | App registration **Application (client) ID** (not Object ID) |
| `AZURE_CLIENT_SECRET` | Client secret **value** (not the secret ID) |
| `AZURE_CLIENT_CERTIFICATE_PATH` | Optional instead of the secret (cert auth) |
| `AZURE_TRUSTED_SIGNING_ENDPOINT` | Regional URI, e.g. `https://wus2.codesigning.azure.net/` — **must** match the account region or SignTool returns 403 |
| `AZURE_TRUSTED_SIGNING_ACCOUNT_NAME` | Artifact Signing **account** name (`CodeSigningAccountName`) |
| `AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE_NAME` | Public Trust profile name |
| `AZURE_TRUSTED_SIGNING_PUBLISHER_NAME` | Certificate CN (publisherName) |
| `AZURE_TRUSTED_SIGNING_TIMESTAMP_URL` | Optional; default `http://timestamp.acs.microsoft.com` (required because Artifact Signing certs are short-lived) |

Regional endpoints (current Microsoft table):

| Region | Endpoint |
| --- | --- |
| Brazil South | `https://brs.codesigning.azure.net` |
| Central US | `https://cus.codesigning.azure.net` |
| East US | `https://eus.codesigning.azure.net` |
| Japan East | `https://jpe.codesigning.azure.net` |
| Korea Central | `https://krc.codesigning.azure.net` |
| North Central US | `https://ncus.codesigning.azure.net` |
| North Europe | `https://neu.codesigning.azure.net` |
| Poland Central | `https://plc.codesigning.azure.net` |
| South Central US | `https://scus.codesigning.azure.net` |
| Switzerland North | `https://swn.codesigning.azure.net` |
| West Central US | `https://wcus.codesigning.azure.net` |
| West Europe | `https://weu.codesigning.azure.net` |
| West US | `https://wus.codesigning.azure.net` |
| West US 2 | `https://wus2.codesigning.azure.net` |
| West US 3 | `https://wus3.codesigning.azure.net` |

### Traditional PFX (alternative)

`CSC_LINK` / `WIN_CSC_LINK` + `CSC_KEY_PASSWORD` / `WIN_CSC_KEY_PASSWORD`. Used only when the Azure set is incomplete.

## How the build flips signing on

`package.json` `build.win.signAndEditExecutable` stays **`false`** so a raw `electron-builder` invocation never requires a cert.

`npm run desktop:build:win` loads `scripts/electron-builder.config.cjs`, which clones that config and:

- sets `signAndEditExecutable: true` and `win.azureSignOptions` when Azure env is complete (electron-builder 26 Azure Trusted Signing);
- or sets `signAndEditExecutable: true` when a PFX link + password exist;
- otherwise leaves signing **off** and prints `Windows signing OFF (unsigned local/CI build).`

Partial Azure or PFX env does **not** fail the packager; it warns and ships unsigned.

Signed Authenticode needs a **Windows** packager (SignTool / Artifact Signing dlib). Linux + Wine can still produce an unsigned NSIS/portable exe.

### afterSign / signtool fallback

Do not add a custom hook while `azureSignOptions` works. If a future electron-builder drop Azure support, a placeholder would look like:

```js
// electron-builder.yml / package.json "build" — do not enable until credentials exist
// "afterSign": "electron/win-after-sign.cjs"
```

```js
// electron/win-after-sign.cjs — placeholder only
exports.default = async function afterSign(context) {
  if (context.electronPlatformName !== "win32") return;
  if (!process.env.CINEM_WIN_SIGN_CMD) return; // unsigned local builds
  // Run a founder-supplied signtool command. Never hardcode secrets.
  throw new Error("Set CINEM_WIN_SIGN_CMD to your signtool invocation, or restore azureSignOptions.");
};
```

## Rebuild and publish to cinem-pro-releases

On a Windows machine with Node 20+, this repo, and the env vars set (process env or `.env` — `.env` is gitignored):

```powershell
npm ci
npm run desktop:build:win
```

Confirm the log line `Windows signing ON (Azure Artifact Signing / Trusted Signing).` Artifacts: `dist/desktop/CINEM-Pro-Setup.exe` and `CINEM-Pro-Portable.exe`.

Check the signature (PowerShell):

```powershell
Get-AuthenticodeSignature .\dist\desktop\CINEM-Pro-Setup.exe | Format-List *
```

`Status` should be `Valid`. Publisher should be the CINEM Tech CN.

Publish to the public releases repo (same asset names `/download` already uses):

```bash
gh release upload v0.1.0 \
  dist/desktop/CINEM-Pro-Setup.exe \
  dist/desktop/CINEM-Pro-Portable.exe \
  --repo mrosmanyt/cinem-pro-releases \
  --clobber
```

Or cut a new tagged release if you bump the app version. Marketing buttons hit `…/releases/latest/download/CINEM-Pro-Setup.exe` (unified Desk + AI Assistant).

Do not upload `.pfx`, client secrets, or `.env` to GitHub.

## Temporary user workaround (unsigned builds)

Until a signed Setup.exe is on `latest`:

1. If the browser download bar says the file is uncommon: **Keep** → **Show more** → **Keep anyway**.
2. Run `CINEM-Pro-Setup.exe`.
3. SmartScreen: **More info** → **Run anyway**.

That is a Windows reputation prompt, not an antivirus detection of CINEM Pro. It goes away for most users after signed builds accumulate reputation. Do not tell users to disable SmartScreen globally.
