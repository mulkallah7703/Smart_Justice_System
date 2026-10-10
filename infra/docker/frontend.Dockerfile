# Frontend static assets — production image
# Build from repository root:
#   docker build -f infra/docker/frontend.Dockerfile \
#     --build-arg VITE_API_BASE_URL=https://app.example.com/api/v1 \
#     --build-arg VITE_API_MODE=real \
#     -t sjs-frontend:local .
#
# Production MUST use VITE_API_MODE=real and a non-localhost API URL.
# Mock mode is rejected by the frontend production assert.

FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./

ARG VITE_API_MODE=real
ARG VITE_API_BASE_URL
ENV VITE_API_MODE=${VITE_API_MODE} \
    VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN if [ -z "${VITE_API_BASE_URL}" ]; then \
      echo "ERROR: VITE_API_BASE_URL build-arg is required for production frontend builds"; \
      exit 1; \
    fi \
  && if [ "${VITE_API_MODE}" != "real" ]; then \
      echo "ERROR: VITE_API_MODE must be real for production frontend builds"; \
      exit 1; \
    fi \
  && npm run build

FROM nginx:1.27-alpine AS runtime
COPY infra/nginx/frontend-static.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
