# Rindexer Dockerfile for Raffle Event Indexing
# Updated: 2025-06-26
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy indexer configuration
COPY . .

# Create data directory
RUN mkdir -p data

# Expose port if needed
EXPOSE 3001

# Start the indexer
CMD ["npm", "start"]