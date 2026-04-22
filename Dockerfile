# Base image
FROM node:20-alpine AS builder

# Create app directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ openssl

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Build the project
COPY . .
RUN npm run build

# --- Runtime Stage ---
FROM node:20-alpine AS runtime

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache openssl

# Copy only necessary files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Expose the port
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production

# Start the application
CMD ["npm", "run", "start:prod"]
