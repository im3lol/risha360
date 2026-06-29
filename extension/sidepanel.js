const $ = (id) => document.getElementById(id)
const nowEl = $('now')
const barFill = $('barFill')
const countsEl = $('counts')
const saveEl = $('save')
const listEl = $('list')
const emptyEl = $('empty')

function formatNum(n) {
  if (!n) return '0'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return String(n)
}

function setProgress(p) {
  if (p.message) nowEl.textContent = p.message
  if (p.total) {
    const pct = Math.round(((p.fetched || 0) / p.total) * 100)
    barFill.style.width = pct + '%'
    countsEl.textContent = `Visited ${p.fetched || 0}/${p.total} · kept ${p.kept || 0}`
  }
}

function addItem(c) {
  if (!c || !c.username) return
  if (emptyEl) emptyEl.remove()
  const url = `https://www.instagram.com/${c.username}/`
  const initials = (c.full_name || c.username).slice(0, 2).toUpperCase()
  const persona = c.persona ? ` · ${c.persona}` : ''
  const er = c.engagement_rate != null ? `${c.engagement_rate}%` : ''
  const div = document.createElement('div')
  div.className = 'item'
  div.innerHTML =
    `<div class="ava">${initials}</div>` +
    `<div class="meta"><a href="${url}" target="_blank">@${c.username}</a>` +
    `<small>${formatNum(c.followers)} followers${persona}</small></div>` +
    `<div class="er">${er}</div>`
  listEl.prepend(div)
}

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg) return
  if (msg.type === 'HARVEST_PROGRESS') setProgress(msg)
  if (msg.type === 'HARVEST_ITEM') addItem(msg.candidate)
  if (msg.type === 'SAVE_PROGRESS') saveEl.textContent = msg.message
  if (msg.type === 'HARVEST_ERROR') nowEl.textContent = '❌ ' + msg.message
  if (msg.type === 'INGEST_RESULT') {
    nowEl.textContent = msg.message
    barFill.style.width = '100%'
  }
})
