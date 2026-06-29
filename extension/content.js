/*
 * Risha 360 Harvester — content script (runs on instagram.com).
 *
 * Uses YOUR real, logged-in session to call Instagram's own internal web API
 * (same-origin fetch with cookies). It does NOT click, scroll, type, navigate,
 * or modify the page — it only makes the same background API requests the
 * Instagram web app itself makes. Your session is never touched (read-only).
 *
 * Note: the harvest runs inside this page, so keep this Instagram tab open and
 * don't navigate it while a harvest is running.
 */
;(() => {
  const IG_APP_ID = '936619743392459'
  const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const rand = (lo, hi) => Math.floor(lo + Math.random() * (hi - lo))
  const send = (m) => {
    try {
      chrome.runtime.sendMessage(m).catch(() => {})
    } catch (e) {
      void e
    }
  }
  const report = (data) => send({ type: 'HARVEST_PROGRESS', ...data })

  let harvesting = false

  async function igFetch(path) {
    try {
      const res = await fetch(path, {
        headers: { 'x-ig-app-id': IG_APP_ID },
        credentials: 'include',
      })
      if (!res.ok) return { __error: res.status }
      return await res.json()
    } catch (e) {
      return { __error: String(e) }
    }
  }

  async function topSearch(query) {
    const d = await igFetch(
      `/web/search/topsearch/?context=blended&query=${encodeURIComponent(query)}`
    )
    if (d && Array.isArray(d.users)) {
      return d.users.map((u) => u && u.user && u.user.username).filter(Boolean)
    }
    return []
  }

  // Top-search returning {username, pk, is_verified} for ranking + chaining.
  async function topSearchFull(query) {
    const d = await igFetch(
      `/web/search/topsearch/?context=blended&query=${encodeURIComponent(query)}`
    )
    if (d && Array.isArray(d.users)) {
      return d.users
        .map((u) => u && u.user)
        .filter(Boolean)
        .map((u) => ({ username: u.username, pk: u.pk || u.id, is_verified: !!u.is_verified }))
        .filter((x) => x.username)
    }
    return []
  }

  // Instagram's own "accounts similar to this one" graph — high-quality, in-niche
  // real creators. Seeded from strong discovered accounts.
  async function similarAccounts(userId) {
    if (!userId) return []
    const d = await igFetch(`/api/v1/discover/chaining/?target_id=${encodeURIComponent(userId)}`)
    const users = (d && d.users) || []
    return users.map((u) => u && u.username).filter(Boolean)
  }

  // Verified-first discovery: real public figures/influencers from search, then
  // Instagram's similar-accounts graph seeded from the verified ones, then
  // hashtags last (ad/shop-heavy). Returns usernames with the strongest first.
  async function gatherUsernames(queries, hashtags, cap) {
    const seen = new Set()
    const verified = []
    const others = []
    const seeds = []
    const count = () => verified.length + others.length
    const addTo = (arr, list) => {
      for (const u of list) {
        const nl = String(u).toLowerCase()
        if (nl && !seen.has(nl)) {
          seen.add(nl)
          arr.push(nl)
        }
      }
    }

    // 1) Top-search — verified accounts are the highest-quality signal.
    for (const q of queries || []) {
      if (count() >= cap) break
      report({ phase: 'search', message: `🔎 ${q}` })
      for (const u of await topSearchFull(q)) {
        const nl = u.username.toLowerCase()
        if (seen.has(nl)) continue
        seen.add(nl)
        if (u.is_verified) {
          verified.push(nl)
          if (u.pk) seeds.push(u.pk)
        } else {
          others.push(nl)
        }
      }
      await sleep(rand(1200, 2800))
    }

    // 2) Expand from verified seeds via Instagram's "similar accounts" graph.
    for (const pk of seeds.slice(0, 6)) {
      if (count() >= cap) break
      report({ phase: 'search', message: '🔗 Similar creators (Instagram graph)…' })
      addTo(others, await similarAccounts(pk))
      await sleep(rand(1200, 2500))
    }

    // 3) Hashtags last (ad/shop-heavy) — only to top up if still short.
    if (count() < cap) {
      for (const h of hashtags || []) {
        if (count() >= cap) break
        report({ phase: 'search', message: `#️⃣ #${h}` })
        addTo(others, await hashtagUsers(h))
        await sleep(rand(1500, 3000))
      }
    }

    return [...verified, ...others] // verified/real creators fetched first
  }

  // Discover creators from a hashtag's top posts (best-effort across IG shapes).
  async function hashtagUsers(tag) {
    const d = await igFetch(`/api/v1/tags/web_info/?tag_name=${encodeURIComponent(tag)}`)
    const out = []
    const buckets = [d?.data?.top, d?.data?.recent]
    for (const b of buckets) {
      for (const s of (b && b.sections) || []) {
        for (const m of (s.layout_content && s.layout_content.medias) || []) {
          const u = m && m.media && m.media.user && m.media.user.username
          if (u) out.push(u)
        }
      }
    }
    return out
  }

  // Ask the background to drop already-seen / already-saved usernames.
  function filterKnown(usernames) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: 'FILTER_KNOWN', usernames }, (r) => {
          if (chrome.runtime.lastError || !r) resolve(usernames)
          else resolve(r.fresh || usernames)
        })
      } catch (e) {
        void e
        resolve(usernames)
      }
    })
  }

  // Ask the backend for AI-generated queries + hashtags (Gemini/OpenRouter).
  function requestPlan(config) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: 'GET_PLAN', config }, (resp) => {
          if (chrome.runtime.lastError || !resp || !resp.ok) resolve(null)
          else resolve(resp.plan)
        })
      } catch (e) {
        void e
        resolve(null)
      }
    })
  }

  function parseUser(payload) {
    const user = payload && payload.data && payload.data.user
    if (!user) return null
    const edges =
      (user.edge_owner_to_timeline_media && user.edge_owner_to_timeline_media.edges) || []
    const likes = []
    const comments = []
    const postImages = []
    const captions = []
    for (const e of edges) {
      const n = (e && e.node) || {}
      const lc = (n.edge_liked_by || n.edge_media_preview_like || {}).count
      const cc = (n.edge_media_to_comment || {}).count
      if (Number.isFinite(lc)) likes.push(lc)
      if (Number.isFinite(cc)) comments.push(cc)
      if ((n.display_url || n.thumbnail_src) && postImages.length < 3) {
        postImages.push(n.display_url || n.thumbnail_src)
      }
      const cap =
        n.edge_media_to_caption &&
        n.edge_media_to_caption.edges &&
        n.edge_media_to_caption.edges[0] &&
        n.edge_media_to_caption.edges[0].node &&
        n.edge_media_to_caption.edges[0].node.text
      if (cap && captions.length < 6) captions.push(String(cap).slice(0, 200))
    }
    const avg = (a) => (a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : null)
    const avgLikes = avg(likes)
    const avgComments = avg(comments)
    const followers = (user.edge_followed_by && user.edge_followed_by.count) || 0
    let engagementRate = null
    if (followers && (avgLikes != null || avgComments != null)) {
      engagementRate =
        Math.round((((avgLikes || 0) + (avgComments || 0)) / followers) * 100 * 1000) / 1000
    }
    const bio = user.biography || ''
    const email = user.business_email || (bio.match(EMAIL_RE) || [])[0] || null
    const category = user.category || user.category_name || user.business_category_name || ''
    return {
      username: user.username,
      full_name: user.full_name || user.username,
      biography: bio,
      followers,
      following: (user.edge_follow && user.edge_follow.count) || 0,
      posts: (user.edge_owner_to_timeline_media && user.edge_owner_to_timeline_media.count) || 0,
      is_verified: !!user.is_verified,
      is_private: !!user.is_private,
      is_business: !!user.is_business_account,
      category,
      website: user.external_url || null,
      profile_pic_url: user.profile_pic_url_hd || user.profile_pic_url || null,
      email,
      avg_likes: avgLikes,
      avg_comments: avgComments,
      engagement_rate: engagementRate,
      posts_sampled: likes.length,
      profile_pic_url_hd: user.profile_pic_url_hd || user.profile_pic_url || null,
      post_images: postImages,
      captions,
    }
  }

  // Fetch an image and return a data: URL (so the vision model reliably sees it).
  async function toDataUrl(url) {
    if (!url) return null
    try {
      const r = await fetch(url)
      if (!r.ok) return null
      const blob = await r.blob()
      if (blob.size > 350000) return null // keep base64 under the backend's per-image cap
      return await new Promise((resolve) => {
        const fr = new FileReader()
        fr.onload = () => resolve(fr.result)
        fr.onerror = () => resolve(null)
        fr.readAsDataURL(blob)
      })
    } catch (e) {
      void e
      return null
    }
  }

  // Build the visual+text snapshot and ask the backend vision model to qualify.
  async function qualifyCandidate(parsed, niche) {
    const urls = [parsed.profile_pic_url_hd, ...(parsed.post_images || [])].filter(Boolean).slice(0, 4)
    const images = []
    for (const u of urls) {
      const d = await toDataUrl(u)
      if (d) images.push(d)
    }
    const snapshot = {
      username: parsed.username,
      fullName: parsed.full_name,
      bio: parsed.biography,
      category: parsed.category,
      followers: parsed.followers,
      engagementRate: parsed.engagement_rate,
      captions: parsed.captions,
      images,
    }
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: 'QUALIFY', niche, profiles: [snapshot] }, (resp) => {
          if (chrome.runtime.lastError || !resp || !resp.ok) resolve(null)
          else resolve((resp.verdicts && resp.verdicts[0]) || null)
        })
      } catch (e) {
        void e
        resolve(null)
      }
    })
  }

  // Classify whether a profile is an individual creator/influencer (a "personal
  // lead") vs a company/brand/shop/page. Uses the IG category + name/bio markers.
  const BUSINESS_CAT_RE =
    /shop|store|retail|brand|compan|business|restaurant|cafe|café|market|grocer|commerce|e-?commerce|agency|clinic|hospital|hotel|news|magazine|media|publish|website|software|app developer|service|product\/service|jewel|furnitur|real estate|automotive|organi[sz]ation|non-?profit|government|school|universit|academy|gym|fitness center|salon|spa|boutique|wholesale|trading|factory|pharmac/i
  const PERSON_CAT_RE =
    /creator|public figure|blogger|influencer|artist|musician|actor|model|author|photographer|personal blog|comedian|athlete|chef|coach|entrepreneur|video creator|content/i
  const BUSINESS_NAME_RE = /\b(official|store|shop|company|co\.|est\.?|llc|wholesale|trading|factory|boutique|agency)\b/i

  function isPersonalAccount(p) {
    const cat = (p.category || '').toLowerCase()
    if (cat) {
      if (PERSON_CAT_RE.test(cat)) return true // explicit creator/person category
      if (BUSINESS_CAT_RE.test(cat)) return false // explicit business category
    }
    // No category: personal accounts usually have none — keep unless the name screams business.
    const text = `${p.full_name || ''} ${p.username || ''} ${p.biography || ''}`
    if (BUSINESS_NAME_RE.test(text)) return false
    // Business accounts with no creator category are likely brands.
    if (p.is_business && !PERSON_CAT_RE.test(cat)) return false
    return true
  }

  // Real scraping of a single profile: structured profile API + a second pass
  // over recent posts (user feed) to compute a true engagement rate when the
  // profile payload didn't include recent-media counts.
  async function fetchProfile(username) {
    const payload = await igFetch(
      `/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`
    )
    const user = payload && payload.data && payload.data.user
    if (!user) return null
    const parsed = parseUser(payload)
    if (parsed && parsed.avg_likes == null && user.id) {
      try {
        const feed = await igFetch(`/api/v1/feed/user/${user.id}/?count=12`)
        const items = (feed && feed.items) || []
        const likes = items.map((i) => i.like_count).filter((x) => Number.isFinite(x) && x >= 0)
        const comments = items
          .map((i) => i.comment_count)
          .filter((x) => Number.isFinite(x) && x >= 0)
        if (likes.length) {
          const avg = (a) => Math.round(a.reduce((s, x) => s + x, 0) / a.length)
          parsed.avg_likes = avg(likes)
          parsed.avg_comments = comments.length ? avg(comments) : parsed.avg_comments
          parsed.posts_sampled = likes.length
          if (parsed.followers) {
            parsed.engagement_rate =
              Math.round(
                (((parsed.avg_likes || 0) + (parsed.avg_comments || 0)) / parsed.followers) *
                  100 *
                  1000
              ) / 1000
          }
        }
      } catch (e) {
        void e
      }
    }
    return parsed
  }

  function buildQueries(category, city) {
    const c = (category || '').trim()
    const t = (city || '').trim()
    // No category → discover ALL Saudi influencers (any niche).
    if (!c || /^(all|saudi|سعودي|مؤثر|مؤثرين|influencers?)/i.test(c)) {
      return ['مؤثرين السعودية', 'مشاهير السعودية', 'saudi influencer', 'صناع محتوى السعودية', 'مؤثر سعودي']
    }
    // Short Instagram search-box terms (2-3 words), not sentences.
    return [`${c} ${t}`, `${c} السعودية`, `${c} creator`, `${c} مؤثر`].filter((q) => q.trim())
  }

  async function harvest({ category, city, minFollowers = 0, limit = 30, personalOnly = true, aiFilter = true }) {
    // Open an incremental save session so each profile is persisted as it's found.
    send({ type: 'HARVEST_START', config: { category, city, minFollowers } })

    // 1) Ask the backend AI planner for smart queries + hashtags; fall back to templates.
    report({ phase: 'search', message: '🧠 Planning search with AI…' })
    const plan = await requestPlan({ category, city, minFollowers, targetCount: limit })
    const queries =
      plan && Array.isArray(plan.queries) && plan.queries.length
        ? plan.queries
        : buildQueries(category, city)
    const hashtags = plan && Array.isArray(plan.hashtags) ? plan.hashtags : []
    report({
      phase: 'search',
      message: `🧠 ${plan && plan.planner ? plan.planner.toUpperCase() : 'TEMPLATE'} plan: ${queries.length} queries, ${hashtags.length} hashtags`,
    })

    // 2) Verified-first discovery (search → similar-accounts graph → hashtags).
    const usernames = await gatherUsernames(queries, hashtags, limit * 3)

    // Skip accounts already harvested before — find NEW ones each run.
    const freshUsernames = await filterKnown(usernames)
    const total = Math.min(freshUsernames.length, limit)
    report({ phase: 'found', message: `Found ${usernames.length}, ${freshUsernames.length} new — fetching ${total}…`, total, fetched: 0, kept: 0 })

    const candidates = []
    let i = 0
    for (const username of freshUsernames.slice(0, limit)) {
      i += 1
      report({ phase: 'fetch', message: `Fetching @${username}`, total, fetched: i, kept: candidates.length, current: username })
      const parsed = await fetchProfile(username)
      const heuristicOk =
        parsed &&
        parsed.followers >= minFollowers &&
        !parsed.is_private &&
        (!personalOnly || isPersonalAccount(parsed))

      if (!heuristicOk) {
        if (parsed && personalOnly && !isPersonalAccount(parsed)) {
          report({ phase: 'fetch', message: `⏭️ Skipped @${username} (business/page)`, total, fetched: i, kept: candidates.length })
        }
      } else {
        let keep = true
        // Visual AI qualification — scan profile + post images and decide.
        if (aiFilter) {
          report({ phase: 'fetch', message: `🧠 AI scanning @${username}…`, total, fetched: i, kept: candidates.length })
          const verdict = await qualifyCandidate(parsed, `${category} ${city}`.trim())
          if (verdict) {
            parsed.persona = verdict.persona
            parsed.qualify_reason = verdict.reason
            keep = verdict.keep !== false
            if (!keep) {
              report({ phase: 'fetch', message: `❌ AI rejected @${username} — ${verdict.persona}: ${verdict.reason}`, total, fetched: i, kept: candidates.length })
            }
          }
        }
        if (keep) {
          candidates.push(parsed)
          // Stream the full profile so the background worker saves it immediately.
          send({ type: 'HARVEST_ITEM', candidate: parsed })
        }
      }
      report({ phase: 'fetch', total, fetched: i, kept: candidates.length })
      await sleep(rand(2500, 6000)) // human pacing
    }
    return candidates
  }

  // ── Live mode: the background worker tab navigates here per profile ──────────
  async function discover(queries, hashtags, cap) {
    return gatherUsernames(queries, hashtags, cap)
  }

  // Snowball: given strong seed usernames, return Instagram's "similar accounts"
  // for each (the agent brain asks for this when a round yields good creators).
  async function similarTo(usernames, cap) {
    const seen = new Set()
    const out = []
    for (const username of (usernames || []).slice(0, 6)) {
      if (out.length >= (cap || 60)) break
      const payload = await igFetch(
        `/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`
      )
      const id = payload && payload.data && payload.data.user && payload.data.user.id
      if (!id) continue
      report({ phase: 'search', message: `🔗 Similar to @${username}` })
      for (const u of await similarAccounts(id)) {
        const nl = String(u).toLowerCase()
        if (nl && !seen.has(nl)) {
          seen.add(nl)
          out.push(nl)
        }
      }
      await sleep(rand(1200, 2500))
    }
    return out
  }

  // Process the profile the (live) tab is currently on: scrape → filter → emit.
  async function processCurrent(cfg) {
    const m = location.pathname.match(/^\/([A-Za-z0-9._]+)\/?$/)
    const username = m && m[1] ? m[1].toLowerCase() : ''
    if (!username) return { status: 'skip' }
    try {
      window.scrollTo({ top: 700, behavior: 'smooth' })
    } catch (e) {
      void e
    }
    await sleep(rand(600, 1300))
    const parsed = await fetchProfile(username)
    if (!parsed || parsed.followers < (cfg.minFollowers || 0) || parsed.is_private) {
      return { status: 'skip' }
    }
    if (cfg.personalOnly && !isPersonalAccount(parsed)) {
      report({ phase: 'fetch', message: `⏭️ @${username} (business/page)` })
      return { status: 'business' }
    }
    let keep = true
    if (cfg.aiFilter) {
      report({ phase: 'fetch', message: `🧠 AI scanning @${username}…` })
      const verdict = await qualifyCandidate(parsed, `${cfg.category} ${cfg.city}`.trim())
      if (verdict) {
        parsed.persona = verdict.persona
        parsed.qualify_reason = verdict.reason
        keep = verdict.keep !== false
        if (!keep) report({ phase: 'fetch', message: `❌ @${username} — ${verdict.persona}: ${verdict.reason}` })
      }
    }
    if (keep) {
      return { status: 'kept', candidate: parsed }
    }
    return { status: 'rejected' }
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === 'PING') {
      sendResponse({ harvesting })
      return true
    }
    if (msg && msg.type === 'DISCOVER') {
      discover(msg.queries, msg.hashtags, msg.cap || 60)
        .then((usernames) => sendResponse({ usernames }))
        .catch(() => sendResponse({ usernames: [] }))
      return true
    }
    if (msg && msg.type === 'SIMILAR') {
      similarTo(msg.seeds || [], msg.cap || 60)
        .then((usernames) => sendResponse({ usernames }))
        .catch(() => sendResponse({ usernames: [] }))
      return true
    }
    if (msg && msg.type === 'PROCESS_CURRENT') {
      processCurrent(msg.config || {})
        .then((r) => sendResponse(r))
        .catch((e) => sendResponse({ status: 'error', error: String(e) }))
      return true
    }
    if (msg && msg.type === 'START') {
      if (harvesting) {
        sendResponse({ ok: false, error: 'A harvest is already running — let it finish first.' })
        return true
      }
      harvesting = true
      chrome.storage.local.set({ harvesting: true, harvestStartedAt: Date.now() }).catch(() => {})
      ;(async () => {
        try {
          const candidates = await harvest(msg.config || {})
          send({ type: 'HARVEST_DONE' })
          sendResponse({ ok: true, count: candidates.length })
        } catch (e) {
          send({ type: 'HARVEST_ERROR', message: String(e) })
          sendResponse({ ok: false, error: String(e) })
        } finally {
          harvesting = false
        }
      })()
      return true
    }
    return false
  })
})()
