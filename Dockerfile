FROM public.ecr.aws/docker/library/node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
ARG NEXT_PUBLIC_SEEDLING_TIMEZONE
ENV NEXT_PUBLIC_SEEDLING_TIMEZONE=$NEXT_PUBLIC_SEEDLING_TIMEZONE
COPY . .
RUN pnpm build

FROM public.ecr.aws/docker/library/node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends docker.io && rm -rf /var/lib/apt/lists/*
COPY --from=build /app /app
RUN rm -rf /app/.git /app/.env* /app/data \
 && chmod 0755 /app/deploy/docker-entrypoint.sh \
 && mkdir -p /app/.next/cache && chown -R node:node /app/.next/cache
EXPOSE 3100
ENTRYPOINT ["/app/deploy/docker-entrypoint.sh"]
CMD ["node_modules/.bin/tsx", "--tsconfig", "tsconfig.json", "server.ts"]
