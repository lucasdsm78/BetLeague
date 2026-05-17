# syntax=docker/dockerfile:1.7

FROM node:18-alpine AS build
WORKDIR /app
ARG REACT_APP_SITE_URL=https://app.betleague.app
ARG APP_FRONTEND_URL=https://app.betleague.app
ARG SITE_URL=https://app.betleague.app
ENV REACT_APP_SITE_URL=$REACT_APP_SITE_URL
ENV APP_FRONTEND_URL=$APP_FRONTEND_URL
ENV SITE_URL=$SITE_URL
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked npm ci --no-audit --prefer-offline
COPY . .
RUN npm run build && npm cache clean --force

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
