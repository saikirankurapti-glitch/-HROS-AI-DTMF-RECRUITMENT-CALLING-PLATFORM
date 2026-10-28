FROM node:22-bookworm AS build
WORKDIR /app
COPY package*.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi
COPY server server
RUN npm run build --workspace=server
RUN npm prune --omit=dev --no-audit --no-fund
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/migrations ./server/migrations
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/package.json ./package.json
EXPOSE 3001
CMD ["node", "--experimental-sqlite", "server/dist/index.js"]
