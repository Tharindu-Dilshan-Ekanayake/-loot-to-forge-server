# Loot to Forge game server, for Bloxity Legion hosting.
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src

# Legion injects PORT (2567); profiles go to the managed Mongo via MONGODB_URI.
ENV PORT=2567
EXPOSE 2567

# Run as the image's built-in non-root user.
USER node

CMD ["node", "src/index.js"]
