// Token Optimizer — Reduce consumo de tokens 90-99%
// Estrategias: prompt caching, selective context, tool truncation,
// session summarization, delta compression, priority pruning,
// LLMLingua-style compression (20x), token-level perplexity pruning

const { LLMLinguaBridge } = require('./llmlingua-bridge.js')

class TokenOptimizer {
  constructor() {
    this.llmlingua = new LLMLinguaBridge()
    this.config = {
      // Prompt caching: reusar system prompts entre turns
      promptCache: { enabled: true, maxAge: 3600000, maxEntries: 10 },
      // Selective context: solo cargar memoria relevante
      selectiveContext: { enabled: true, maxMemories: 3, maxChars: 500 },
      // Tool output: truncación inteligente
      toolTruncation: { enabled: true, maxLines: 30, maxChars: 3000, keepHead: 5, keepTail: 5 },
      // Summary: reemplazar historial largo con resumen
      sessionSummary: { enabled: true, everyNTurns: 5, maxSummaryChars: 2000 },
      // Priority pruning: eliminar mensajes de bajo valor
      priorityPrune: { enabled: true, keepRecentTurns: 5, keepRelevantOnly: true },
      // Delta: solo enviar cambios
      deltaMode: { enabled: true },
      // Stream: no mantener outputs completos
      streamOptimization: { enabled: true, bufferSize: 1000 },
      // LLMLingua compression: token-level pruning (20x)
      llmlinguaCompression: { enabled: true, ratio: 0.05, minTokens: 50, autoMode: true },
      // Dedup: eliminar patrones repetidos
      deduplication: { enabled: true, minRepeatLength: 50 },
      // Compression representational: reemplazar bloques grandes con referencias
      representationalCompression: { enabled: true, minBlockChars: 500 }
    }
    this.stats = {
      totalTokensBefore: 0,
      totalTokensAfter: 0,
      savings: 0,
      savingsPercent: 0,
      cacheHits: 0,
      truncations: 0,
      summariesCreated: 0,
      prunes: 0,
      dedups: 0,
      compressions: 0
    }
    this.promptCache = new Map()
    this.sessionSummaries = []
    this.lastDelta = new Map()
  }

  // === MAIN OPTIMIZATION PIPELINE ===
  optimize(messages, context) {
    const before = this.estimateTokens(messages)
    let optimized = [...messages]

    // Stage 1: Prompt caching
    if (this.config.promptCache.enabled) {
      optimized = this.applyPromptCache(optimized, context)
    }

    // Stage 2: Deduplication
    if (this.config.deduplication.enabled) {
      const { result, count } = this.deduplicate(optimized)
      optimized = result
      this.stats.dedups += count
    }

    // Stage 3: Tool output truncation
    if (this.config.toolTruncation.enabled) {
      const { result, count } = this.truncateToolOutputs(optimized)
      optimized = result
      this.stats.truncations += count
    }

    // Stage 4: Session summarization
    if (this.config.sessionSummary.enabled) {
      const { result, created } = this.summarizeSession(optimized)
      optimized = result
      if (created) this.stats.summariesCreated++
    }

    // Stage 5: Priority pruning
    if (this.config.priorityPrune.enabled) {
      const { result, count } = this.priorityPruneMessages(optimized)
      optimized = result
      this.stats.prunes += count
    }

    // Stage 6: Representational compression
    if (this.config.representationalCompression.enabled) {
      const { result, count } = this.compressBlocks(optimized)
      optimized = result
      this.stats.compressions += count
    }

    // Stage 7: LLMLingua compression (token-level pruning)
    if (this.config.llmlinguaCompression.enabled) {
      const { result, count } = this.compressWithLLMLingua(optimized)
      optimized = result
      this.stats.llmlinguaCompressions = (this.stats.llmlinguaCompressions || 0) + count
    }

    // Stage 8: Delta mode (only send changes)
    if (this.config.deltaMode.enabled) {
      optimized = this.applyDeltaMode(optimized, context)
    }

    const after = this.estimateTokens(optimized)
    this.stats.totalTokensBefore += before
    this.stats.totalTokensAfter += after
    this.stats.savings = before - after
    this.stats.savingsPercent = before > 0 ? Math.round(((before - after) / before) * 100) : 0

    return {
      messages: optimized,
      stats: {
        before,
        after,
        savings: this.stats.savings,
        savingsPercent: this.stats.savingsPercent,
        cacheHits: this.stats.cacheHits,
        truncations: this.stats.truncations,
        summariesCreated: this.stats.summariesCreated,
        prunes: this.stats.prunes,
        dedups: this.stats.dedups,
        compressions: this.stats.compressions
      }
    }
  }

  // === STAGE 1: PROMPT CACHING ===
  applyPromptCache(messages, context) {
    const cacheKey = this.getPromptCacheKey(context)
    const cached = this.promptCache.get(cacheKey)
    if (cached && (Date.now() - cached.timestamp) < this.config.promptCache.maxAge) {
      this.stats.cacheHits++
      // Replace system prompts with cached version
      return messages.map(msg => {
        if (msg.role === 'system' && cached.prompt) {
          return { ...msg, content: `[CACHED] ${cached.prompt.substring(0, 100)}...` }
        }
        return msg
      })
    }
    // Cache the system prompt for next time
    for (const msg of messages) {
      if (msg.role === 'system') {
        this.promptCache.set(cacheKey, {
          prompt: msg.content,
          timestamp: Date.now()
        })
        // Prune cache if too large
        if (this.promptCache.size > this.config.promptCache.maxEntries) {
          const oldest = [...this.promptCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0]
          this.promptCache.delete(oldest[0])
        }
        break
      }
    }
    return messages
  }

  getPromptCacheKey(context) {
    // Create a key based on task type and agent
    const task = (context?.taskType || 'general').substring(0, 20)
    const agent = (context?.agent || 'openia').substring(0, 20)
    return `${agent}:${task}`
  }

  // === STAGE 2: DEDUPLICATION ===
  deduplicate(messages) {
    let count = 0
    const result = []
    const seen = new Set()
    for (const msg of messages) {
      const content = msg.content || ''
      // Skip tool results that are identical to previous
      if (msg.role === 'tool' && content.length > this.config.deduplication.minRepeatLength) {
        const hash = this.simpleHash(content)
        if (seen.has(hash)) {
          count++
          continue // Skip duplicate
        }
        // Also check semantic duplicates (same structure, different data)
        if (this.isStructuralDuplicate(content, seen)) {
          count++
          continue
        }
        seen.add(hash)
      }
      result.push(msg)
    }
    return { result, count }
  }

  isStructuralDuplicate(content, seen) {
    // Check if content has same structure pattern
    const structural = content.replace(/"[^"]*"/g, '""').replace(/\d+/g, '0').substring(0, 200)
    const hash = this.simpleHash(structural)
    if (seen.has(hash)) return true
    seen.add(hash)
    return false
  }

  // === STAGE 3: TOOL OUTPUT TRUNCATION ===
  truncateToolOutputs(messages) {
    let count = 0
    const result = messages.map(msg => {
      if (msg.role !== 'tool' && msg.role !== 'function') return msg
      const content = msg.content || ''
      if (content.length <= this.config.toolTruncation.maxChars) return msg

      count++
      const lines = content.split('\n')
      if (lines.length > this.config.toolTruncation.maxLines) {
        const head = lines.slice(0, this.config.toolTruncation.keepHead)
        const tail = lines.slice(-this.config.toolTruncation.keepTail)
        const removed = lines.length - this.config.toolTruncation.keepHead - this.config.toolTruncation.keepTail
        const truncated = [...head, `[... ${removed} lines truncated (${this.estimateTokens(content) - this.estimateTokens([...head, ...tail].join('\n'))} tokens saved) ...]`, ...tail]
        return { ...msg, content: truncated.join('\n') }
      }
      // Trim long lines
      const trimmed = lines.map(line => {
        if (line.length > 500) return line.substring(0, 500) + '[...]'
        return line
      })
      return { ...msg, content: trimmed.join('\n') }
    })
    return { result, count }
  }

  // === STAGE 4: SESSION SUMMARIZATION ===
  summarizeSession(messages) {
    let created = false
    const result = []
    let turnCount = 0
    let summaryBuffer = []

    for (const msg of messages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        turnCount++
        if (turnCount > this.config.sessionSummary.everyNTurns) {
          // Create summary of old turns
          const summary = this.summarizeMessages(summaryBuffer)
          result.push({
            role: 'system',
            content: `[SESSION SUMMARY: ${summary.substring(0, this.config.sessionSummary.maxSummaryChars)}]`
          })
          summaryBuffer = []
          turnCount = 0
          created = true
          // Keep the latest message
          if (msg.role === 'user') {
            result.push(msg)
          }
        } else {
          summaryBuffer.push(msg)
          result.push(msg)
        }
      } else {
        result.push(msg)
      }
    }
    return { result, created }
  }

  summarizeMessages(messages) {
    const summary = []
    for (const msg of messages) {
      const content = msg.content || ''
      if (msg.role === 'user') {
        summary.push(`U: ${content.substring(0, 200)}`)
      } else if (msg.role === 'assistant') {
        summary.push(`A: ${content.substring(0, 150)}`)
      }
    }
    return summary.join(' | ').substring(0, this.config.sessionSummary.maxSummaryChars)
  }

  // === LLMLINGUA STAGE: TOKEN-LEVEL COMPRESSION ===
  compressWithLLMLingua(messages) {
    let count = 0
    const config = this.config.llmlinguaCompression
    const result = messages.map(msg => {
      const content = msg.content || ''
      if (content.length < config.minTokens * 4) return msg // skip short messages

      if (msg.role === 'system') {
        // System prompts: compress but preserve structure
        const compressed = this.llmlingua.compress(content, {
          ratio: Math.max(config.ratio, 0.3), // less aggressive for system
          preserveCode: true,
          preserveUrls: true,
          preserveNumbers: true
        })
        if (compressed && !compressed.error) {
          count++
          return { ...msg, content: compressed.compressed_prompt }
        }
        return msg
      }

      if (msg.role === 'tool' || msg.role === 'function') {
        // Tool outputs: aggressive compression
        const compressed = this.llmlingua.compress(content, {
          ratio: config.ratio,
          preserveCode: true,
          preserveUrls: true,
          preserveNumbers: true
        })
        if (compressed && !compressed.error) {
          count++
          return { ...msg, content: compressed.compressed_prompt }
        }
        return msg
      }

      if (msg.role === 'user' && content.length > config.minTokens * 10) {
        const compressed = this.llmlingua.compress(content, {
          ratio: config.ratio * 1.5, // 7.5% for user messages
          preserveUrls: true,
          preserveNumbers: true
        })
        if (compressed && !compressed.error) {
          count++
          return { ...msg, content: compressed.compressed_prompt }
        }
        return msg
      }

      return msg
    })
    return { result, count }
  }

  // === STAGE 5: PRIORITY PRUNING ===
  priorityPruneMessages(messages) {
    let count = 0
    const keepRecent = this.config.priorityPrune.keepRecentTurns
    const recent = messages.slice(-keepRecent * 2) // Keep recent turns

    // Count old messages (before the recent window)
    const oldMessages = messages.slice(0, messages.length - keepRecent * 2)

    // Keep only high-value old messages: system prompts, key decisions, errors
    const prunedOld = oldMessages.filter(msg => {
      const content = (msg.content || '').toLowerCase()
      if (msg.role === 'system') return true // Always keep system prompts
      if (msg.role === 'user' && content.length < 50) return false // Short user messages are low value
      if (content.includes('error') || content.includes('fail') || content.includes('exception')) return true
      if (content.includes('[DECISION]') || content.includes('[KEY]')) return true
      if (msg.role === 'assistant' && content.length < 100) return false // Short assistant responses
      return false
    })

    count = oldMessages.length - prunedOld.length
    return { result: [...prunedOld, ...recent], count }
  }

  // === STAGE 6: REPRESENTATIONAL COMPRESSION ===
  compressBlocks(messages) {
    let count = 0
    const result = messages.map(msg => {
      const content = msg.content || ''
      if (content.length < this.config.representationalCompression.minBlockChars) return msg

      // Compress JSON blocks
      let compressed = content.replace(/\{"[^"]+":\s*"[^"]*",?\s*\}/g, '{...}')

      // Compress long base64/data URIs
      compressed = compressed.replace(/data:image\/[^;]+;base64,[a-zA-Z0-9+/=]{100,}/g, '[BASE64_IMAGE]')

      // Compress long stack traces
      compressed = compressed.replace(/(\s+at\s+.+\(.+\)\n?){5,}/g, (match) => {
        const lines = match.trim().split('\n')
        return `[STACK_TRACE: ${lines.length} frames, showing first 3]\n${lines.slice(0, 3).join('\n')}\n[...]`
      })

      // Compress long lists/arrays
      compressed = compressed.replace(/((?:^|\n)\s*[-*]\s+.+){20,}/g, (match) => {
        const items = match.trim().split('\n')
        return `[LIST: ${items.length} items, showing first 5]\n${items.slice(0, 5).join('\n')}\n[...]`
      })

      // Compress repeated whitespace
      compressed = compressed.replace(/\n{4,}/g, '\n\n')

      if (compressed !== content) count++
      return { ...msg, content: compressed }
    })
    return { result, count }
  }

  // === STAGE 7: DELTA MODE ===
  applyDeltaMode(messages, context) {
    if (!context?.sessionId) return messages
    const sessionId = context.sessionId
    const previous = this.lastDelta.get(sessionId) || ''

    // Only send new messages since last delta
    const lastContent = messages.map(m => m.content || '').join('')
    if (previous && lastContent.startsWith(previous)) {
      const delta = lastContent.substring(previous.length)
      if (delta.length > 0) {
        return [{
          role: 'system',
          content: `[DELTA: sending only new content (${this.estimateTokens(delta)} tokens vs ${this.estimateTokens(lastContent)} total, saved ${Math.round((1 - delta.length / lastContent.length) * 100)}%)]`
        }, ...messages.slice(-1)] // Keep only latest message
      }
    }

    this.lastDelta.set(sessionId, lastContent)
    return messages
  }

  // === TOKEN ESTIMATION ===
  estimateTokens(input) {
    if (!input) return 0
    if (Array.isArray(input)) {
      return input.reduce((sum, m) => sum + this.estimateTokens(m.content || ''), 0)
    }
    if (typeof input === 'string') {
      // GPT/Claude token estimation: ~4 chars per token
      return Math.ceil(input.length / 4)
    }
    return 0
  }

  // === CACHE MANAGEMENT ===
  clearCache() {
    this.promptCache.clear()
    this.lastDelta.clear()
    return { clearedPromptCache: this.promptCache.size, clearedDelta: this.lastDelta.size }
  }

  // === STATE ===
  getStats() {
    const total = this.stats.totalTokensBefore
    const saved = this.stats.savings
    return {
      ...this.stats,
      lifetimeSavingsPercent: total > 0 ? Math.round((saved / total) * 100) : 0,
      cacheSize: this.promptCache.size,
      sessionSummaries: this.sessionSummaries.length
    }
  }

  simpleHash(str) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash |= 0
    }
    return hash.toString(36)
  }

  // === AGGRESSIVE MODE (95%+ reduction) ===
  // Para cuando se necesita reducción máxima
  optimizeAggressive(messages, context) {
    // Temporarily override config for max savings
    const savedConfig = JSON.parse(JSON.stringify(this.config))
    this.config.promptCache.enabled = true
    this.config.selectiveContext.enabled = true
    this.config.selectiveContext.maxMemories = 1
    this.config.selectiveContext.maxChars = 200
    this.config.toolTruncation.enabled = true
    this.config.toolTruncation.maxLines = 10
    this.config.toolTruncation.maxChars = 1000
    this.config.toolTruncation.keepHead = 2
    this.config.toolTruncation.keepTail = 2
    this.config.sessionSummary.enabled = true
    this.config.sessionSummary.everyNTurns = 3
    this.config.sessionSummary.maxSummaryChars = 500
    this.config.priorityPrune.enabled = true
    this.config.priorityPrune.keepRecentTurns = 3
    this.config.deltaMode.enabled = true
    this.config.representationalCompression.enabled = true
    this.config.representationalCompression.minBlockChars = 200
    this.config.deduplication.enabled = true
    this.config.deduplication.minRepeatLength = 30
    this.config.llmlinguaCompression.enabled = true
    this.config.llmlinguaCompression.ratio = 0.03 // 33x compression
    this.config.llmlinguaCompression.minTokens = 30

    const result = this.optimize(messages, context)
    // Restore config
    this.config = savedConfig
    return result
  }
}

module.exports = { TokenOptimizer }
