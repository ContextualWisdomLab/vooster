FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2

WORKDIR /src
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/cli/package.json ./apps/cli/package.json
COPY apps/www/package.json ./apps/www/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json

RUN chown -R node:node /src
USER node

RUN pnpm install --frozen-lockfile --ignore-scripts
