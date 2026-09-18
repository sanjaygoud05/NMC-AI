# Production Dockerfile for NMC-AI FastAPI Backend & Data Pipeline
FROM python:3.11-slim

WORKDIR /app

# Install system build dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY server/requirements.txt ./server/requirements.txt
RUN pip install --no-cache-dir -r server/requirements.txt

# Copy server code, baseline dataset, and config
COPY server/ ./server/
COPY data/ ./data/

# Environment configuration
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app/server:/app
ENV PORT=10000
ENV DATA_DIR=/app/data

EXPOSE 10000
EXPOSE 8000

# Start Uvicorn adapting dynamically to Render's or cloud provider's $PORT
CMD ["sh", "-c", "uvicorn app.main:app --app-dir server --host 0.0.0.0 --port ${PORT:-10000}"]
