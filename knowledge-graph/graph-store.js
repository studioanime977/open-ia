import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
const GRAPH_FILE = path.join(DATA_DIR, 'graph.json')
const INDEX_FILE = path.join(DATA_DIR, 'fts-index.json')

// === Claude Code-inspired subsystems ===
import * as wal from './wal.js'
import * as autoMemory from './auto-memory.js'
const CONSOLIDATION_FILE = path.join(DATA_DIR, 'consolidation', 'autodream-status.json')

export { wal, autoMemory }

const NODE_TYPES = ['Concept', 'Pattern', 'Solution', 'Error', 'Tool', 'Command', 'Config', 'Code', 'Agent', 'MCP', 'Project', 'File']
const EDGE_TYPES = ['SOLVES', 'USES', 'DERIVES_FROM', 'SIMILAR_TO', 'REQUIRES', 'PRECEDES', 'CONFLICTS_WITH', 'EXTENDS', 'CALLS', 'IMPORTS', 'DEFINES', 'REFERENCES', 'LEARNS_FROM']

let graph = { nodes: [], edges: [] }

function load() {
  try {
    const raw = fs.readFileSync(GRAPH_FILE, 'utf-8')
    graph = JSON.parse(raw)
  } catch { graph = { nodes: [], edges: [] } }
}

function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(GRAPH_FILE, JSON.stringify(graph, null, 2))
  buildFTSIndex()
}

function uid() {
  return crypto.randomUUID?.() || 'n' + Date.now() + Math.random().toString(36).slice(2, 8)
}

function now() { return new Date().toISOString() }

export function addNode({ type, name, description, tags, properties, source }) {
  if (!NODE_TYPES.includes(type)) return { error: `Invalid node type. Must be one of: ${NODE_TYPES.join(', ')}` }
  const node = {
    id: uid(),
    type,
    name,
    description: description || '',
    tags: tags || [],
    properties: properties || {},
    source: source || 'manual',
    created: now(),
    updated: now(),
    weight: 1
  }
  graph.nodes.push(node)
  save()
  return { node }
}

export function addEdge({ sourceId, targetId, type, properties, from, to }) {
  if (!EDGE_TYPES.includes(type)) return { error: `Invalid edge type. Must be one of: ${EDGE_TYPES.join(', ')}` }
  // Support both name-based (from, to) and id-based (sourceId, targetId) lookup
  const srcId = sourceId || (from ? (graph.nodes.find(n => n.name === from) || {}).id : undefined)
  const tgtId = targetId || (to ? (graph.nodes.find(n => n.name === to) || {}).id : undefined)
  if (!srcId) return { error: `Source node '${from || sourceId}' not found` }
  if (!tgtId) return { error: `Target node '${to || targetId}' not found` }
  const src = graph.nodes.find(n => n.id === srcId)
  const tgt = graph.nodes.find(n => n.id === tgtId)
  if (!src) return { error: `Source node ${srcId} not found` }
  if (!tgt) return { error: `Target node ${tgtId} not found` }
  const edge = {
    id: uid(),
    type,
    sourceId: srcId,
    targetId: tgtId,
    properties: properties || {},
    created: now()
  }
  graph.edges.push(edge)
  save()
  return { edge }
}

export function searchNodes({ query, type, tags, limit, offset }) {
  let results = [...graph.nodes]
  if (query) {
    const q = query.toLowerCase()
    results = results.filter(n =>
      n.name.toLowerCase().includes(q) ||
      n.description.toLowerCase().includes(q) ||
      n.tags.some(t => t.toLowerCase().includes(q)) ||
      Object.values(n.properties).some(v => String(v).toLowerCase().includes(q))
    )
  }
  if (type) results = results.filter(n => n.type === type)
  if (tags && tags.length) results = results.filter(n => tags.some(t => n.tags.includes(t)))
  const total = results.length
  const off = offset || 0
  const lim = limit || 20
  return { results: results.slice(off, off + lim), total }
}

export function getNode(id) {
  return graph.nodes.find(n => n.id === id) || null
}

export function tracePath({ nodeId, direction, depth }) {
  const maxDepth = depth || 3
  const results = []
  const visited = new Set()
  function walk(currentId, d, path) {
    if (d > maxDepth || visited.has(currentId)) return
    visited.add(currentId)
    const node = graph.nodes.find(n => n.id === currentId)
    if (!node) return
    results.push({ depth: d, node, path: [...path, currentId] })
    const edges = direction === 'inbound'
      ? graph.edges.filter(e => e.targetId === currentId)
      : direction === 'outbound'
        ? graph.edges.filter(e => e.sourceId === currentId)
        : graph.edges.filter(e => e.sourceId === currentId || e.targetId === currentId)
    for (const edge of edges) {
      const nextId = edge.sourceId === currentId ? edge.targetId : edge.sourceId
      walk(nextId, d + 1, [...path, currentId])
    }
  }
  walk(nodeId, 0, [])
  return { results }
}

export function detectImpact({ nodeId }) {
  const node = graph.nodes.find(n => n.id === nodeId)
  if (!node) return { error: 'Node not found' }
  const directEdges = graph.edges.filter(e => e.sourceId === nodeId || e.targetId === nodeId)
  const affected = new Set()
  for (const edge of directEdges) {
    const otherId = edge.sourceId === nodeId ? edge.targetId : edge.sourceId
    const other = graph.nodes.find(n => n.id === otherId)
    if (other) affected.add(other)
  }
  const downstream = []
  for (const edge of graph.edges.filter(e => e.sourceId === nodeId && e.type === 'REQUIRES')) {
    const dep = graph.nodes.find(n => n.id === edge.targetId)
    if (dep) downstream.push(dep)
  }
  return {
    node,
    directConnections: affected.size,
    connections: [...affected],
    downstream,
    allEdges: directEdges
  }
}

export function semanticSearch({ query, limit }) {
  const q = query.toLowerCase()
  const terms = q.split(/\s+/).filter(Boolean)
  const lim = limit || 10
  const scored = graph.nodes.map(node => {
    let score = 0
    const props = node.properties || {}
    const text = [node.name, node.description, ...node.tags, ...Object.values(props)].join(' ').toLowerCase()
    for (const term of terms) {
      const count = (text.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
      score += count / (1 + Math.log10(text.length + 1))
    }
    if (node.tags.some(t => terms.some(te => t.toLowerCase().includes(te)))) score += 2
    if (node.name.toLowerCase().includes(q)) score += 3
    return { node, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return { results: scored.filter(s => s.score > 0).slice(0, lim) }
}

export function getGraphStats() {
  const typeCounts = {}
  for (const n of graph.nodes) {
    typeCounts[n.type] = (typeCounts[n.type] || 0) + 1
  }
  const edgeTypeCounts = {}
  for (const e of graph.edges) {
    edgeTypeCounts[e.type] = (edgeTypeCounts[e.type] || 0) + 1
  }
  return {
    totalNodes: graph.nodes.length,
    totalEdges: graph.edges.length,
    nodeTypes: typeCounts,
    edgeTypes: edgeTypeCounts
  }
}

export function harvestFromAprendizajes(aprendizajesDir) {
  const results = { added: 0, skipped: 0, errors: [] }
  if (!fs.existsSync(aprendizajesDir)) return results
  const files = fs.readdirSync(aprendizajesDir).filter(f => f.endsWith('.md') && f !== '.index.md')
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(aprendizajesDir, file), 'utf-8')
      const lines = content.split('\n')
      const meta = {}
      let title = file.replace('.md', '')
      for (const line of lines) {
        if (line.startsWith('fecha:')) meta.fecha = line.slice(6).trim()
        if (line.startsWith('categoria:')) meta.categoria = line.slice(10).trim()
        if (line.startsWith('tags:')) meta.tags = line.slice(5).trim()
        if (line.startsWith('# ')) title = line.slice(2).trim()
      }
      const tags = meta.tags ? meta.tags.replace(/[\[\]]/g, '').split(',').map(t => t.trim()).filter(Boolean) : []
      if (meta.categoria) tags.push(meta.categoria.trim())
      const existing = graph.nodes.find(n => n.name === title && n.source === file)
      if (existing) { results.skipped++; continue }
      const sectionMatch = content.match(/## Problema\n([\s\S]*?)(?=\n## |\n---|$)/)
      const solutionMatch = content.match(/## Solución\n([\s\S]*?)(?=\n## |\n---|$)/)
      const codeMatch = content.match(/## Código Clave\n([\s\S]*?)(?=\n## |\n---|$)/)
      const leccionesMatch = content.match(/## Lecciones\n([\s\S]*?)(?=\n## |\n---|$)/)
      const node = {
        id: uid(),
        type: 'Solution',
        name: title,
        description: (sectionMatch?.[1] || '').trim().slice(0, 500),
        tags,
        properties: {
          file,
          fecha: meta.fecha || '',
          categoria: meta.categoria || '',
          problema: (sectionMatch?.[1] || '').trim().slice(0, 1000),
          solucion: (solutionMatch?.[1] || '').trim().slice(0, 1000),
          codigo: (codeMatch?.[1] || '').trim().slice(0, 2000),
          lecciones: (leccionesMatch?.[1] || '').trim().slice(0, 1000)
        },
        source: file,
        created: now(),
        updated: now(),
        weight: 1
      }
      graph.nodes.push(node)
      const tags2 = graph.nodes.filter(n => n.type === 'Concept' && tags.some(t => n.name.toLowerCase() === t.toLowerCase()))
      for (const tagNode of tags2) {
        graph.edges.push({ id: uid(), type: 'REFERENCES', sourceId: node.id, targetId: tagNode.id, properties: {}, created: now() })
      }
      results.added++
    } catch (e) { results.errors.push(`${file}: ${e.message}`) }
  }
  save()
  return results
}

function buildFTSIndex() {
  const index = {}
  for (const node of graph.nodes) {
    const terms = new Set()
    const props = node.properties || {}
    const text = [node.name, node.description, ...node.tags, ...Object.values(props)].join(' ').toLowerCase()
    for (const word of text.split(/\W+/).filter(Boolean)) {
      if (word.length > 2) terms.add(word)
    }
    index[node.id] = [...terms]
  }
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index))
}

// === AutoDream Consolidation Engine (Claude Code-inspired) ===
export function getAutoDreamStatus() {
  try {
    const raw = fs.readFileSync(CONSOLIDATION_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return {
      lastRun: null,
      sessionsSinceLastRun: 0,
      totalConsolidations: 0,
      status: 'never_run'
    }
  }
}

export function checkAutoDreamGate() {
  const status = getAutoDreamStatus()
  const now = Date.now()
  const timeGate = status.lastRun ? (now - new Date(status.lastRun).getTime()) > 24 * 60 * 60 * 1000 : true
  const sessionGate = status.sessionsSinceLastRun >= 5
  if (!timeGate && !sessionGate) return { shouldRun: false, reason: 'gates_not_met', status }
  const lockFile = CONSOLIDATION_FILE + '.lock'
  if (fs.existsSync(lockFile)) {
    const lockAge = Date.now() - fs.statSync(lockFile).mtimeMs
    if (lockAge < 10 * 60 * 1000) return { shouldRun: false, reason: 'locked', status }
    fs.unlinkSync(lockFile)
  }
  return { shouldRun: timeGate || sessionGate, reason: timeGate ? 'time_gate' : 'session_gate', status }
}

export function lockAutoDream() {
  const lockFile = CONSOLIDATION_FILE + '.lock'
  fs.writeFileSync(lockFile, JSON.stringify({ locked: new Date().toISOString() }))
}

export function unlockAutoDream() {
  const lockFile = CONSOLIDATION_FILE + '.lock'
  try { fs.unlinkSync(lockFile) } catch {}
}

export function runAutoDreamPhase(phase) {
  wal.append({ event: 'autodream_phase', phase, timestamp: new Date().toISOString() })
  const status = getAutoDreamStatus()
  const phases = {
    orient: () => {
      const memoryFiles = fs.readdirSync(path.join(DATA_DIR, 'auto-memory')).filter(f => f.endsWith('.md'))
      const sessionFiles = fs.readdirSync(path.join(DATA_DIR, 'session-logs')).filter(f => f.endsWith('.jsonl'))
      const memoryIndex = fs.readFileSync(path.join(DATA_DIR, 'MEMORY.md'), 'utf-8')
      return { memoryFiles: memoryFiles.length, sessionFiles: sessionFiles.length, memoryIndexLines: memoryIndex.split('\n').length }
    },
    gather: () => {
      const sessions = autoMemory.getRecentSessions(30)
      const patterns = []
      const corrections = []
      for (const s of sessions) {
        for (const e of s.entries) {
          if (e.summary && e.summary.toLowerCase().includes('correct')) corrections.push(e)
          if (e.summary && e.summary.toLowerCase().includes('pattern')) patterns.push(e)
        }
      }
      return { sessionsScanned: sessions.length, correctionsFound: corrections.length, patternsFound: patterns.length }
    },
    consolidate: () => {
      autoMemory.saveSessionSummary(`Consolidation run at ${new Date().toISOString()}`)
      const oldStatus = status
      const updated = {
        lastRun: new Date().toISOString(),
        sessionsSinceLastRun: 0,
        totalConsolidations: (oldStatus.totalConsolidations || 0) + 1,
        status: 'completed'
      }
      fs.writeFileSync(CONSOLIDATION_FILE, JSON.stringify(updated, null, 2))
      return { previousRun: oldStatus.lastRun, totalRuns: updated.totalConsolidations }
    },
    prune: () => {
      const indexFile = path.join(DATA_DIR, 'MEMORY.md')
      let content = fs.readFileSync(indexFile, 'utf-8')
      const lines = content.split('\n')
      if (lines.length > 200) {
        const header = lines.slice(0, 2)
        const entries = lines.filter(l => l.startsWith('- '))
        content = header.join('\n') + '\n' + entries.slice(-180).join('\n') + '\n'
        fs.writeFileSync(indexFile, content)
      }
      const kb = Buffer.byteLength(content) / 1024
      const trimmed = kb > 25
      if (trimmed) {
        const ratio = 25 / kb
        const keepLines = lines.filter(l => l.startsWith('- '))
        content = lines.slice(0, 2).join('\n') + '\n' + keepLines.slice(0, Math.floor(keepLines.length * ratio)).join('\n') + '\n'
        fs.writeFileSync(indexFile, content)
      }
      return { linesBefore: lines.length, linesAfter: content.split('\n').length, trimmed, kb: Math.round(kb * 10) / 10 }
    }
  }
  const fn = phases[phase]
  return fn ? fn() : null
}

export function incrementSessionCounter() {
  const status = getAutoDreamStatus()
  status.sessionsSinceLastRun = (status.sessionsSinceLastRun || 0) + 1
  fs.writeFileSync(CONSOLIDATION_FILE, JSON.stringify(status, null, 2))
}

load()
