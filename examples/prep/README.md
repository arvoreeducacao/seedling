# Prep kits

A prep kit is what candidates see before they press Start: how your team works, a few sections to read with links, an optional practice run and what they may bring (skills, CLAUDE.md, remote MCP servers).

Import one in **Settings → Candidate prep → Edit kit → Import and replace**, and export yours from the same page to share it.

- `arvore.json`: the kit Árvore uses for its engineering interviews. It is an example: the links are public reading, and the text describes Árvore's way of working, so rewrite it for your team before importing it.

## Format

```json
{
  "version": 1,
  "name": "Interview prep",
  "opensDaysBefore": 7,
  "howWeWork": "Markdown",
  "sections": [
    { "title": "Section", "body": "Markdown", "links": [{ "title": "Link", "url": "https://…", "why": "Optional" }] }
  ],
  "practice": { "mode": "playground", "budgetUsd": 1, "minutes": 20 },
  "bring": { "skills": true, "mcpServers": true, "claudeMd": true }
}
```

`practice.mode` is `off`, `playground` (the default: a free sandbox with a small sample project, no challenge needed) or `challenge`. With `challenge`, `practice.challenge` is the slug of a published challenge in the importing workspace; when it doesn't exist there, candidates get the playground until an admin picks one. Kits written before `mode` existed still import: `"enabled": false` means off and `"enabled": true` with a challenge means challenge.
