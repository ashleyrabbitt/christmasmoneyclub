FROM node:24-alpine AS build
WORKDIR /app
COPY package.json site-config.mjs build.mjs check.mjs check-server.mjs server.mjs ./
COPY content ./content
COPY public ./public
RUN npm run build && npm run check && npm run check:server

FROM node:24-alpine
ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json site-config.mjs server.mjs ./
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
