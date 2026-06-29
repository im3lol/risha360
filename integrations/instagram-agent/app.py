"""
Risha 360 — Instagram Agent (stealth browser discovery + rich profile data).

Drives a hardened Camoufox (anti-fingerprint Firefox) browser like a human to:
  1. Discover candidate usernames — via Instagram's own top-search when an
     authenticated session is supplied, otherwise via a public search engine.
  2. Fetch each profile's *rich* data by calling Instagram's internal web API
     (`/api/v1/users/web_profile_info/`) from inside the page context — this
     returns followers/following/posts AND recent-post like/comment counts, so
     we can compute a REAL engagement rate (not the conservative fallback).

Anti-block measures (all configurable via env):
  - Camoufox stealth fingerprint + optional geoip alignment to the proxy.
  - Residential/mobile proxy (IG_PROXY) — the single biggest factor.
  - Authenticated session reuse (IG_STORAGE_STATE / IG_COOKIES).
  - Human pacing: randomized delays, per-run profile caps.

This is best-effort and intended for authorized lead-gen on burner accounts —
never the main brand account. No paid API; the browser is self-hosted.
"""

from __future__ import annotations

import asyncio
import json
import os
import random
import re
from statistics import mean
from urllib.parse import quote

from camoufox.async_api import AsyncCamoufox
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Reesha Instagram Agent", version="1.0.0")

IG_APP_ID = "936619743392459"  # public Instagram web app id
EMAIL_RE = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I)
USERNAME_RE = re.compile(r"instagram\.com(?:/|%2[fF])([A-Za-z0-9._]+)", re.I)
RESERVED = {
    "p", "reel", "reels", "explore", "stories", "tv", "accounts", "about",
    "developer", "directory", "legal", "privacy", "web", "graphql", "api", "s",
}

MAX_PROFILES = int(os.getenv("IG_MAX_PROFILES", "30"))
MIN_DELAY = float(os.getenv("IG_MIN_DELAY", "3"))
MAX_DELAY = float(os.getenv("IG_MAX_DELAY", "7"))
NAV_TIMEOUT = int(os.getenv("IG_NAV_TIMEOUT_MS", "45000"))

SEARCH_ENGINES = [
    lambda q: f"https://www.bing.com/search?q={quote('site:instagram.com ' + q)}",
    lambda q: f"https://html.duckduckgo.com/html/?q={quote('site:instagram.com ' + q)}",
]

# In-page fetch of Instagram's internal profile API (carries session cookies).
PROFILE_JS = """
async (username) => {
  try {
    const res = await fetch(
      `/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
      { headers: { 'x-ig-app-id': '%s' }, credentials: 'include' }
    );
    if (!res.ok) return { __error: res.status };
    return await res.json();
  } catch (e) { return { __error: String(e) }; }
}
""" % IG_APP_ID

# Fallback: recent-posts feed to compute a REAL engagement rate when
# web_profile_info didn't include recent-media like/comment counts.
FEED_JS = """
async (userId) => {
  try {
    const res = await fetch(
      `/api/v1/feed/user/${userId}/?count=12`,
      { headers: { 'x-ig-app-id': '%s' }, credentials: 'include' }
    );
    if (!res.ok) return { __error: res.status };
    return await res.json();
  } catch (e) { return { __error: String(e) }; }
}
""" % IG_APP_ID

# In-page fetch of Instagram's blended top-search (needs an authenticated session).
TOPSEARCH_JS = """
async (query) => {
  try {
    const res = await fetch(
      `/web/search/topsearch/?context=blended&query=${encodeURIComponent(query)}`,
      { headers: { 'x-ig-app-id': '%s' }, credentials: 'include' }
    );
    if (!res.ok) return { __error: res.status };
    return await res.json();
  } catch (e) { return { __error: String(e) }; }
}
""" % IG_APP_ID


# NOTE: Instagram disabled the similar-accounts graph (/discover/chaining → 400),
# so the chaining/seed helpers were removed. Discovery now ranks by verified
# accounts from top-search instead (see _discover).


# In-page fetch of a hashtag's top posts (trend-driven discovery).
HASHTAG_JS = """
async (tag) => {
  try {
    const res = await fetch(
      `/api/v1/tags/web_info/?tag_name=${encodeURIComponent(tag)}`,
      { headers: { 'x-ig-app-id': '%s' }, credentials: 'include' }
    );
    if (!res.ok) return { __error: res.status };
    return await res.json();
  } catch (e) { return { __error: String(e) }; }
}
""" % IG_APP_ID


class RunRequest(BaseModel):
    queries: list[str]
    hashtags: list[str] = []
    limit: int = MAX_PROFILES
    min_followers: int = 0
    personal_only: bool = True


def _has_session() -> bool:
    state = os.getenv("IG_STORAGE_STATE")
    return bool((state and os.path.exists(state)) or os.getenv("IG_COOKIES"))


def _proxy_config():
    url = os.getenv("IG_PROXY")
    if not url:
        return None
    # Accept full "http://user:pass@host:port" or a bare "host:port".
    m = re.match(r"^(?:(\w+)://)?(?:([^:@/]+):([^@/]+)@)?([^:@/]+:\d+)$", url)
    if not m:
        return {"server": url}
    scheme, user, pw, hostport = m.groups()
    cfg = {"server": f"{scheme or 'http'}://{hostport}"}
    if user:
        cfg["username"] = user
        cfg["password"] = pw
    return cfg


async def _human_pause():
    await asyncio.sleep(random.uniform(MIN_DELAY, MAX_DELAY))


def _extract_usernames(html: str) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for m in USERNAME_RE.finditer(html or ""):
        u = m.group(1).lower()
        if u in seen or u in RESERVED or len(u) < 2:
            continue
        seen.add(u)
        out.append(u)
    return out


def _hashtag_usernames(data: dict) -> list[str]:
    out: list[str] = []
    d = (data or {}).get("data", {})
    for bucket in (d.get("top"), d.get("recent")):
        if not bucket:
            continue
        for section in bucket.get("sections", []) or []:
            medias = (section.get("layout_content") or {}).get("medias", []) or []
            for m in medias:
                u = (((m.get("media") or {}).get("user")) or {}).get("username")
                if u:
                    out.append(u)
    return out


def _parse_user(payload: dict) -> dict | None:
    user = (payload or {}).get("data", {}).get("user")
    if not user:
        return None

    followers = (user.get("edge_followed_by") or {}).get("count", 0)
    following = (user.get("edge_follow") or {}).get("count", 0)
    posts = (user.get("edge_owner_to_timeline_media") or {}).get("count", 0)
    edges = (user.get("edge_owner_to_timeline_media") or {}).get("edges", []) or []

    likes, comments, post_images, captions = [], [], [], []
    for e in edges:
        node = e.get("node", {})
        lc = (node.get("edge_liked_by") or node.get("edge_media_preview_like") or {}).get("count")
        cc = (node.get("edge_media_to_comment") or {}).get("count")
        if isinstance(lc, int):
            likes.append(lc)
        if isinstance(cc, int):
            comments.append(cc)
        img = node.get("display_url") or node.get("thumbnail_src")
        if img and len(post_images) < 3:
            post_images.append(img)
        cap_edges = (node.get("edge_media_to_caption") or {}).get("edges") or []
        if cap_edges:
            txt = (cap_edges[0].get("node") or {}).get("text")
            if txt and len(captions) < 6:
                captions.append(str(txt)[:200])

    avg_likes = round(mean(likes)) if likes else None
    avg_comments = round(mean(comments)) if comments else None
    engagement_rate = None
    if followers and (avg_likes is not None or avg_comments is not None):
        engagement_rate = round(((avg_likes or 0) + (avg_comments or 0)) / followers * 100, 3)

    bio = user.get("biography") or ""
    email = None
    be = user.get("business_email")
    if be:
        email = be
    else:
        m = EMAIL_RE.search(bio)
        if m:
            email = m.group(0)

    return {
        "username": user.get("username"),
        "full_name": user.get("full_name") or user.get("username"),
        "biography": bio,
        "followers": followers,
        "following": following,
        "posts": posts,
        "is_verified": bool(user.get("is_verified")),
        "is_private": bool(user.get("is_private")),
        "is_business": bool(user.get("is_business_account")),
        "category": user.get("category")
        or user.get("category_name")
        or user.get("business_category_name")
        or "",
        "website": user.get("external_url"),
        "profile_pic_url": user.get("profile_pic_url_hd") or user.get("profile_pic_url"),
        "email": email,
        "avg_likes": avg_likes,
        "avg_comments": avg_comments,
        "engagement_rate": engagement_rate,
        "posts_sampled": len(likes),
        "post_images": post_images,
        "captions": captions,
    }


async def _enrich_engagement(page, parsed: dict, user_id) -> None:
    """Fill avg_likes/avg_comments/engagement_rate from the recent feed."""
    try:
        feed = await page.evaluate(FEED_JS, str(user_id))
        items = (feed or {}).get("items", []) if isinstance(feed, dict) else []
        likes = [i.get("like_count") for i in items if isinstance(i.get("like_count"), int) and i.get("like_count") >= 0]
        comments = [i.get("comment_count") for i in items if isinstance(i.get("comment_count"), int) and i.get("comment_count") >= 0]
        if not likes:
            return
        parsed["avg_likes"] = round(mean(likes))
        parsed["avg_comments"] = round(mean(comments)) if comments else parsed.get("avg_comments")
        parsed["posts_sampled"] = len(likes)
        followers = parsed.get("followers") or 0
        if followers:
            parsed["engagement_rate"] = round(
                ((parsed["avg_likes"] or 0) + (parsed.get("avg_comments") or 0)) / followers * 100, 3
            )
    except Exception:
        pass


# Keep only individual creators/influencers (personal leads), not companies/pages.
BUSINESS_CAT_RE = re.compile(
    r"shop|store|retail|brand|compan|business|restaurant|cafe|café|market|grocer|commerce|"
    r"agency|clinic|hospital|hotel|news|magazine|media|publish|website|software|service|product|"
    r"jewel|furnitur|real estate|automotive|organi[sz]ation|government|school|universit|academy|"
    r"gym|fitness center|salon|spa|boutique|wholesale|trading|factory|pharmac",
    re.I,
)
PERSON_CAT_RE = re.compile(
    r"creator|public figure|blogger|influencer|artist|musician|actor|model|author|photographer|"
    r"personal blog|comedian|athlete|chef|coach|entrepreneur|video creator|content",
    re.I,
)
# "official" is intentionally excluded — verified celebrities use it. Aligned
# with the curated server-side list in src/lib/discovery/is-person.ts.
BUSINESS_NAME_RE = re.compile(
    r"\b(store|shop|company|llc|wholesale|trading|factory|boutique|agency|restaurant|restaurants)\b", re.I
)


def _is_personal_account(p: dict) -> bool:
    cat = (p.get("category") or "").lower()
    if cat:
        if PERSON_CAT_RE.search(cat):
            return True
        if BUSINESS_CAT_RE.search(cat):
            return False
    text = f"{p.get('full_name') or ''} {p.get('username') or ''} {p.get('biography') or ''}"
    if BUSINESS_NAME_RE.search(text):
        return False
    if p.get("is_business") and not PERSON_CAT_RE.search(cat):
        return False
    return True


async def _new_context(browser):
    cookies_env = os.getenv("IG_COOKIES")
    state = os.getenv("IG_STORAGE_STATE")
    if state and os.path.exists(state):
        context = await browser.new_context(storage_state=state)
    else:
        context = await browser.new_context()
    if cookies_env:
        try:
            await context.add_cookies(json.loads(cookies_env))
        except Exception:
            pass
    return context


async def _topsearch_users(page, query: str) -> list[dict]:
    data = await page.evaluate(TOPSEARCH_JS, query)
    users = (data or {}).get("users") if isinstance(data, dict) else None
    out: list[dict] = []
    for u in users or []:
        usr = (u or {}).get("user") or {}
        un = usr.get("username")
        if un:
            out.append({"username": un, "pk": usr.get("pk") or usr.get("id"), "verified": bool(usr.get("is_verified"))})
    return out


def _dedupe(names: list[str]) -> list[str]:
    seen, out = set(), []
    for n in names:
        nl = str(n).lower()
        if nl and nl not in seen and nl not in RESERVED:
            seen.add(nl)
            out.append(nl)
    return out


async def _discover(page, query: str, authenticated: bool, verified_only: bool = False) -> list[str]:
    # Verified-first discovery via Instagram's own top-search. Verified Saudi
    # accounts are overwhelmingly REAL public figures/creators (celebrities,
    # artists, actors, athletes) — exactly the target — whereas keyword matches
    # are often brand/shop accounts. NOTE: Instagram disabled the similar-
    # accounts graph (/discover/chaining → 400), so we rank by verified instead
    # of snowballing. Falls back to search engines if logged out.
    #
    # When authenticated the caller has already navigated to instagram.com once;
    # top-search is a same-origin fetch, so we do NOT navigate per query (each
    # extra navigation risks crashing the Firefox driver on an IG page error).
    if authenticated:
        found = await _topsearch_users(page, query)
        if found:
            verified = [u["username"] for u in found if u["verified"]]
            others = [u["username"] for u in found if not u["verified"]]
            ordered = _dedupe(verified if verified_only else verified + others)
            if ordered:
                return ordered
        return []

    for engine in SEARCH_ENGINES:
        try:
            await page.goto(engine(query), wait_until="domcontentloaded", timeout=NAV_TIMEOUT)
            html = await page.content()
            names = _extract_usernames(html)
            if names:
                return names
        except Exception:
            continue
    return []


@app.get("/health")
def health():
    return {
        "status": "ok",
        "provider": "instagram-agent",
        "proxy": bool(os.getenv("IG_PROXY")),
        "authenticated": _has_session(),
    }


@app.post("/run")
async def run(req: RunRequest):
    if not req.queries:
        raise HTTPException(status_code=400, detail="queries is required")

    authenticated = _has_session()
    limit = min(max(req.limit, 1), MAX_PROFILES)
    launch_kwargs: dict = {"headless": True, "humanize": True, "geoip": True}
    proxy = _proxy_config()
    if proxy:
        launch_kwargs["proxy"] = proxy

    candidates: list[dict] = []
    seen: set[str] = set()

    try:
        async with AsyncCamoufox(**launch_kwargs) as browser:
            context = await _new_context(browser)
            page = await context.new_page()
            page.set_default_timeout(NAV_TIMEOUT)

            # Navigate to the Instagram origin ONCE. Every subsequent call
            # (top-search, profile info, hashtags) is a same-origin in-page
            # fetch — no further navigation — which avoids loading pages that
            # throw uncaught JS errors and crash the Firefox driver.
            if authenticated:
                await page.goto(
                    "https://www.instagram.com/", wait_until="domcontentloaded", timeout=NAV_TIMEOUT
                )

            usernames: list[str] = []

            # 1) Discover usernames across queries. Keep VERIFIED accounts first,
            #    then non-verified ones too (more real micro-creators per name) —
            #    the per-profile personal-account filter below removes brands/shops.
            #    (verified-only was too strict and dried up once famous names were
            #    already saved; this surfaces NEW people from each search.)
            for query in req.queries:
                for name in await _discover(page, query, authenticated, verified_only=False):
                    nl = name.lower()
                    if nl in seen or nl in RESERVED:
                        continue
                    seen.add(nl)
                    usernames.append(nl)
                if len(usernames) >= limit * 2:
                    break
                await _human_pause()

            # 1b) Hashtag top-posts (trend-driven), only useful with a session.
            #     Already on the IG origin — fetch directly, no navigation.
            if authenticated and req.hashtags and len(usernames) < limit * 2:
                for tag in req.hashtags:
                    if len(usernames) >= limit * 2:
                        break
                    try:
                        data = await page.evaluate(HASHTAG_JS, tag.lstrip("#"))
                        for name in _hashtag_usernames(data if isinstance(data, dict) else {}):
                            nl = name.lower()
                            if nl in seen or nl in RESERVED:
                                continue
                            seen.add(nl)
                            usernames.append(nl)
                    except Exception:
                        pass
                    await _human_pause()

            # 2) Fetch rich profile data via Instagram's internal API, called
            #    from the instagram.com origin WITHOUT navigating to each profile
            #    page. This (a) avoids loading profile pages that throw uncaught
            #    JS errors and crash the Firefox driver, and (b) is far faster.
            #    Same approach the browser extension uses (same-origin fetch).
            for username in usernames[:limit]:
                try:
                    payload = await page.evaluate(PROFILE_JS, username)
                    parsed = _parse_user(payload) if isinstance(payload, dict) else None
                    if (
                        parsed
                        and parsed["followers"] >= req.min_followers
                        and not parsed.get("is_private")
                        and (not req.personal_only or _is_personal_account(parsed))
                    ):
                        # Real engagement: if web_profile_info had no recent-media
                        # counts, pull the recent feed and compute avg likes/comments.
                        if parsed.get("avg_likes") is None:
                            uid = (((payload or {}).get("data") or {}).get("user") or {}).get("id")
                            if uid:
                                await _enrich_engagement(page, parsed, uid)
                        candidates.append(parsed)
                except Exception:
                    pass
                await _human_pause()

            await context.close()
    except Exception as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    return {"count": len(candidates), "authenticated": authenticated, "candidates": candidates}
