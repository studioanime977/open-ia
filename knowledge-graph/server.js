import { stdin, stdout } from 'process'
import {
  addNode, addEdge, searchNodes, getNode, tracePath,
  detectImpact, semanticSearch, getGraphStats, harvestFromAprendizajes,
  checkAutoDreamGate, runAutoDreamPhase, lockAutoDream, unlockAutoDream,
  wal, autoMemory
} from './graph-store.js'

const __dirname = new URL('.', import.meta.url).pathname
const APRENDIZAJES_DIR = __dirname.replace(/\\/g, '/').replace(/knowledge-graph\/?$/, 'opencode-ia-avanzada/aprendizajes')

function jsonRpc(id, result) {
  return JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n'
}
function jsonRpcError(id, code, message) {
  return JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n'
}

stdin.setEncoding('utf-8')
let buffer = ''

stdin.on('data', chunk => {
  buffer += chunk
  const lines = buffer.split('\n')
  buffer = lines.pop() || ''
  for (const line of lines) {
    if (!line.trim()) continue
    try {
      const msg = JSON.parse(line)
      handleMessage(msg)
    } catch { /* ignore parse errors */ }
  }
})

function handleMessage(msg) {
  const { id, method, params } = msg
  if (method === 'initialize') {
    const out = jsonRpc(id, {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {
          listChanged: false
        }
      },
      serverInfo: { name: 'open-knowledge-graph', version: '1.0.0' }
    })
    stdout.write(out)
    return
  }
  if (method === 'notifications/initialized') {
    stdout.write(jsonRpc(null, {}))
    return
  }
  if (method === 'tools/list') {
    stdout.write(jsonRpc(id, { tools }))
    return
  }
  if (method === 'tools/call') {
    handleToolCall(id, params)
    return
  }
  stdout.write(jsonRpc(id, {}))
}

const tools = [
  {
    name: 'kg_add_node',
    description: 'Add a knowledge node (Concept, Pattern, Solution, Error, Tool, Command, Config, Code, Agent, MCP, Project, File)',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['Concept', 'Pattern', 'Solution', 'Error', 'Tool', 'Command', 'Config', 'Code', 'Agent', 'MCP', 'Project', 'File'] },
        name: { type: 'string', description: 'Node name (unique identifier)' },
        description: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        properties: { type: 'object', description: 'Additional key-value data' },
        source: { type: 'string', description: 'Source file or reference' }
      },
      required: ['type', 'name']
    }
  },
  {
    name: 'kg_add_edge',
    description: 'Link two nodes with a typed edge: SOLVES, USES, DERIVES_FROM, SIMILAR_TO, REQUIRES, PRECEDES, CONFLICTS_WITH, EXTENDS, CALLS, IMPORTS, DEFINES, REFERENCES, LEARNS_FROM',
    inputSchema: {
      type: 'object',
      properties: {
        sourceId: { type: 'string' },
        targetId: { type: 'string' },
        type: { type: 'string', enum: ['SOLVES', 'USES', 'DERIVES_FROM', 'SIMILAR_TO', 'REQUIRES', 'PRECEDES', 'CONFLICTS_WITH', 'EXTENDS', 'CALLS', 'IMPORTS', 'DEFINES', 'REFERENCES', 'LEARNS_FROM'] },
        properties: { type: 'object' }
      },
      required: ['sourceId', 'targetId', 'type']
    }
  },
  {
    name: 'kg_search',
    description: 'Search nodes by text query, type filter, or tags',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        type: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        limit: { type: 'number' },
        offset: { type: 'number' }
      }
    }
  },
  {
    name: 'kg_semantic_search',
    description: 'Find knowledge by meaning — vector-like scoring across names, descriptions, and tags',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language query' },
        limit: { type: 'number' }
      },
      required: ['query']
    }
  },
  {
    name: 'kg_trace',
    description: 'Trace inbound/outbound connections from a node (blast radius)',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string' },
        direction: { type: 'string', enum: ['inbound', 'outbound', 'both'], description: 'Traversal direction' },
        depth: { type: 'number', description: 'Max traversal depth (1-5)' }
      },
      required: ['nodeId']
    }
  },
  {
    name: 'kg_impact',
    description: 'Analyze what depends on a node and what it depends on',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'Node ID to analyze' }
      },
      required: ['nodeId']
    }
  },
  {
    name: 'kg_get_node',
    description: 'Get full details of a single node by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' }
      },
      required: ['id']
    }
  },
  {
    name: 'kg_stats',
    description: 'Get graph statistics: node count, edge count, type distribution',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'kg_harvest',
    description: 'Scan aprendizajes/ directory and import new knowledge as graph nodes',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'kg_autodream_status',
    description: 'Check AutoDream consolidation status (time gate, session gate, lock)',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'kg_autodream_consolidate',
    description: 'Run AutoDream consolidation — 4 phases: orient, gather, consolidate, prune',
    inputSchema: {
      type: 'object',
      properties: {
        phase: { type: 'string', enum: ['orient', 'gather', 'consolidate', 'prune', 'all'], description: 'Single phase or all 4' }
      }
    }
  },
  {
    name: 'kg_wal_start',
    description: 'Start a Write-Ahead Logging session for durability (like Claude Code\'s write-ahead logging)',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'kg_wal_append',
    description: 'Append an event to the current WAL session',
    inputSchema: {
      type: 'object',
      properties: {
        event: { type: 'string', description: 'Event name' },
        label: { type: 'string' },
        data: { type: 'object' }
      },
      required: ['event']
    }
  },
  {
    name: 'kg_wal_recover',
    description: 'Recover from last WAL session (like Claude Code\'s resilience mechanism)',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'kg_memory_save',
    description: 'Save to auto-memory with categorization (user/feedback/project/reference)',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Memory entry name' },
        content: { type: 'string', description: 'Memory content' },
        type: { type: 'string', enum: ['user', 'feedback', 'project', 'reference'] },
        tags: { type: 'array', items: { type: 'string' } },
        scope: { type: 'string', enum: ['user', 'project'] }
      },
      required: ['name', 'content']
    }
  },
  {
    name: 'kg_memory_search',
    description: 'Search auto-memory entries by relevance scoring (BM25-like)',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        maxResults: { type: 'number', description: 'Max results (default 5)' }
      },
      required: ['query']
    }
  },
  {
    name: 'kg_memory_relevant',
    description: 'Get only the most relevant memories for context — filters by MEMORY.md + auto-memory scoring',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Current task context' },
        maxResults: { type: 'number', description: 'Max memories to return (default 5)' }
      },
      required: ['query']
    }
  },
  {
    name: 'kg_compaction_pipeline',
    description: 'Check and run compaction pipeline (3 stages: microcompact, autocompact, full_compact)',
    inputSchema: {
      type: 'object',
      properties: {
        stage: { type: 'string', enum: ['check', 'microcompact', 'autocompact', 'full_compact'] }
      }
    }
  }
]

function handleToolCall(id, params) {
  const { name, arguments: args } = params
  try {
    let result
    switch (name) {
      case 'kg_add_node': result = addNode(args); break
      case 'kg_add_edge': result = addEdge(args); break
      case 'kg_search': result = searchNodes(args || {}); break
      case 'kg_semantic_search': result = semanticSearch(args || {}); break
      case 'kg_trace': result = tracePath(args || {}); break
      case 'kg_impact': result = detectImpact(args || {}); break
      case 'kg_get_node': result = getNode(args?.id); break
      case 'kg_stats': result = getGraphStats(); break
      case 'kg_harvest': result = harvestFromAprendizajes(APRENDIZAJES_DIR); break
      case 'kg_autodream_status': result = checkAutoDreamGate(); break
      case 'kg_autodream_consolidate': {
        const phases = args?.phase === 'all' ? ['orient', 'gather', 'consolidate', 'prune'] : [args?.phase || 'consolidate']
        result = {}
        for (const p of phases) {
          lockAutoDream()
          result[p] = runAutoDreamPhase(p)
          unlockAutoDream()
        }
        break
      }
      case 'kg_wal_start': result = { session: wal.startSession() }; break
      case 'kg_wal_append': {
        wal.append({ event: args?.event, label: args?.label, data: args?.data })
        result = { ok: true }
        break
      }
      case 'kg_wal_recover': result = wal.recoverLastSession(); break
      case 'kg_memory_save': {
        result = autoMemory.saveMemory(args?.name, args?.content, { type: args?.type, tags: args?.tags, scope: args?.scope })
        break
      }
      case 'kg_memory_search': result = autoMemory.searchMemory(args?.query, args?.maxResults || 5); break
      case 'kg_memory_relevant': result = autoMemory.getRelevantMemories(args?.query, args?.maxResults || 5); break
      case 'kg_compaction_pipeline': {
        const stage = args?.stage || 'check'
        if (stage === 'check') {
          const walStatus = wal.recoverLastSession()
          result = {
            wal_orphaned: walStatus !== null,
            recovery_paths: wal.recoveryPaths(),
            autodream: checkAutoDreamGate()
          }
        } else if (stage === 'microcompact') {
          result = { action: 'Truncate old tool results, preserve prompt cache integrity' }
        } else if (stage === 'autocompact') {
          result = { action: 'Strip images/docs from older messages, call compaction model for summary', budget: 50000 }
        } else if (stage === 'full_compact') {
          result = { action: 'Stage collapses — collapse drain, reactive compact, surface error if all fail' }
        }
        break
      }
      default: throw new Error(`Unknown tool: ${name}`)
    }
    stdout.write(jsonRpc(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }))
  } catch (e) {
    stdout.write(jsonRpcError(id, -32603, e.message))
  }
}
