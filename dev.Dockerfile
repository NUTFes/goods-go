# syntax=docker.io/docker/dockerfile:1

FROM node:24.13.0-alpine

WORKDIR /app

COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* .npmrc* ./

RUN npm install -g pnpm@10.28.1 && pnpm install --frozen-lockfile

COPY src ./src
COPY public ./public
COPY next.config.ts .
COPY tsconfig.json .
COPY postcss.config.mjs .

ENV NEXT_TELEMETRY_DISABLED=1

CMD ["pnpm", "dev", "-H", "0.0.0.0"]
