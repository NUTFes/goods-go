# syntax=docker.io/docker/dockerfile:1

FROM node:24-alpine

WORKDIR /app

COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* .npmrc* ./

RUN npm install -g pnpm && pnpm i

COPY src ./src
COPY public ./public
COPY next.config.ts .
COPY tsconfig.json .
COPY postcss.config.mjs .

ENV NEXT_TELEMETRY_DISABLED=1

CMD ["pnpm", "dev", "-H", "0.0.0.0"]
