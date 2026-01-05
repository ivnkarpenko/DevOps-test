FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# system deps (для uvicorn[standard] иногда нужны build tools; здесь без фанатизма)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

# non-root
RUN useradd -m appuser
USER appuser

EXPOSE 8000

# health endpoint есть (/health)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
