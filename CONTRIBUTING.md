# Contributing

Thanks for helping. This guide covers how the code is laid out, how to run it on your machine, and what a pull request needs.

## Layout

| Path | What it is |
|---|---|
| `server.ts` | Entry point: Next.js, the terminal and live WebSockets, the preview listener and the session sweeper |
| `src/app` | Pages and API routes. `(admin)` is the interviewer panel, `s/[token]` is everything the candidate sees |
| `src/lib/gateway.ts` | The AI gateway: passes, budgets, clamping and metering |
| `src/lib/sandbox` | The Docker driver that creates, limits and removes sandboxes |
| `src/lib/challenges` | Challenge import, file classification and pre-publish checks |
| `src/lib/prep`, `src/lib/setup` | Prep kits and the setup candidates bring |
| `src/lib/db` | Drizzle schema; migrations live in `drizzle/` |
| `src/server` | Terminal, preview proxy and origin checks used by `server.ts` |
| `sandbox` | The candidate sandbox image |
| `examples` | A sample challenge and a sample prep kit |
| `deploy` | The container entrypoint and a Kubernetes example |

## Requirements

- Node.js 22 or newer and pnpm 10 (`corepack enable`)
- Docker (Docker Desktop on macOS and Windows)

## Run it

```sh
pnpm install
docker build -t seedling-sandbox:latest sandbox
cp .env.example .env.local
pnpm dev
```

Set `BETTER_AUTH_SECRET` and `ANTHROPIC_API_KEY` in `.env.local`, and put your email in `SEEDLING_ADMIN_EMAILS`. The server runs migrations on start and listens on http://localhost:3100, with candidate previews on http://localhost:3101.

To work on the UI without spending on the API, point `ANTHROPIC_UPSTREAM_URL` at any server that speaks the Anthropic Messages API.

## Tests

```sh
pnpm test
pnpm build
```

CI runs both on every pull request.

## Database changes

Change `src/lib/db/schema.ts`, then run `pnpm db:generate` and commit the new file in `drizzle/`. Existing deployments migrate on start, so a migration must work on a database that already has data.

## Pull requests

- One change per pull request, with a description of what changes for the interviewer, the candidate or whoever deploys Seedling, and how you checked it.
- Add or update tests for behavior you change.
- No comments in code, configuration or scripts: names carry the meaning. Tool directives such as `eslint-disable` are the only exception.
- Code, tests, commit messages and documentation are in English.
- Nothing specific to one deployment (domains, email domains, account ids) goes into code: make it configuration.
- Never commit secrets, real candidate data or screenshots that show them. Use fictitious people and `example.com` addresses.
- By contributing you agree that your contribution is licensed under the Apache License 2.0.

Security problems go through `SECURITY.md`, not issues.
