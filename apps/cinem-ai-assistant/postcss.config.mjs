// Tailwind is applied by @tailwindcss/vite — not PostCSS.
// This no-op config stops Vite's postcss-load-config search from walking
// up to the monorepo root postcss.config.mjs (@tailwindcss/postcss),
// which is not installed in this app's node_modules.
const config = {
  plugins: {},
};

export default config;
