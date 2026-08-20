FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN chmod +x yt-dlp || true

ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "python app.py ${PORT:-8000}"]
