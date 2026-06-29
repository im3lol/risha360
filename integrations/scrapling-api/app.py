import ipaddress
import re
import socket
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, HttpUrl
from scrapling.fetchers import Fetcher

app = FastAPI(title="Reesha Scrapling API", version="1.0.0")
EMAIL_PATTERN = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I)


class ExtractRequest(BaseModel):
    url: HttpUrl


@app.get("/health")
def health():
    return {"status": "ok", "provider": "scrapling"}


@app.post("/extract")
def extract(request: ExtractRequest):
    url = str(request.url)
    ensure_public_url(url)

    try:
        page = Fetcher.get(
            url,
            stealthy_headers=True,
            impersonate="chrome",
            timeout=20,
        )
        text = str(page.get_all_text(separator=" ", strip=True))[:100_000]
        emails = list(dict.fromkeys(EMAIL_PATTERN.findall(text)))[:10]
        return {
            "url": url,
            "status": page.status,
            "text": text,
            "emails": emails,
        }
    except Exception as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


def ensure_public_url(url: str):
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise HTTPException(status_code=400, detail="Only public HTTP(S) URLs are allowed")

    try:
        addresses = socket.getaddrinfo(parsed.hostname, None)
    except socket.gaierror as error:
        raise HTTPException(status_code=400, detail="Hostname could not be resolved") from error

    for address in addresses:
        ip = ipaddress.ip_address(address[4][0])
        if not ip.is_global:
            raise HTTPException(status_code=400, detail="Private network targets are blocked")
