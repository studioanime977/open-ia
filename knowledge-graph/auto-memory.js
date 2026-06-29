import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MEMORY_DIR = path.join(__dirname, 'data', 'auto-memory')
const INDEX_FILE = path.join(__dirname, 'data', 'MEMORY.md')
const SESSION_DIR = path.join(__dirname, 'data', 'session-logs')

fs.mkdirSync(MEMORY_DIR, { recursive: true })
fs.mkdirSync(SESSION_DIR, { recursive: true })

const CATEGORIES = ['user', 'feedback', 'project', 'reference']
const MAX_LINES_STICKY = 200
const MAX_KB_STICKY = 25

export function categorizeMemory(content, source) {
  if (source === 'user') return 'user'
  if (content.includes('error') || content.includes('fix') || content.includes('bug')) return 'feedback'
  if (content.includes('project') || content.includes('repo') || content.includes('app')) return 'project'
  return 'reference'
}

export function saveMemory(name, content, { type, tags, scope } = {}) {
  const category = type || categorizeMemory(content, name)
  const filename = `${category}_${name.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`
  const filepath = path.join(MEMORY_DIR, filename)
  const frontmatter = `---\ntype: ${category}\ncreated: ${new Date().toISOString()}\ntags: [${(tags || []).join(', ')}]\nscope: ${scope || 'project'}\n---\n\n`
  fs.writeFileSync(filepath, frontmatter + content)
  updateStickyIndex(category, name, filename)
  return { file: filename, path: filepath }
}

export function searchMemory(query, maxResults = 5) {
  const files = fs.readdirSync(MEMORY_DIR).filter(f => f.endsWith('.md'))
  const results = []
  const qLower = query.toLowerCase()
  for (const file of files) {
    const content = fs.readFileSync(path.join(MEMORY_DIR, file), 'utf-8')
    const lines = content.split('\n')
    const bodyStart = lines.findIndex(l => l === '---') + 1
    const bodyEnd = lines.slice(bodyStart).findIndex(l => l === '---')
    const endIndex = bodyEnd !== -1 ? bodyStart + bodyEnd : lines.length
    const meta = lines.slice(0, endIndex + 1).join('\n')
    const body = lines.slice(endIndex + 1).join('\n').toLowerCase()
    let score = 0
    const terms = qLower.split(/\s+/)
    for (const term of terms) {
      if (term.length < 3) continue
      const count = (body.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
      score += count
    }
    if (score > 0) {
      const catMatch = file.match(/^(\w+)_/)
      results.push({ file, category: catMatch ? catMatch[1] : 'unknown', score, preview: body.slice(0, 150) })
    }
  }
  return results.sort((a, b) => b.score - a.score).slice(0, maxResults)
}

export function getRelevantMemories(query, maxResults = 5) {
  const memories = searchMemory(query, maxResults * 2)
  const sticky = fs.readFileSync(INDEX_FILE, 'utf-8')
  const stickyLines = sticky.split('\n').length
  const budget = Math.max(1, maxResults - Math.floor(stickyLines / 40))
  return memories.slice(0, budget)
}

export function saveSessionSummary(summary) {
  const today = new Date().toISOString().slice(0, 10)
  const filepath = path.join(SESSION_DIR, `${today}.jsonl`)
  const entry = {
    ts: new Date().toISOString(),
    summary,
    tokens_used: summary.length
  }
  fs.appendFileSync(filepath, JSON.stringify(entry) + '\n')
}

export function getRecentSessions(days = 7) {
  const files = fs.readdirSync(SESSION_DIR).filter(f => f.endsWith('.jsonl'))
  const cutoff = Date.now() - days * 86400000
  const sessions = []
  for (const file of files) {
    const filepath = path.join(SESSION_DIR, file)
    const stat = fs.statSync(filepath)
    if (stat.mtimeMs > cutoff) {
      const lines = fs.readFileSync(filepath, 'utf-8').split('\n').filter(Boolean)
      sessions.push({ date: file.replace('.jsonl', ''), entries: lines.map(l => JSON.parse(l)) })
    }
  }
  return sessions.sort((a, b) => b.date.localeCompare(a.date))
}

function updateStickyIndex(category, name, filename) {
  if (!fs.existsSync(INDEX_FILE)) return
  let content = fs.readFileSync(INDEX_FILE, 'utf-8')
  const line = `- ${category}/${name} → ${filename}`
  const sectionMatch = content.match(new RegExp(`(?<=^## ${category.charAt(0).toUpperCase() + category.slice(1)}\n)([\\s\\S]*?)(?=\\n## |\\n# )`))
  if (sectionMatch) {
    const section = sectionMatch[0]
    if (!section.includes(filename)) {
      content = content.replace(section, section + line + '\n')
    }
  } else {
    content += `\n## ${category.charAt(0).toUpperCase() + category.slice(1)}\n${line}\n`
  }
  const lines = content.split('\n')
  const kb = Buffer.byteLength(content) / 1024
  if (lines.length > MAX_LINES_STICKY) {
    const keepLines = lines.slice(0, 2)
    const entries = lines.slice(2).filter(l => l.startsWith('- '))
    keepLines.push(...entries.slice(-MAX_LINES_STICKY + 2))
    content = keepLines.join('\n') + `\n<!-- truncated: ${lines.length} lines -> ${keepLines.length} -->\n`
  }
  if (kb > MAX_KB_STICKY) {
    const ratio = MAX_KB_STICKY / kb
    const lines = content.split('\n')
    const keep = Math.floor(lines.length * ratio)
    content = lines.slice(0, Math.max(keep, 10)).join('\n') + `\n<!-- truncated: ${Math.round(kb)}KB -> ${MAX_KB_STICKY}KB -->\n`
  }
  fs.writeFileSync(INDEX_FILE, content)
}
