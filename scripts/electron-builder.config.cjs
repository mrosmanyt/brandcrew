/**
 * electron-builder config for `npm run desktop:build*`.
 * Starts from package.json "build" (unsigned default) and enables
 * signAndEditExecutable only when complete signing credentials exist.
 * Also packs electron-updater (excluded by the default !node_modules filter).
 */
// This file is executed directly by electron-builder as plain CommonJS (not
// bundled/transpiled), so it must keep using require() — ESM import syntax
// is invalid in this run context.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("node:path");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createRequire } = require("node:module");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { config: loadEnv } = require("dotenv");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { applyWinSigning } = require("./win-code-signing.cjs");

const root = path.join(__dirname, "..");
const requireFromRoot = createRequire(path.join(root, "package.json"));
loadEnv({ path: path.join(root, ".env.local"), quiet: true });
loadEnv({ path: path.join(root, ".env"), quiet: true });

// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS build script executed directly by electron-builder
const pkg = require(path.join(root, "package.json"));
const { config } = applyWinSigning(structuredClone(pkg.build), process.env);

function updaterModuleGlobs() {
  const names = new Set();
  const queue = ["electron-updater"];
  while (queue.length) {
    const name = queue.pop();
    if (!name || names.has(name)) continue;
    names.add(name);
    try {
      const pkgPath = requireFromRoot.resolve(`${name}/package.json`);
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS build script executed directly by electron-builder
      const depPkg = require(pkgPath);
      for (const dep of Object.keys(depPkg.dependencies || {})) {
        queue.push(dep);
      }
    } catch {
      /* optional / already hoisted under another package */
    }
  }
  return [...names].map((name) => `node_modules/${name}/**/*`);
}

const files = Array.isArray(config.files) ? [...config.files] : [];
for (const glob of updaterModuleGlobs()) {
  if (!files.includes(glob)) files.push(glob);
}
config.files = files;

if (!Array.isArray(config.asarUnpack) || !config.asarUnpack.some((g) => String(g).includes("electron-updater"))) {
  config.asarUnpack = [
    ...(Array.isArray(config.asarUnpack) ? config.asarUnpack : []),
    "**/node_modules/electron-updater/**/*",
    "**/node_modules/builder-util-runtime/**/*",
  ];
}

if (!config.publish) {
  config.publish = {
    provider: "github",
    owner: "mrosmanyt",
    repo: "cinem-pro-releases",
    releaseType: "release",
  };
}

module.exports = config;
