/*
 * Risha 360 Harvester — background service worker.
 *
 * Saves harvested profiles to the Risha backend INCREMENTALLY: profiles stream
 * in from the content script and are flushed to /api/discovery/ingest in small
 * chunks as they arrive — so data is persisted immediately and a partial run
 * (e.g. you closed the tab) still keeps everything gathered up to that point.
 */
const DEFAULTS = { backendUrl: 'http://localhost:3001', agentSecret: '' }
const CHUNK = 4 // flush every N profiles

let session = null // { config, buffer, totals }
let flushChain = Promise.resolve()

chrome.runtime.onInstalled.addListener(async () => {
  const cur = await chrome.storage.local.get(Object.keys(DEFAULTS))
  await chrome.storage.local.set({ ...DEFAULTS, ...cur })
})

async function ingest(candidates) {
  const { backendUrl, agentSecret } = await chrome.storage.local.get(['backendUrl', 'agentSecret'])
  if (!backendUrl || !agentSecret) {
    throw new Error('Set backend URL and agent secret in the extension options first.')
  }
  const res = await fetch(`${backendUrl.replace(/\/+$/, '')}/api/discovery/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-agent-secret': agentSecret },
    body: JSON.stringify({
      platform: session.config.platform || 'instagram',
      category: session.config.category,
      city: session.config.city,
      minFollowers: session.config.minFollowers || 0,
      candidates,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Ingest failed (${res.status})`)
  return data
}

function flush() {
  flushChain = flushChain.then(async () => {
    if (!session || !session.buffer.length) return
    const chunk = session.buffer.splice(0, session.buffer.length)
    try {
      const result = await ingest(chunk)
      session.totals.found += result.found || 0
      session.totals.created += result.created || 0
      session.totals.routed += result.routed || 0
      chrome.runtime
        .sendMessage({ type: 'SAVE_PROGRESS', message: `💾 Saved ${session.totals.created} so far…` })
        .catch(() => {})
    } catch (e) {
      chrome.runtime.sendMessage({ type: 'SAVE_PROGRESS', message: `⚠ Save error: ${String(e)}` }).catch(() => {})
    }
  })
  return flushChain
}

function done() {
  chrome.storage.local.set({ harvesting: false }).catch(() => {})
  const t = (session && session.totals) || { found: 0, created: 0, routed: 0 }
  chrome.runtime
    .sendMessage({
      type: 'INGEST_RESULT',
      message: `✅ Done — ${t.created} leads saved (${t.found} found, ${t.routed} routed to sales).`,
    })
    .catch(() => {})
  session = null
}

async function getPlan(config) {
  const { backendUrl, agentSecret } = await chrome.storage.local.get(['backendUrl', 'agentSecret'])
  if (!backendUrl || !agentSecret) return null
  const res = await fetch(`${backendUrl.replace(/\/+$/, '')}/api/discovery/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-agent-secret': agentSecret },
    body: JSON.stringify(config),
  })
  if (!res.ok) return null
  return res.json()
}

async function knownOnServer(usernames) {
  const { backendUrl, agentSecret } = await chrome.storage.local.get(['backendUrl', 'agentSecret'])
  if (!backendUrl || !agentSecret) return []
  try {
    const res = await fetch(`${backendUrl.replace(/\/+$/, '')}/api/discovery/known`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-agent-secret': agentSecret },
      body: JSON.stringify({ usernames }),
    })
    if (!res.ok) return []
    const d = await res.json()
    return d.known || []
  } catch (e) {
    void e
    return []
  }
}

// Drop usernames seen recently (local memory, with a TTL so they refresh later)
// or already saved in the database within the freshness window — so each run
// finds NEW accounts, but stale ones get re-visited after the TTL.
const SEEN_TTL_MS = 30 * 86400000 // 30 days
async function filterKnown(usernames) {
  const lower = [...new Set(usernames.map((u) => String(u).toLowerCase()))]
  const now = Date.now()
  const { seenMap = {} } = await chrome.storage.local.get(['seenMap'])
  const known = new Set(await knownOnServer(lower))
  const fresh = lower.filter((u) => {
    const seenAt = seenMap[u]
    const recentlySeen = seenAt && now - seenAt < SEEN_TTL_MS
    return !recentlySeen && !known.has(u)
  })
  for (const u of fresh) seenMap[u] = now
  // Drop expired entries + cap size.
  const kept = Object.entries(seenMap)
    .filter(([, ts]) => now - ts < SEEN_TTL_MS)
    .slice(-8000)
  await chrome.storage.local.set({ seenMap: Object.fromEntries(kept) })
  return fresh
}

// Ask the server-side agent brain for the next action given the live run state.
async function decide(state) {
  const { backendUrl, agentSecret } = await chrome.storage.local.get(['backendUrl', 'agentSecret'])
  if (!backendUrl || !agentSecret) return null
  try {
    const res = await fetch(`${backendUrl.replace(/\/+$/, '')}/api/discovery/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-agent-secret': agentSecret },
      body: JSON.stringify(state),
    })
    if (!res.ok) return null
    const d = await res.json()
    return d.action || null
  } catch (e) {
    void e
    return null
  }
}

async function qualify(niche, profiles) {
  const { backendUrl, agentSecret } = await chrome.storage.local.get(['backendUrl', 'agentSecret'])
  if (!backendUrl || !agentSecret) return null
  const res = await fetch(`${backendUrl.replace(/\/+$/, '')}/api/discovery/qualify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-agent-secret': agentSecret },
    body: JSON.stringify({ niche, profiles }),
  })
  if (!res.ok) return null
  return res.json()
}

// ── Live mode: a visible worker tab navigates profile-to-profile ─────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function sendTab(tabId, msg) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, msg, (r) => {
        if (chrome.runtime.lastError) resolve(null)
        else resolve(r)
      })
    } catch (e) {
      void e
      resolve(null)
    }
  })
}

function waitComplete(tabId, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      chrome.tabs.onUpdated.removeListener(listener)
      resolve()
    }
    const listener = (id, info) => {
      if (id === tabId && info.status === 'complete') finish()
    }
    chrome.tabs.onUpdated.addListener(listener)
    setTimeout(finish, timeoutMs || 20000)
  })
}

async function navigate(tabId, url) {
  const loaded = waitComplete(tabId, 20000)
  await chrome.tabs.update(tabId, { url })
  await loaded
  await sleep(1500 + Math.random() * 1500) // let it render + human pause
}

const progress = (m, extra) =>
  chrome.runtime.sendMessage({ type: 'HARVEST_PROGRESS', message: m, ...(extra || {}) }).catch(() => {})

// TikTok discovery: navigate search/tag pages in the worker tab and let the
// TikTok content script extract @usernames from the rendered DOM.
async function discoverTikTok(tabId, queries, hashtags, cap) {
  const seen = new Set()
  const out = []
  const add = (list) => {
    for (const u of list || []) {
      const nl = String(u).toLowerCase()
      if (nl && !seen.has(nl)) {
        seen.add(nl)
        out.push(nl)
      }
    }
  }
  for (const q of queries || []) {
    if (out.length >= cap) break
    progress(`🔎 ${q}`)
    await navigate(tabId, `https://www.tiktok.com/search/user?q=${encodeURIComponent(q)}`)
    const r = await sendTab(tabId, { type: 'EXTRACT_USERS' })
    add(r && r.usernames)
  }
  for (const h of hashtags || []) {
    if (out.length >= cap) break
    progress(`#️⃣ #${h}`)
    await navigate(tabId, `https://www.tiktok.com/tag/${encodeURIComponent(String(h).replace(/^#/, ''))}`)
    const r = await sendTab(tabId, { type: 'EXTRACT_USERS' })
    add(r && r.usernames)
  }
  return out
}

async function runLive(config) {
  const { harvesting } = await chrome.storage.local.get(['harvesting'])
  if (harvesting) {
    chrome.runtime.sendMessage({ type: 'INGEST_RESULT', message: '⏳ A scrape is already running.' }).catch(() => {})
    return
  }
  await chrome.storage.local.set({ harvesting: true, harvestStartedAt: Date.now() })
  const platform = config.platform === 'tiktok' ? 'tiktok' : 'instagram'
  const home = platform === 'tiktok' ? 'https://www.tiktok.com/' : 'https://www.instagram.com/'
  const profileUrl = (u) =>
    platform === 'tiktok' ? `https://www.tiktok.com/@${u}` : `https://www.instagram.com/${u}/`
  session = {
    config: { platform, category: config.category, city: config.city, minFollowers: config.minFollowers },
    buffer: [],
    totals: { found: 0, created: 0, routed: 0 },
  }
  flushChain = Promise.resolve()

  let tabId = null
  try {
    const tab = await chrome.tabs.create({ url: home, active: true })
    tabId = tab.id
    await waitComplete(tabId, 20000)
    await sleep(2000)

    progress('🧠 Planning search with AI…')
    const plan = await getPlan({ category: config.category, city: config.city, targetCount: config.limit }).catch(() => null)
    const queries = plan && plan.queries && plan.queries.length ? plan.queries : [`${config.category} ${config.city}`.trim()]
    const hashtags = (plan && plan.hashtags) || []
    const cap = (config.limit || 30) * 3

    // ── Adaptive loop: Plan → Act → Observe → Decide (server agent brain) ──────
    const target = config.limit || 30
    const kept = [] // {username, followers, persona} — for seeds + topAccounts
    const usedQueries = new Set(queries)
    const history = [] // RoundStat[] fed back to the brain

    // Visit a batch of candidate usernames; record a round stat for the brain.
    async function visitRound(label, candidateUsernames) {
      const fresh = await filterKnown(candidateUsernames || [])
      const duplicates = (candidateUsernames || []).length - fresh.length
      // A little headroom over the remaining target so a round isn't too thin.
      const list = fresh.slice(0, Math.max(target - kept.length, 0) + 5)
      progress(`${label}: ${(candidateUsernames || []).length} found, ${fresh.length} new — visiting ${list.length}…`, {
        total: list.length,
        fetched: 0,
        kept: kept.length,
      })
      let i = 0
      let roundKept = 0
      for (const u of list) {
        if (kept.length >= target) break
        i += 1
        progress(`👁️ Visiting @${u}`, { total: list.length, fetched: i, kept: kept.length })
        await navigate(tabId, profileUrl(u))
        const r = await sendTab(tabId, { type: 'PROCESS_CURRENT', config })
        if (r && r.status === 'kept' && r.candidate) {
          session.buffer.push(r.candidate)
          kept.push({ username: r.candidate.username, followers: r.candidate.followers || 0, persona: r.candidate.persona })
          roundKept += 1
          chrome.runtime.sendMessage({ type: 'HARVEST_ITEM', candidate: r.candidate }).catch(() => {})
          if (session.buffer.length >= CHUNK) await flush()
        }
      }
      history.push({ action: label, kept: roundKept, seen: list.length, duplicates })
    }

    // Round 0: initial verified-first discovery (search → similar → hashtags).
    progress('🔎 Discovering creators…')
    let discovered = []
    if (platform === 'tiktok') {
      discovered = await discoverTikTok(tabId, queries, hashtags, cap)
    } else {
      const disc = await sendTab(tabId, { type: 'DISCOVER', queries, hashtags, cap })
      discovered = (disc && disc.usernames) || []
    }
    await visitRound('discover', discovered)

    // Adaptive rounds: ask the brain what to do next until target or stop.
    let safety = 0
    while (kept.length < target && safety < 20) {
      safety += 1
      const topAccounts = kept.slice().sort((a, b) => b.followers - a.followers).slice(0, 8)
      const action = await decide({
        goal: { targetCount: target, minFollowers: config.minFollowers || 0, platform },
        segment: { category: config.category || 'All', city: config.city || 'All' },
        totals: { kept: kept.length, seen: history.reduce((s, r) => s + r.seen, 0), rounds: history.length },
        history: history.slice(-6),
        frontier: { queries: [], seedAccounts: topAccounts.map((a) => a.username) },
        topAccounts,
      })
      if (!action || action.type === 'stop' || action.type === 'switch_segment') {
        progress(`🧠 ${action ? action.reason : 'No more actions'} — finishing.`)
        break
      }
      if (action.type === 'snowball') {
        progress(`🧠 Snowball — ${action.reason}`)
        const r = await sendTab(tabId, { type: 'SIMILAR', seeds: action.seeds, cap })
        await visitRound('snowball', (r && r.usernames) || [])
      } else if (action.type === 'refine_queries') {
        const newQ = (action.queries || []).filter((q) => !usedQueries.has(q))
        if (!newQ.length) {
          progress('🧠 No new queries to try — finishing.')
          break
        }
        for (const q of newQ) usedQueries.add(q)
        progress(`🧠 New queries — ${action.reason}`)
        let more = []
        if (platform === 'tiktok') {
          more = await discoverTikTok(tabId, newQ, action.hashtags || [], cap)
        } else {
          const disc = await sendTab(tabId, { type: 'DISCOVER', queries: newQ, hashtags: action.hashtags || [], cap })
          more = (disc && disc.usernames) || []
        }
        await visitRound('refine_queries', more)
      } else if (action.type === 'broaden') {
        progress(`🧠 Broaden — ${action.reason}`)
        config.minFollowers = action.minFollowers
        session.config.minFollowers = action.minFollowers
        const disc =
          platform === 'tiktok'
            ? { usernames: await discoverTikTok(tabId, queries, hashtags, cap) }
            : await sendTab(tabId, { type: 'DISCOVER', queries, hashtags, cap })
        await visitRound('broaden', (disc && disc.usernames) || [])
      } else {
        break
      }
    }
    await flush()
    done()
  } catch (e) {
    chrome.runtime.sendMessage({ type: 'HARVEST_ERROR', message: String(e) }).catch(() => {})
    await chrome.storage.local.set({ harvesting: false })
    session = null
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg) return false
  if (msg.type === 'START_LIVE') {
    runLive(msg.config || {})
    sendResponse({ ok: true })
    return true
  }
  if (msg.type === 'GET_PLAN') {
    getPlan(msg.config || {})
      .then((plan) => sendResponse({ ok: !!plan, plan }))
      .catch(() => sendResponse({ ok: false }))
    return true // async response
  }
  if (msg.type === 'QUALIFY') {
    qualify(msg.niche, msg.profiles || [])
      .then((data) => sendResponse({ ok: !!data, verdicts: (data && data.verdicts) || [] }))
      .catch(() => sendResponse({ ok: false }))
    return true // async response
  }
  if (msg.type === 'FILTER_KNOWN') {
    filterKnown(msg.usernames || [])
      .then((fresh) => sendResponse({ fresh }))
      .catch(() => sendResponse({ fresh: msg.usernames || [] }))
    return true // async response
  }
  if (msg.type === 'HARVEST_START') {
    session = { config: msg.config || {}, buffer: [], totals: { found: 0, created: 0, routed: 0 } }
    flushChain = Promise.resolve()
  } else if (msg.type === 'HARVEST_ITEM') {
    if (!session) session = { config: msg.config || {}, buffer: [], totals: { found: 0, created: 0, routed: 0 } }
    if (msg.candidate) session.buffer.push(msg.candidate)
    if (session.buffer.length >= CHUNK) flush()
  } else if (msg.type === 'HARVEST_DONE') {
    flush().then(done)
  } else if (msg.type === 'HARVEST_ERROR') {
    flush().then(done) // save whatever we collected before the error
  }
  return false
})
