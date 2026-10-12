# Multi-stage production container for DELTA Engine Edge Deployment
FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies first for Docker layer caching
COPY package*.json ./
RUN npm install --omit=dev

# Copy application source
COPY . .

# Expose HTTP & WebSocket server port
EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

# Healthcheck to ensure deterministic engine and state endpoints are responsive
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/state || exit 1

CMD ["node", "backend/server.js"]
