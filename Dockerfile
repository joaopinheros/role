FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=optional --ignore-scripts
COPY . .
RUN node scripts/build.js

FROM node:20-alpine
ENV NODE_ENV=production PORT=3000 DATA_FILE=/data/db.json
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY server ./server
COPY src/engine/fmcore.js ./src/engine/fmcore.js
COPY public ./public
COPY scripts/build.js ./scripts/build.js
COPY --from=build /app/dist ./dist
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/healthz || exit 1
USER node
CMD ["node", "server/server.js"]
