import { readFile } from 'node:fs/promises'

// Read an optional .env file for local runs; fall back to process.env (Docker/CI).
let fileEnv = {}
try {
  fileEnv = Object.fromEntries(
    (await readFile(new URL('../.env', import.meta.url), 'utf8'))
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=')
        return [line.slice(0, index), line.slice(index + 1)]
      })
  )
} catch {
  // No .env file present (e.g. running inside a container) — use process.env only.
}

const env = { ...fileEnv, ...process.env }

const baseUrl = env.AGENT_BASE_URL || 'http://127.0.0.1:3000'
const secret = env.AGENT_CRON_SECRET || env.SUPABASE_SERVICE_ROLE_KEY
if (!secret) throw new Error('AGENT_CRON_SECRET or SUPABASE_SERVICE_ROLE_KEY is missing from .env')

async function tick() {
  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/agent/tick`, {
      method: 'POST',
      headers: { 'x-agent-secret': secret },
    })
    const payload = await response.text()
    console.log(new Date().toISOString(), response.status, payload)
  } catch (error) {
    console.error(new Date().toISOString(), error)
  }
}

await tick()
setInterval(tick, 60_000)
