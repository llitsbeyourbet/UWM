FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY moderation_api.py .
COPY tokenizer.json .

ENV PORT=8080

EXPOSE 8080

CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT} --workers 1 --timeout 180 moderation_api:app"]