FROM python:3.11-slim

# Ensure Python output is not buffered (so prints appear in logs immediately)
ENV PYTHONUNBUFFERED=1

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD uvicorn server:app --host 0.0.0.0 --port $PORT
