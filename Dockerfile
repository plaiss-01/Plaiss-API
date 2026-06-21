# Stage 1: Builder
FROM node:24-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++ openssl

WORKDIR /app

# Copy package files and prisma schema first
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies including devDependencies for build
RUN npm install

# Copy source code
COPY . .

# Generate Prisma client and build the app
# Capture output to temp file and strip non-ASCII (Unicode chars crash az acr build on Windows)
RUN sh -c 'NO_COLOR=1 npx prisma generate > /tmp/pg.txt 2>&1; RC=$?; tr -cd "[:print:]\n" < /tmp/pg.txt; exit $RC'
RUN npm run build

# Prune development dependencies
RUN npm prune --omit=dev

# Stage 2: Runtime
FROM node:24-alpine AS runtime

# Install runtime dependencies (OpenSSL for Prisma)
RUN apk add --no-cache openssl

WORKDIR /app

# Copy necessary files from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/start.sh ./start.sh
COPY --from=builder /app/scripts ./scripts
RUN chmod +x start.sh

# Set production environment
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["sh", "start.sh"]
