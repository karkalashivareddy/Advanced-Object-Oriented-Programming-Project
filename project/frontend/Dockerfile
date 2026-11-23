# syntax=docker/dockerfile:1
# Multi-stage build: Vite SPA built with Node 24, served by a small nginx runtime.
# The nginx runtime listens on 8080 and runs entirely as the unprivileged `nginx` user.

FROM node:24-alpine AS build
WORKDIR /app

# Renaming/copying after npm ci would re-introduce host node_modules, so install
# after the source copy. npm ci deletes any stale node_modules deterministically.
COPY package*.json ./
COPY . .
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm ci \
 && npm run build \
 && test -d dist

FROM nginx:1.27-alpine
LABEL org.opencontainers.image.title="LifeLink frontend" \
      org.opencontainers.image.description="Built LifeLink SPA served by nginx"

# Write a complete nginx config so we can drop root privileges: temp paths,
# pid file and the listen port are all usable by a non-root user.
RUN printf '%s\n' \
      'worker_processes auto;' \
      'pid /tmp/nginx.pid;' \
      '' \
      'events {' \
      '    worker_connections 1024;' \
      '}' \
      '' \
      'http {' \
      '    include /etc/nginx/mime.types;' \
      '    default_type application/octet-stream;' \
      '    sendfile on;' \
      '    keepalive_timeout 65;' \
      '    client_body_temp_path /tmp/nginx/client_body;' \
      '    proxy_temp_path /tmp/nginx/proxy;' \
      '    fastcgi_temp_path /tmp/nginx/fastcgi;' \
      '    uwsgi_temp_path /tmp/nginx/uwsgi;' \
      '    scgi_temp_path /tmp/nginx/scgi;' \
      '' \
      '    server {' \
      '        listen 8080;' \
      '        server_name _;' \
      '        root /usr/share/nginx/html;' \
      '        index index.html;' \
      '' \
      '        # SPA history fallback so client-side routes work on refresh.' \
      '        location / {' \
      '            try_files $uri $uri/ /index.html;' \
      '        }' \
      '' \
      '        # Same-origin API proxy; path prefix is preserved (/api/...).' \
      '        location /api/ {' \
      '            proxy_pass http://backend:8080;' \
      '            proxy_http_version 1.1;' \
      '            proxy_set_header Host $host;' \
      '            proxy_set_header X-Real-IP $remote_addr;' \
      '            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;' \
      '            proxy_set_header X-Forwarded-Proto $scheme;' \
      '        }' \
      '' \
      '        # Native WebSocket and SockJS fallback for live notifications.' \
      '        location /ws/ {' \
      '            proxy_pass http://backend:8080;' \
      '            proxy_http_version 1.1;' \
      '            proxy_set_header Upgrade $http_upgrade;' \
      '            proxy_set_header Connection "upgrade";' \
      '            proxy_set_header Host $host;' \
      '            proxy_set_header X-Real-IP $remote_addr;' \
      '            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;' \
      '            proxy_set_header X-Forwarded-Proto $scheme;' \
      '            proxy_read_timeout 300s;' \
      '        }' \
      '' \
      '        location /sockjs/ {' \
      '            proxy_pass http://backend:8080;' \
      '            proxy_http_version 1.1;' \
      '            proxy_set_header Host $host;' \
      '            proxy_set_header X-Real-IP $remote_addr;' \
      '            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;' \
      '            proxy_set_header X-Forwarded-Proto $scheme;' \
      '        }' \
      '' \
      '        location = /healthz {' \
      '            access_log off;' \
      '            add_header Content-Type text/plain;' \
      '            return 200 "ok\n";' \
      '        }' \
      '    }' \
      '}' \
      > /etc/nginx/nginx.conf \
  && rm -f /etc/nginx/conf.d/default.conf \
  && mkdir -p /tmp/nginx \
  && chown -R nginx:nginx /tmp/nginx

COPY --from=build --chown=nginx:nginx /app/dist/ /usr/share/nginx/html/

USER nginx
EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
