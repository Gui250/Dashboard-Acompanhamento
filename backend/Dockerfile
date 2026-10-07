FROM node:24-alpine AS base
WORKDIR /app
RUN chown node:node /app
USER node

FROM base AS deps
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci

# Dev: o código entra por bind mount (docker-compose.dev.yml)
FROM deps AS dev
EXPOSE 3333
CMD ["npx", "tsx", "watch", "src/server.ts"]

FROM deps AS build
COPY --chown=node:node . .
RUN npm run build

FROM base AS prod-deps
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY drizzle ./drizzle
COPY package.json ./
USER node
EXPOSE 3333
# Migrations antes do server: se falharem, o container não sobe.
CMD ["sh", "-c", "node dist/migrate.js && exec node dist/server.js"]
