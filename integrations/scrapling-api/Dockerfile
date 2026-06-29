FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY vendor/scrapling /opt/scrapling
RUN pip install --no-cache-dir "/opt/scrapling[fetchers]" fastapi uvicorn

COPY scrapling-api/app.py /app/app.py

EXPOSE 8011
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8011"]
