# Security policy

Seedling hands strangers a sandbox, a live AI agent and a budget on your API key. We take reports about it seriously.

## Reporting a vulnerability

Please report privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**. This opens a private security advisory that only the maintainers can see.

Do not open a public issue, pull request or discussion for a security problem.

Include what you can of:

- the part affected (admin panel, candidate workspace, sandbox, AI gateway, preview proxy, deployment) and the version or commit;
- what an attacker can do and what they need first (an invite link, an admin account, a page opened in a preview);
- steps or a proof of concept.

We will acknowledge the report within three working days, keep you updated while we fix it, and credit you in the advisory unless you prefer otherwise.

## Scope

In scope, among others:

- escaping a sandbox, or one session reaching another session, the server or the host network;
- using the AI gateway beyond a session's pass, budget or time, or getting the real API key;
- a candidate reading hidden tests, the reference solution or the rubric;
- script from a candidate's page running on the app's origin, or reading another session's preview;
- authentication or authorization flaws in the panel, invite links, prep links or WebSockets.

Out of scope: problems that need a malicious administrator of the deployment, denial of service by volume, and missing hardening headers without a concrete impact.

## Supported versions

Only the latest commit on `main` receives fixes.

## What Seedling guarantees

- The real AI key stays on the server. The candidate's environment gets a pass with an expiry and a spending cap, which the gateway checks on every request and revokes when the session ends.
- Hidden tests, the reference solution and the rubric are never copied into the candidate's environment and never reach what Claude reads. Hidden tests run on submission, in a fresh container with no network.
- Each session runs in a non-root container with a read-only system disk, no capabilities, CPU, memory and process limits, and a cap on concurrent sessions.
- With `docker-compose.yml`, session containers live on an internal network that can only reach the Seedling server.
- Pages the candidate builds are served from `SEEDLING_PREVIEW_ORIGIN`, never from the app's origin, inside a sandboxed iframe. Access needs a short-lived signed ticket from a candidate or admin session, and stops when the session ends.
- The agent's browser (headless Chromium driven by Playwright MCP) reaches only localhost and the public internet. A proxy inside the sandbox resolves each host and refuses private, link-local, metadata and other internal addresses; WebRTC cannot send UDP around the proxy. The sandbox network rules still apply underneath.
- The server never follows a link out of a workspace. Every read and write of candidate files resolves the real path and refuses anything outside that session's workspace, and grading copies and permission changes skip links.
- State-changing requests and WebSocket upgrades from any other origin, including the preview origin, are refused.
- The gateway reserves each request's worst-case cost before forwarding it, clamps `max_tokens`, thinking and effort, bills streams that are cut short, and caps parallel requests per session.
- Workspace files the viewer shows inline (images, SVG, PDF) are served with a restrictive Content-Security-Policy and `nosniff`, and SVG runs sandboxed, so opening one cannot run script on the app's origin.

## Known limits

- The Docker driver uses the host's Docker socket. Run Seedling on a machine of its own.
- Without `SEEDLING_SANDBOX_NETWORK`, as in local development, the session container has internet access.
- Which agent made a request to Claude comes from a header set inside the sandbox, so the candidate could change it. It shapes the parallelism report, never access or budget: every agent shares the same pass and cap.
- Locally the preview origin is another port on `localhost`. Browsers scope cookies by host, not by port, so a page opened in its own tab could read the app's non-HttpOnly cookies. Seedling's own cookies are HttpOnly; use a separate subdomain in production.
- The preview origin is shared by every session. A page from one candidate opened in an admin's browser could read another session's preview if the same browser has it open. Put the preview on a registrable domain of its own so candidate script cannot set cookies for the app's parent domain either.
- The parallel-request cap and budget reservations live in the server's memory, which fits the single replica Seedling runs as.
- For stronger isolation, install gVisor and set `SEEDLING_SANDBOX_RUNTIME=runsc`.
