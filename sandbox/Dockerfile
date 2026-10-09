FROM public.ecr.aws/docker/library/node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-pip python3-venv python3-pytest git ripgrep curl ca-certificates less procps chromium fonts-liberation fonts-noto-color-emoji \
 && rm -rf /var/lib/apt/lists/*

RUN npm install -g @anthropic-ai/claude-code@2 && npm cache clean --force

RUN git config --system --add safe.directory "*"

RUN PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install -g @playwright/mcp@0.0.82 && npm cache clean --force

COPY browser /opt/seedling/browser

RUN userdel -r node \
 && groupadd -g 1000 candidate \
 && useradd -m -u 1000 -g 1000 -s /bin/bash candidate \
 && mkdir -p /workspace \
 && chown candidate:candidate /workspace

COPY profile.sh /etc/profile.d/seedling.sh

ENV DISABLE_AUTOUPDATER=1 \
    DISABLE_TELEMETRY=1 \
    DISABLE_ERROR_REPORTING=1 \
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    PYTHONDONTWRITEBYTECODE=1

USER candidate
WORKDIR /workspace
CMD ["sleep", "infinity"]
