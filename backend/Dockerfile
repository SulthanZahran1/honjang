FROM python:3.11-slim

WORKDIR /app

# Install system deps for Silero VAD (torch needs some libs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy project files
COPY pyproject.toml ./
COPY app/ ./app/
COPY static/ ./static/

# Install dependencies
RUN pip install --no-cache-dir -e ".[dev]"

# Expose port
EXPOSE 8000

# Run with uvicorn + uvloop for best WS performance
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--loop", "uvloop", "--http", "httptools"]