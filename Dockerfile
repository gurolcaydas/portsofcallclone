FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace package definitions
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install all dependencies (including devDependencies required for compilation)
RUN npm ci

# Copy entire source repository
COPY . .

# Build shared library, server, and client
RUN npm run build

# Runner stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Copy package manifests
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install production-only dependencies
RUN npm ci --omit=dev

# Copy built outputs
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

EXPOSE 3001

CMD ["npm", "start"]
