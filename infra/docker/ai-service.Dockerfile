# Deprecated — Python ai-service is not part of the runtime.
# Use infra/docker/worker.Dockerfile for the NestJS AI Worker.
FROM alpine:3.20
RUN echo "ERROR: ai-service.Dockerfile is deprecated. Build worker.Dockerfile instead." >&2 \
  && exit 1
