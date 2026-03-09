FROM node:23-alpine

# Install bun
RUN npm install -g bun

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY bun.lock* ./

# Copy scripts directory, logo, and avatar for postinstall script
COPY scripts/ ./scripts/
COPY alice-logo.png ./
COPY alice-avatar.png ./

# Install dependencies
RUN bun install

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Ensure Alice logo and avatar are in the correct location for serving
RUN cp alice-logo.png node_modules/@elizaos/server/dist/client/ || true
RUN cp alice-avatar.png node_modules/@elizaos/server/dist/client/ || true

# Expose port (Railway will set PORT env var)
EXPOSE $PORT

# Start the application
CMD ["bun", "start"]
