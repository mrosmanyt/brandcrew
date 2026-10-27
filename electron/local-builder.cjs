/**
 * Desktop-only local project scaffold for Build intents.
 * Writes starter files into a user-selected folder after explicit permission.
 */
const fs = require("node:fs/promises");
const path = require("node:path");

/** @type {{ granted: boolean, folder: string | null }} */
let permission = { granted: false, folder: null };

function slugify(text) {
  return String(text || "project")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "project";
}

function websiteScaffold(prompt) {
  const title = prompt.slice(0, 60) || "My site";
  return {
    "index.html": `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="hero">
    <p class="kicker">Built with CINEM Pro</p>
    <h1>${title}</h1>
    <p class="lead">${prompt.slice(0, 200)}</p>
    <a class="btn" href="#contact">Get started</a>
  </header>
  <main id="contact">
    <section>
      <h2>Next steps</h2>
      <p>Open this folder in your editor. Ask CINEM Pro to iterate on index.html and styles.css.</p>
    </section>
  </main>
  <script src="app.js"></script>
</body>
</html>`,
    "styles.css": `:root { color-scheme: light dark; font-family: system-ui, sans-serif; }
body { margin: 0; line-height: 1.6; }
.hero { padding: 4rem 1.5rem; max-width: 48rem; margin: 0 auto; }
.kicker { text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.75rem; opacity: 0.7; }
.lead { font-size: 1.125rem; opacity: 0.85; }
.btn { display: inline-block; margin-top: 1rem; padding: 0.6rem 1rem; border-radius: 999px; background: #111; color: #fff; text-decoration: none; }
main { padding: 2rem 1.5rem 4rem; max-width: 48rem; margin: 0 auto; }`,
    "app.js": `// CINEM Pro local build — ${new Date().toISOString()}
console.log("CINEM Pro project ready");`,
    "README.md": `# ${title}

Created by CINEM Pro desktop builder.

## Prompt
${prompt}

## Files
- index.html — landing page
- styles.css — layout and theme
- app.js — optional interactivity

Open this folder locally and keep iterating with CINEM Pro on the desk.
`,
  };
}

function appScaffold(prompt) {
  const title = prompt.slice(0, 60) || "Mini app";
  return {
    "index.html": `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <div id="app"></div>
  <script src="app.js"></script>
</body>
</html>`,
    "styles.css": `body { font-family: system-ui, sans-serif; margin: 0; padding: 1.5rem; }
#app { max-width: 28rem; margin: 0 auto; }`,
    "app.js": `const root = document.getElementById("app");
const prompt = ${JSON.stringify(prompt)};
root.innerHTML = \`
  <h1>${title}</h1>
  <p>\${prompt.slice(0, 240)}</p>
  <button id="action">Tap</button>
  <p id="out"></p>\`;
document.getElementById("action")?.addEventListener("click", () => {
  document.getElementById("out").textContent = "CINEM Pro app shell is ready — extend app.js from here.";
});`,
    "README.md": `# ${title}

CINEM Pro mini-app scaffold.

Prompt: ${prompt}
`,
  };
}

function deckScaffold(prompt) {
  const title = prompt.slice(0, 60) || "Pitch deck";
  return {
    "index.html": `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <section class="slide"><h1>${title}</h1><p>${prompt.slice(0, 160)}</p></section>
  <section class="slide"><h2>Problem</h2><p>Describe the pain you solve.</p></section>
  <section class="slide"><h2>Solution</h2><p>How your product helps.</p></section>
  <section class="slide"><h2>Ask</h2><p>Next step for the audience.</p></section>
</body>
</html>`,
    "styles.css": `body { margin: 0; font-family: system-ui, sans-serif; }
.slide { min-height: 100vh; padding: 4rem 2rem; box-sizing: border-box; border-bottom: 1px solid #ddd; }`,
    "README.md": `# ${title}

Slide deck HTML scaffold for ${prompt.slice(0, 120)}.
`,
  };
}

function filesForKind(kind, prompt) {
  if (kind === "app") return appScaffold(prompt);
  if (kind === "deck") return deckScaffold(prompt);
  return websiteScaffold(prompt);
}

function getBuildPermission() {
  return { granted: permission.granted, folder: permission.folder };
}

function requestBuildPermission(folder) {
  const normalized = path.resolve(String(folder || ""));
  if (!normalized) {
    return { granted: false, error: "Choose a project folder first." };
  }
  permission = { granted: true, folder: normalized };
  return { granted: true, folder: normalized };
}

function revokeBuildPermission() {
  permission = { granted: false, folder: null };
}

async function runLocalBuild(input) {
  const kind = input?.kind === "app" || input?.kind === "deck" ? input.kind : "website";
  const prompt = String(input?.prompt || "").trim() || "New CINEM Pro project";
  const folder = path.resolve(String(input?.folder || permission.folder || ""));
  if (!permission.granted || !folder) {
    return { ok: false, error: "Allow local build access and pick a folder first." };
  }
  const sub = path.join(folder, slugify(prompt));
  await fs.mkdir(sub, { recursive: true });
  const files = filesForKind(kind, prompt);
  const written = [];
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(sub, name);
    await fs.writeFile(target, content, "utf8");
    written.push(name);
  }
  return {
    ok: true,
    folder: sub,
    files: written,
    summary: `Created ${written.length} files in ${sub}`,
  };
}

module.exports = {
  getBuildPermission,
  requestBuildPermission,
  revokeBuildPermission,
  runLocalBuild,
};
