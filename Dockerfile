# Use Node.js 18
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy server source
COPY server/ ./server/

# Expose API port (uses PORT env or defaults to 5000)
EXPOSE 5000

# Start server
CMD ["npm", "start"]



