FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@12.3.4 --activate

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS production-dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

FROM dependencies AS web-build
COPY . .
ENV BETTER_AUTH_URL="https://build.example.invalid"
ENV BETTER_AUTH_TRUSTED_ORIGINS="https://build.example.invalid"
ENV BETTER_AUTH_SECRET="build-only-placeholder"
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM base AS web
ENV NODE_ENV=production
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=web-build --chown=node:node /app/.next ./.next
COPY --from=web-build --chown=node:node /app/public ./public
COPY --from=web-build --chown=node:node /app/package.json /app/next.config.mjs ./
USER node
EXPOSE 3000
CMD ["node_modules/.bin/next", "start", "--hostname", "0.0.0.0"]

FROM base AS outbox-worker
ENV NODE_ENV=production
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json tsconfig.json ./
COPY --chown=node:node scripts/outbox-worker.ts ./scripts/outbox-worker.ts
COPY --chown=node:node lib/db ./lib/db
COPY --chown=node:node lib/domain-rules.ts ./lib/domain-rules.ts
COPY --chown=node:node modules/admin ./modules/admin
COPY --chown=node:node modules/archive ./modules/archive
COPY --chown=node:node modules/genres ./modules/genres
COPY --chown=node:node modules/identity ./modules/identity
COPY --chown=node:node modules/library ./modules/library
COPY --chown=node:node modules/moderation ./modules/moderation
COPY --chown=node:node modules/profiles ./modules/profiles
USER node
CMD ["node_modules/.bin/tsx", "scripts/outbox-worker.ts"]
