FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    HOME=/tmp/aiautoslides-home

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       libreoffice-impress \
       poppler-utils \
       fonts-liberation \
       fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run deps

CMD ["npm", "run", "check"]
