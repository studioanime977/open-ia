import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
const GRAPH_FILE = path.join(DATA_DIR, 'graph.json')
const INDEX_FILE = path.join(DATA_DIR, 'fts-index.json')

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

load()
