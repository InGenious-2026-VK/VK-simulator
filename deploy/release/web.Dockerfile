# Web image for a *release* deployed under a path prefix (e.g. /v010/).
# Builds the frontend of whatever tag is checked out in the build context,
# so it also works for tags whose own Dockerfile has no base-path argument.

FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# BASE_PATH: where the release lives, with slashes, e.g. /v010/
ARG BASE_PATH=/
ARG VITE_SHOW_DEMO_ACCOUNTS=false
ENV VITE_BASE=$BASE_PATH \
    VITE_API_BASE=${BASE_PATH}api \
    VITE_SHOW_DEMO_ACCOUNTS=$VITE_SHOW_DEMO_ACCOUNTS
RUN npx vite build

FROM nginx:1.27-alpine
# The reverse proxy strips the prefix, so nginx serves the app at / as usual.
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
