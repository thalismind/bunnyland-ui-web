# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS build

WORKDIR /pkg

COPY package.json package-lock.json ./
RUN npm ci

COPY README.md eslint.config.js tsconfig.json vite.config.ts ./
COPY assets ./assets
COPY src ./src
COPY test ./test
RUN npm run check

FROM scratch

COPY --from=build /pkg/package.json /package.json
COPY --from=build /pkg/README.md /README.md
COPY --from=build /pkg/assets /assets
COPY --from=build /pkg/dist /dist
COPY --from=build /pkg/src /src
