/**
 * electron-builder config for `npm run desktop:build*`.
 * Starts from package.json "build" (unsigned default) and enables
 * signAndEditExecutable only when complete signing credentials exist.
 */
const path = require("node:path");
const { config: loadEnv } = require("dotenv");
const { applyWinSigning } = require("./win-code-signing.cjs");

const root = path.join(__dirname, "..");
loadEnv({ path: path.join(root, ".env.local"), quiet: true });
loadEnv({ path: path.join(root, ".env"), quiet: true });

const pkg = require(path.join(root, "package.json"));
const { config } = applyWinSigning(structuredClone(pkg.build), process.env);

module.exports = config;
