import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WAL_DIR = path.join(__dirname, 'data', 'wal')

fs.mkdirSync(WAL_DIR, { recursive: true })

let logStream = null
let currentSession = null

function sessionId() {
  return 'ses_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function startSession() {
  currentSession = sessionId()
  const filePath = path.join(WAL_DIR, `${currentSession}.wal`)
  logStream = fs.createWriteStream(filePath, { flags: 'a' })
  append({ event: 'session_start', timestamp: new Date().toISOString(), session: currentSession })
  return currentSession
}

export function append(entry) {
  if (!logStream) return
  const record = {
    ...entry,
    ts: entry.timestamp || new Date().toISOString(),
    seq: Date.now()
  }
  logStream.write(JSON.stringify(record) + '\n')
}

export function checkpoint(label, data) {
  append({ event: 'checkpoint', label, data })
}

export function getSession(session) {
  const filePath = path.join(WAL_DIR, `${session}.wal`)
  if (!fs.existsSync(filePath)) return null
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean)
  return lines.map(l => JSON.parse(l))
}

export function endSession(outcome) {
  append({ event: 'session_end', outcome, duration_ms: Date.now() - parseTimestamp() })
  if (logStream) { logStream.end(); logStream = null }
  currentSession = null
}

function parseTimestamp() {
  try {
    const name = currentSession || ''
    return parseInt(name.split('_')[1], 36) || Date.now()
  } catch { return Date.now() }
}

export function recoverLastSession() {
  const files = fs.readdirSync(WAL_DIR).filter(f => f.endsWith('.wal'))
  if (files.length === 0) return null
  files.sort().reverse()
  const last = files[0]
  const lines = fs.readFileSync(path.join(WAL_DIR, last), 'utf-8').split('\n').filter(Boolean)
  const entries = lines.map(l => JSON.parse(l))
  const startIdx = entries.findIndex(e => e.event === 'session_start')
  const endIdx = entries.findIndex(e => e.event === 'session_end')
  if (endIdx !== -1 && endIdx > startIdx) return null
  if (startIdx === -1) return null
  const snapshot = entries.filter(e => e.event === 'checkpoint' && e.label)
  return {
    session: last.replace('.wal', ''),
    entries: entries.slice(startIdx),
    last_checkpoint: snapshot.length > 0 ? snapshot[snapshot.length - 1] : null
  }
}

export function recoveryPaths() {
  return [
    {
      name: 'context_compaction',
      priority: 1,
      max_attempts: 3,
      description: 'Summarize and shrink conversation history'
    },
    {
      name: 'collapse_drain',
      priority: 2,
      max_attempts: 2,
      description: 'Aggressive state reduction - strip tool results, keep only decisions'
    },
    {
      name: 'token_escalation',
      priority: 3,
      max_attempts: 1,
      description: 'Request larger context window from model provider'
    }
  ]
}
