# Dockerfile for Express.js API
FROM node:24-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx tsc

FROM node:24-slim AS runner
WORKDIR /app

# Install netcat
RUN apt-get update && \
    apt-get install -y --no-install-recommends netcat-openbsd && \
    rm -rf /var/lib/apt/lists/*
    
# Copy only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy compiled code and assets from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/assets ./assets

# Create wait-for script
RUN echo '#!/bin/sh' > /wait-for.sh && \
    echo 'set -e' >> /wait-for.sh && \
    echo 'host="$1"' >> /wait-for.sh && \
    echo 'shift' >> /wait-for.sh && \
    echo 'until nc -z "$host" 3306; do' >> /wait-for.sh && \
    echo '  echo "Waiting for MySQL at $host:3306..."' >> /wait-for.sh && \
    echo '  sleep 2' >> /wait-for.sh && \
    echo 'done' >> /wait-for.sh && \
    echo 'echo "MySQL is up - starting application"' >> /wait-for.sh && \
    echo 'exec "$@"' >> /wait-for.sh && \
    chmod +x /wait-for.sh

ENV NODE_ENV=production    
EXPOSE 4000
ENTRYPOINT ["/wait-for.sh", "mysql"]
CMD ["node", "dist/index.js"]