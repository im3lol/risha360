/*
 * Risha Agent — TikTok content script (runs on tiktok.com).
 *
 * EXPERIMENTAL. TikTok's web API needs signed params, so we read the page's own
 * embedded data instead: profile pages embed a JSON blob
 * (__UNIVERSAL_DATA_FOR_REHYDRATION__) with the user's stats; search pages render
 * user links in the DOM. The background worker tab navigates here per page.
 */
;(() => {
  const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  function rehydration() {
    const el = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__')
    if (!el) return null
    try {
      return JSON.parse(el.textContent || '{}')
    } catch (e) {
      void e
      return null
    }
  }

  function parseProfile() {
    const data = rehydration()
    const scope = data && data['__DEFAULT_SCOPE__']
    const detail = scope && scope['webapp.user-detail']
    const info = detail && detail.userInfo
    if (!info || !info.user) return null
    const u = info.user
    const s = info.stats || info.statsV2 || {}
    const followers = Number(s.followerCount) || 0
    const videos = Number(s.videoCount) || 0
    const hearts = Number(s.heartCount || s.heart) || 0
    const avgLikes = videos > 0 ? Math.round(hearts / videos) : null
    let engagementRate = null
    if (followers && avgLikes != null) {
      engagementRate = Math.round((avgLikes / followers) * 100 * 1000) / 1000
    }
    const bio = u.signature || ''
    const email = (bio.match(EMAIL_RE) || [])[0] || null

    // A few video cover images for the vision qualifier (best-effort from DOM).
    const covers = []
    document.querySelectorAll('img').forEach((img) => {
      const src = img.currentSrc || img.src
      if (src && /tiktokcdn|p16|p19/.test(src) && covers.length < 3) covers.push(src)
    })

    return {
      platform: 'tiktok',
      username: u.uniqueId,
      full_name: u.nickname || u.uniqueId,
      biography: bio,
      followers,
      following: Number(s.followingCount) || 0,
      posts: videos,
      is_verified: !!u.verified,
      is_private: !!u.privateAccount,
      is_business: !!(u.commerceUserInfo && u.commerceUserInfo.commerceUser),
      category: (u.commerceUserInfo && u.commerceUserInfo.category) || '',
      website: u.bioLink && u.bioLink.link ? u.bioLink.link : null,
      profile_pic_url: u.avatarLarger || u.avatarMedium || null,
      email,
      avg_likes: avgLikes,
      avg_comments: null,
      engagement_rate: engagementRate,
      posts_sampled: videos ? Math.min(videos, 12) : 0,
      post_images: covers,
      captions: [],
    }
  }

  // Extract @usernames from a TikTok search/explore/tag page DOM.
  function extractUsers() {
    const out = []
    const seen = new Set()
    document.querySelectorAll('a[href*="/@"]').forEach((a) => {
      const m = (a.getAttribute('href') || '').match(/\/@([A-Za-z0-9._]+)/)
      if (m && m[1]) {
        const nl = m[1].toLowerCase()
        if (!seen.has(nl)) {
          seen.add(nl)
          out.push(nl)
        }
      }
    })
    return out
  }

  function qualifyCandidate(parsed, niche) {
    const images = [parsed.profile_pic_url, ...(parsed.post_images || [])].filter(Boolean).slice(0, 4)
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

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg) return false
    if (msg.type === 'PING') {
      sendResponse({ ok: true, platform: 'tiktok' })
      return true
    }
    if (msg.type === 'EXTRACT_USERS') {
      ;(async () => {
        try {
          window.scrollTo({ top: 1200, behavior: 'smooth' })
        } catch (e) {
          void e
        }
        await sleep(1500)
        sendResponse({ usernames: extractUsers() })
      })()
      return true
    }
    if (msg.type === 'PROCESS_CURRENT') {
      ;(async () => {
        const cfg = msg.config || {}
        await sleep(1000)
        const parsed = parseProfile()
        if (!parsed || !parsed.username || parsed.followers < (cfg.minFollowers || 0) || parsed.is_private) {
          sendResponse({ status: 'skip' })
          return
        }
        let keep = true
        if (cfg.aiFilter) {
          chrome.runtime
            .sendMessage({ type: 'HARVEST_PROGRESS', message: `🧠 AI scanning @${parsed.username}…` })
            .catch(() => {})
          const verdict = await qualifyCandidate(parsed, `${cfg.category} ${cfg.city}`.trim())
          if (verdict) {
            parsed.persona = verdict.persona
            parsed.qualify_reason = verdict.reason
            keep = verdict.keep !== false
          }
        }
        sendResponse(keep ? { status: 'kept', candidate: parsed } : { status: 'rejected' })
      })()
      return true
    }
    return false
  })
})()
