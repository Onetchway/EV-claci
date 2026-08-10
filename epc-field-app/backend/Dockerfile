FROM node:20-slim

# Chromium for Puppeteer-based PDF generation, plus the fonts/libs it needs to render
# the report HTML (tables, emoji-free text) correctly.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src

RUN mkdir -p storage/originals storage/stamped storage/pdf

EXPOSE 4100

# Runs pending migrations on every container start, then starts the server. This replaces
# Render's preDeployCommand (not available on the free plan) with something plan-agnostic —
# migrate deploy is a no-op if the database is already up to date.
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
