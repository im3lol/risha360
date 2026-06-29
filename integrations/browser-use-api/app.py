import ipaddress
import os
import socket
from urllib.parse import urlparse

from browser_use import Agent, ChatGoogle
from browser_use.browser import BrowserProfile, BrowserSession
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, HttpUrl

app = FastAPI(title="Reesha Browser-use API", version="1.0.0")


class ExtractRequest(BaseModel):
    url: HttpUrl


@app.get("/health")
def health():
    return {
        "status": "ok",
        "provider": "browser-use",
        "llm_configured": bool(os.getenv("GEMINI_API_KEY")),
    }


@app.post("/extract")
async def extract(request: ExtractRequest):
    if not os.getenv("GEMINI_API_KEY"):
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY is required")

    url = str(request.url)
    hostname = ensure_public_url(url)
    profile = BrowserProfile(
        headless=True,
        allowed_domains=[hostname, f"*.{hostname}"],
        keep_alive=False,
    )
    browser = BrowserSession(browser_profile=profile)

    try:
        agent = Agent(
            task=(
                f"Open {url}. Extract only publicly visible business contact details, "
                "a concise description, and any public email address. Do not submit "
                "forms, log in, accept permissions, or navigate outside this domain."
            ),
            llm=ChatGoogle(
                model=os.getenv("BROWSER_USE_MODEL", "gemini-2.0-flash"),
                api_key=os.getenv("GEMINI_API_KEY"),
            ),
            browser_session=browser,
            use_vision=False,
        )
        history = await agent.run(max_steps=8)
        return {
            "url": url,
            "text": history.final_result() or "",
        }
    except Exception as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    finally:
        await browser.kill()


def ensure_public_url(url: str) -> str:
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

    return parsed.hostname
