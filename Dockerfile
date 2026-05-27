# Use official Node.js image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install all dependencies (including devDependencies needed for the build phase)
RUN npm install

# Copy application source code
COPY . .

# Build the client app and compile the server.ts file
RUN npm run build

# Set production environment variable
ENV NODE_ENV=production

# Expose port 3000 which is the entry point
EXPOSE 3000

# Start server
CMD ["npm", "start"]
