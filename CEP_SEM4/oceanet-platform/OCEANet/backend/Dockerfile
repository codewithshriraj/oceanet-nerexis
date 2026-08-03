# OCEANet Backend - Production-Grade Dockerfile
# Multi-stage build to minimize image size
# Final image: ~200MB

# ============================================================================
# Stage 1: Builder
# ============================================================================
FROM python:3.12-slim as builder

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Create Python wheels for faster installation
RUN pip install --user --no-cache-dir --no-warn-script-location \
    pip==24.0 \
    setuptools==69.0 \
    wheel==0.42.0 && \
    mkdir -p /wheels && \
    pip wheel --no-cache-dir \
    -r requirements.txt \
    -w /wheels

# ============================================================================
# Stage 2: Runtime
# ============================================================================
FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH=/home/oceanet/.local/bin:$PATH \
    OCEANET_ENV=production

# Create non-root user
RUN useradd -m -u 1000 oceanet

WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy Python wheels and requirements from builder
COPY --from=builder /wheels /wheels
COPY --from=builder /build/requirements.txt ./requirements.txt

# Install wheel packages
RUN pip install --no-index --find-links /wheels \
    -r requirements.txt

# Copy application code
COPY --chown=oceanet:oceanet . .

# Create required directories
RUN mkdir -p /app/data /app/logs && \
    chown -R oceanet:oceanet /app

# Switch to non-root user
USER oceanet

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Expose port
EXPOSE 8000

# Run migrations and start server
CMD ["sh", "-c", "alembic upgrade head && gunicorn app.main:app -c gunicorn_conf.py --bind 0.0.0.0:8000"]
