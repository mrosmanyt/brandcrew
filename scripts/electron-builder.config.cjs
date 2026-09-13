/**
 * electron-builder config for `npm run desktop:build*`.
 * Starts from package.json "build" (unsigned default) and enables
 * signAndEditExecutable only when complete signing credentials exist.
 * Also packs electron-updater (excluded by the default !node_modules filter).
 */
const path = require("node:path");
const { createRequire } = require("node:module");
const { config: loadEnv } = require("dotenv");
const { applyWinSigning } = require("./win-code-signing.cjs");

const root = path.join(__dirname, "..");
const requireFromRoot = createRequire(path.join(root, "package.json"));
loadEnv({ path: path.join(root, ".env.local"), quiet: true });
loadEnv({ path: path.join(root, ".env"), quiet: true });

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

if (!config.publish) {
  config.publish = {
    provider: "github",
    owner: "mrosmanyt",
    repo: "cinem-pro-releases",
    releaseType: "release",
  };
}

module.exports = config;
