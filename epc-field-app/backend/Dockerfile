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

CMD ["node", "src/server.js"]
