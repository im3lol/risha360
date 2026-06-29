const $ = (id) => document.getElementById(id)
const startBtn = $('start')
const panel = $('panel')
const barFill = $('barFill')
const phaseEl = $('phase')
const countsEl = $('counts')
const listEl = $('list')

const STALE_MS = 15 * 60 * 1000

function showPanel() {
  panel.classList.add('on')
}

function setRunning(running) {
  startBtn.disabled = running
  startBtn.textContent = running ? '⏳ Scraping…' : '⚡ Start scraping'
  if (running) showPanel()
}

function setProgress(p) {
  showPanel()
  if (p.message) phaseEl.textContent = p.message
  if (p.total) {
    const pct = Math.round(((p.fetched || 0) / p.total) * 100)
    barFill.style.width = pct + '%'
    countsEl.textContent = `Fetched ${p.fetched || 0}/${p.total} · kept ${p.kept || 0}`
  }
}

function formatNum(n) {
  if (!n) return '0'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return String(n)
}

function addItem(c) {
  if (!c || !c.username) return
  const url = `https://www.instagram.com/${c.username}/`
  const initials = (c.full_name || c.username).slice(0, 2).toUpperCase()
  const er = c.engagement_rate != null ? `${c.engagement_rate}%` : ''
  const div = document.createElement('div')
  div.className = 'item'
  div.innerHTML =
    `<div class="ava">${initials}</div>` +
    `<div class="meta"><a href="${url}" target="_blank">@${c.username}</a>` +
    `<small>${formatNum(c.followers)} followers${c.persona ? ' · ' + c.persona : ''}</small></div>` +
    `<div class="er">${er}</div>`
  listEl.prepend(div)
}

$('opts').addEventListener('click', (e) => {
  e.preventDefault()
  chrome.runtime.openOptionsPage()
})

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg) return
  if (msg.type === 'HARVEST_PROGRESS') setProgress(msg)
  if (msg.type === 'HARVEST_ITEM') addItem(msg.candidate)
  if (msg.type === 'SAVE_PROGRESS') countsEl.textContent = msg.message
  if (msg.type === 'HARVEST_ERROR') {
    phaseEl.textContent = '❌ ' + msg.message
    setRunning(false)
  }
  if (msg.type === 'INGEST_RESULT') {
    phaseEl.textContent = msg.message
    barFill.style.width = '100%'
    setRunning(false)
  }
})

// A lock older than STALE_MS is treated as abandoned, so you're never stuck.
async function isLocked() {
  const { harvesting, harvestStartedAt } = await chrome.storage.local.get([
    'harvesting',
    'harvestStartedAt',
  ])
  if (!harvesting) return false
  if (harvestStartedAt && Date.now() - harvestStartedAt > STALE_MS) {
    await chrome.storage.local.set({ harvesting: false })
    return false
  }
  return true
}

isLocked().then((locked) => {
  if (locked) {
    setRunning(true)
    phaseEl.textContent = 'A scrape is already running…'
  }
})

startBtn.addEventListener('click', async () => {
  if (await isLocked()) {
    showPanel()
    phaseEl.textContent = '⏳ Finish the current scrape before starting a new one.'
    return
  }

  const platform = $('platform') ? $('platform').value : 'instagram'
  const config = {
    platform,
    category: $('category').value.trim() || 'Saudi influencers',
    city: $('city').value.trim(),
    minFollowers: Number($('minFollowers').value) || 0,
    limit: Number($('limit').value) || 30,
    personalOnly: $('personalOnly').checked,
    aiFilter: $('aiFilter').checked,
    // TikTok requires the background-driven controlled tab.
    liveMode: $('liveMode').checked || platform === 'tiktok',
  }

  listEl.innerHTML = ''
  barFill.style.width = '0%'
  countsEl.textContent = ''

  // Live mode: the background opens its own controlled tab — no need for an
  // active Instagram tab. Silent mode runs in the current Instagram tab.
  if (config.liveMode) {
    setRunning(true)
    phaseEl.textContent = '👁️ Opening Instagram + the side progress panel…'
    // Open the persistent side panel (progress beside the Instagram tab).
    try {
      const win = await chrome.windows.getCurrent()
      if (chrome.sidePanel && win) {
        await chrome.sidePanel.setOptions({ enabled: true, path: 'sidepanel.html' })
        await chrome.sidePanel.open({ windowId: win.id })
      }
    } catch (e) {
      void e
      phaseEl.textContent = '👁️ Live started — open Edge’s side panel to watch progress.'
    }
    chrome.runtime.sendMessage({ type: 'START_LIVE', config }).catch(() => {})
    return
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const isInstagram = tab && tab.url && /:\/\/(www\.)?instagram\.com\//.test(tab.url)
  if (!isInstagram) {
    showPanel()
    phaseEl.textContent = '⚠ Open and log into instagram.com in the active tab first (or use Live mode).'
    return
  }

  setRunning(true)
  phaseEl.textContent = 'Starting… (you can close this popup; it keeps running)'
  try {
    const resp = await chrome.tabs.sendMessage(tab.id, { type: 'START', config })
    if (resp && resp.ok === false) {
      phaseEl.textContent = '⏳ ' + resp.error
      setRunning(false)
    }
  } catch (e) {
    phaseEl.textContent = '❌ Refresh the Instagram tab and retry.\n' + String(e)
    setRunning(false)
  }
})
