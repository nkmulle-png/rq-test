# Use the official Node.js 22 Alpine base image
FROM node:22-alpine

# Set the working directory inside the container
WORKDIR /app

# Best Practice: Copy package files first to leverage Docker layer caching
COPY package*.json ./

# Install dependencies from the standard public npm registry
RUN npm install

# Copy the rest of the application source code
COPY . .

# Run your build step (e.g., transpiling TypeScript or packing assets)
RUN npm run build

# Start the application directly without the ikenv wrapper
CMD ["node", "app.js"]