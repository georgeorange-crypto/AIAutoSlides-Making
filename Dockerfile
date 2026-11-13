FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
LABEL org.opencontainers.image.source="https://github.com/georgeorange-crypto/AIAutoSlides-Making"
LABEL org.opencontainers.image.description="AIAutoSlides local CLI container; no service endpoint is exposed."
WORKDIR /app
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./package.json
COPY --chown=node:node src ./src
COPY --chown=node:node themes ./themes
COPY --chown=node:node examples/research-demo.json ./examples/research-demo.json
USER node
WORKDIR /work
ENTRYPOINT ["node", "/app/src/cli.mjs"]
