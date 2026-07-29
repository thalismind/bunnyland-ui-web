# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim@sha256:6c74791e557ce11fc957704f6d4fe134a7bc8d6f5ca4403205b2966bd488f6b3 AS build

WORKDIR /pkg

COPY package.json package-lock.json ./
RUN npm ci
RUN npm audit --audit-level=high

COPY README.md eslint.config.js tsconfig.json vite.config.ts vite.storybook.config.ts vitest.config.ts ./
COPY assets ./assets
COPY docs ./docs
COPY scripts ./scripts
COPY src ./src
COPY storybook ./storybook
COPY test ./test
RUN npm run check && npm run pack:artifact

FROM scratch

COPY --from=build /pkg/package.json /package.json
COPY --from=build /pkg/README.md /README.md
COPY --from=build /pkg/assets /assets
COPY --from=build /pkg/artifacts /artifacts
COPY --from=build /pkg/docs /docs
COPY --from=build /pkg/dist /dist
COPY --from=build /pkg/src /src
