# FoodChainIQ frontend — build the static app, serve it with nginx.
# nginx also proxies /api to the backend, so the browser sees one origin.

FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Same-origin API through the nginx proxy below.
ARG VITE_API_BASE=/api
ARG VITE_SHOW_DEMO_ACCOUNTS=false
ENV VITE_API_BASE=$VITE_API_BASE \
    VITE_SHOW_DEMO_ACCOUNTS=$VITE_SHOW_DEMO_ACCOUNTS
RUN npx vite build

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
