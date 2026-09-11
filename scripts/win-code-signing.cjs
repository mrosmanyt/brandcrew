/**
 * Windows Authenticode / Azure Artifact Signing (Trusted Signing) detection.
 * Used by electron-builder.config.cjs and desktop-build.mjs.
 * Never logs secret values.
 */

const AZURE_SECRET_KEYS = ["AZURE_CLIENT_SECRET", "AZURE_CLIENT_CERTIFICATE_PATH"];
const PFX_SECRET_KEYS = ["CSC_KEY_PASSWORD", "WIN_CSC_KEY_PASSWORD"];

const AZURE_PROFILE_KEYS = [
  "AZURE_TRUSTED_SIGNING_ENDPOINT",
  "AZURE_TRUSTED_SIGNING_ACCOUNT_NAME",
  "AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE_NAME",
  "AZURE_TRUSTED_SIGNING_PUBLISHER_NAME",
];

function trim(env, key) {
  const value = env[key];
  return typeof value === "string" ? value.trim() : "";
}

function present(env, key) {
  return trim(env, key).length > 0;
}

function azureAuthReady(env) {
  const tenant = present(env, "AZURE_TENANT_ID");
  const client = present(env, "AZURE_CLIENT_ID");
  const secret = present(env, "AZURE_CLIENT_SECRET");
  const cert = present(env, "AZURE_CLIENT_CERTIFICATE_PATH");
  return tenant && client && (secret || cert);
}

function azureProfileReady(env) {
  return AZURE_PROFILE_KEYS.every((key) => present(env, key));
}

function azureHintPresent(env) {
  return (
    present(env, "AZURE_TENANT_ID") ||
    present(env, "AZURE_CLIENT_ID") ||
    present(env, "AZURE_CLIENT_SECRET") ||
    present(env, "AZURE_CLIENT_CERTIFICATE_PATH") ||
    AZURE_PROFILE_KEYS.some((key) => present(env, key))
  );
}

function pfxLink(env) {
  return trim(env, "WIN_CSC_LINK") || trim(env, "CSC_LINK");
}

function pfxPassword(env) {
  return trim(env, "WIN_CSC_KEY_PASSWORD") || trim(env, "CSC_KEY_PASSWORD");
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{
 *   mode: "none" | "azure" | "pfx",
 *   signAndEditExecutable: boolean,
 *   azureSignOptions: Record<string, string> | null,
 *   warning: string | null,
 * }}
 */
function detectWinSigning(env = process.env) {
  const auth = azureAuthReady(env);
  const profile = azureProfileReady(env);

  if (auth && profile) {
    return {
      mode: "azure",
      signAndEditExecutable: true,
      azureSignOptions: {
        publisherName: trim(env, "AZURE_TRUSTED_SIGNING_PUBLISHER_NAME"),
        endpoint: trim(env, "AZURE_TRUSTED_SIGNING_ENDPOINT"),
        codeSigningAccountName: trim(env, "AZURE_TRUSTED_SIGNING_ACCOUNT_NAME"),
        certificateProfileName: trim(env, "AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE_NAME"),
        timestampRfc3161: trim(env, "AZURE_TRUSTED_SIGNING_TIMESTAMP_URL") || "http://timestamp.acs.microsoft.com",
        timestampDigest: "SHA256",
      },
      warning: null,
    };
  }

  const link = pfxLink(env);
  const password = pfxPassword(env);
  if (link && password) {
    return {
      mode: "pfx",
      signAndEditExecutable: true,
      azureSignOptions: null,
      warning: azureHintPresent(env)
        ? "Azure Artifact Signing env is incomplete; using CSC_LINK / WIN_CSC_LINK PFX instead."
        : null,
    };
  }

  let warning = null;
  if (azureHintPresent(env)) {
    warning =
      "Azure Artifact Signing env is incomplete. Unsigned Windows build. Need AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET (or AZURE_CLIENT_CERTIFICATE_PATH), AZURE_TRUSTED_SIGNING_ENDPOINT, AZURE_TRUSTED_SIGNING_ACCOUNT_NAME, AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE_NAME, AZURE_TRUSTED_SIGNING_PUBLISHER_NAME.";
  } else if (link || password) {
    warning =
      "Authenticode PFX env is incomplete. Unsigned Windows build. Need CSC_LINK (or WIN_CSC_LINK) and CSC_KEY_PASSWORD (or WIN_CSC_KEY_PASSWORD).";
  }

  return {
    mode: "none",
    signAndEditExecutable: false,
    azureSignOptions: null,
    warning,
  };
}

/**
 * Overlay signing onto a cloned electron-builder config (package.json "build").
 * @param {Record<string, unknown>} config
 * @param {NodeJS.ProcessEnv} [env]
 */
function applyWinSigning(config, env = process.env) {
  const detected = detectWinSigning(env);
  const win = { ...(config.win && typeof config.win === "object" ? config.win : {}) };
  win.signAndEditExecutable = detected.signAndEditExecutable;
  if (detected.azureSignOptions) {
    win.azureSignOptions = detected.azureSignOptions;
  } else {
    delete win.azureSignOptions;
  }
  return {
    config: { ...config, win },
    detected,
  };
}

function describeWinSigning(detected) {
  if (detected.mode === "azure") {
    return "Windows signing ON (Azure Artifact Signing / Trusted Signing).";
  }
  if (detected.mode === "pfx") {
    return "Windows signing ON (Authenticode PFX via CSC_LINK).";
  }
  return "Windows signing OFF (unsigned local/CI build).";
}

function isSigningSecretKey(key) {
  return AZURE_SECRET_KEYS.includes(key) || PFX_SECRET_KEYS.includes(key);
}

module.exports = {
  AZURE_PROFILE_KEYS,
  applyWinSigning,
  describeWinSigning,
  detectWinSigning,
  isSigningSecretKey,
};
