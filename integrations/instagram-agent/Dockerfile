FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY instagram-agent/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Install the OS libraries Firefox/Camoufox needs (via Playwright's helper),
# then fetch the Camoufox browser binary.
RUN playwright install-deps firefox \
    && python -m camoufox fetch

COPY instagram-agent/app.py /app/app.py

EXPOSE 8013
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8013/health')"

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8013"]
