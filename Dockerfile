# Stage 1: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Add build-time arguments for environment variables
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

# Install build dependencies (required for some node modules and Prisma)
RUN apk add --no-cache python3 make g++ openssl

# Copy package files and prisma schema first to leverage Docker cache
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies)
RUN npm install

# Copy source code and build the application
COPY . .
RUN npx prisma generate
RUN npm run build

# Prune development dependencies to keep the image slim
RUN npm prune --production

# Stage 2: Runtime
FROM node:20-alpine AS runtime
WORKDIR /app

# Install runtime dependencies (OpenSSL is required by Prisma)
RUN apk add --no-cache openssl

# Copy only the necessary files from the builder stage
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Expose the application port (NestJS default is 3000, but set to 3001 here)
EXPOSE 3001

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Start the application using the production script
CMD ["npm", "run", "start:prod"]
