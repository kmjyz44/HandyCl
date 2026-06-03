FROM python:3.11-slim

# Ensure Python output is not buffered (so prints appear in logs immediately)
ENV PYTHONUNBUFFERED=1

# Cache bust + version metadata. Bump CACHE_BUST manually if Railway gets stuck on an old layer.
ARG CACHE_BUST=2026-02-12-stripe-notifs
ARG BUILD_SHA=local
ARG BUILD_TIME=unknown
ENV BUILD_VERSION="2026-02-12-stripe-notifs"
ENV BUILD_SHA=${BUILD_SHA}
ENV BUILD_TIME=${BUILD_TIME}

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# CACHE_BUST forces this layer (and everything after) to rebuild whenever it changes
RUN echo "build ${CACHE_BUST} sha=${BUILD_SHA}" > /app/.build-info

COPY . .
CMD uvicorn server:app --host 0.0.0.0 --port $PORT
