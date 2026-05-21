FROM node:22-alpine AS deps

WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/cli/package.json ./apps/cli/package.json
COPY apps/www/package.json ./apps/www/package.json
COPY apps/api/prisma ./apps/api/prisma
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS build

WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build

FROM node:22-alpine AS runtime

WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable
ENV NODE_ENV=production
ENV PORT=8080
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/api/prisma ./apps/api/prisma
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 8080
CMD ["sh", "-c", "pnpm exec prisma db push --schema apps/api/prisma/schema.prisma --skip-generate && node dist/apps/api/src/index.js"]
