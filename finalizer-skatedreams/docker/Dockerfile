# syntax=docker/dockerfile:1.7

FROM python:3.12-slim AS builder
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy

RUN pip install --no-cache-dir uv

WORKDIR /build
COPY pyproject.toml ./
COPY src ./src

RUN uv venv /opt/venv && \
    VIRTUAL_ENV=/opt/venv uv pip install --no-cache .

FROM python:3.12-slim AS runner
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PATH=/opt/venv/bin:$PATH

WORKDIR /app
COPY --from=builder /opt/venv /opt/venv
COPY src /app/src
COPY docker/entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh && \
    useradd --create-home --uid 1000 finalizer && \
    chown -R finalizer:finalizer /app
USER finalizer

ENV PYTHONPATH=/app/src
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health').read()" || exit 1

CMD ["/app/entrypoint.sh"]
