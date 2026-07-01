# MB Chatters — single container that builds the frontend and runs the server.
FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV PORT=8787
EXPOSE 8787
CMD ["node", "server/server.mjs"]
