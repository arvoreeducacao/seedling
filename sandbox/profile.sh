export PS1='\[\e[32m\]›\[\e[0m\] \w \$ '
mkdir -p "$HOME/.claude"
node -e '
const fs = require("fs");
const file = process.env.HOME + "/.claude.json";
let config = {};
try { config = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
config.hasCompletedOnboarding = true;
config.theme = config.theme || "dark";
config.bypassPermissionsModeAccepted = config.bypassPermissionsModeAccepted || false;
config.projects = config.projects || {};
const workspace = config.projects["/workspace"] || {};
workspace.hasTrustDialogAccepted = true;
workspace.hasCompletedProjectOnboarding = true;
workspace.projectOnboardingSeenCount = Math.max(1, workspace.projectOnboardingSeenCount || 0);
config.projects["/workspace"] = workspace;
config.mcpServers = config.mcpServers || {};
config.mcpServers.playwright = { type: "stdio", command: "node", args: ["/opt/seedling/browser/seedling-browser.cjs"], env: {} };
fs.writeFileSync(file, JSON.stringify(config));
' 2>/dev/null || true
