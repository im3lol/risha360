const $ = (id) => document.getElementById(id)

async function load() {
  const { backendUrl, agentSecret } = await chrome.storage.local.get(['backendUrl', 'agentSecret'])
  $('backendUrl').value = backendUrl || 'http://localhost:3001'
  $('agentSecret').value = agentSecret || ''
}

$('save').addEventListener('click', async () => {
  await chrome.storage.local.set({
    backendUrl: $('backendUrl').value.trim().replace(/\/+$/, ''),
    agentSecret: $('agentSecret').value.trim(),
  })
  $('saved').textContent = 'Saved ✓'
  setTimeout(() => ($('saved').textContent = ''), 1500)
})

load()
