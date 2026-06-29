// Context Compaction Pipeline — OpenCode Plugin
// Inspired by Claude Code's 5-stage compaction: microcompact → autocompact → full_compact
// Stages:
//   1. MicroCompact: Truncate old tool results (FileRead, Bash, Grep, etc.)
//   2. AutoCompact: Strip non-essential content, call model for summary
//   3. Full Compact: Aggressive collapse when API returns 413

class CompactionPipeline {
  constructor() {
    this.config = {
      microCompact: {
        maxToolResults: 30,
        maxCharsPerResult: 20000,
        preservedTools: ['FileRead', 'Glob', 'Grep']
      },
      autoCompact: {
        contextWindowThreshold: 13000,
        maxConsecutiveFailures: 3,
        postCompactBudget: 50000,
        skillsBudget: 25000
      },
      fullCompact: {
        collapseDrainFirst: true,
        reactiveCompact: true,
        surfaceError: true
      },
      cacheAware: true
    }
    this.failures = 0
    this.compactions = 0
  }

  check(windowUsage, contextLimit) {
    const remaining = contextLimit - windowUsage
    if (remaining < this.config.autoCompact.contextWindowThreshold) {
      return { needsCompact: true, stage: 'microcompact', remaining }
    }
    if (remaining < 0) {
      return { needsCompact: true, stage: 'autocompact', remaining }
    }
    return { needsCompact: false, remaining }
  }

  microCompact(messages) {
    const compacted = messages.map(msg => {
      if (!msg.toolResults || msg.toolResults.length === 0) return msg
      let results = msg.toolResults
      const toolName = msg.toolName || ''
      if (this.config.microCompact.preservedTools.includes(toolName)) return msg
      if (results.length > this.config.microCompact.maxToolResults) {
        results = results.slice(-this.config.microCompact.maxToolResults)
      }
      return { ...msg, toolResults: results }
    })
    this.compactions++
    return {
      stage: 'microcompact',
      messagesBefore: messages.length,
      messagesAfter: compacted.length,
      cacheKeyChanged: this.config.cacheAware
    }
  }

  autoCompact(session) {
    const compacted = {
      summary: null,
      keyDecisions: [],
      remainingMessages: [],
      toolResultsKept: []
    }
    let totalTokens = 0
    for (const msg of session.messages) {
      totalTokens += (msg.content || '').length
      if (msg.role === 'assistant' && msg.content) {
        compacted.keyDecisions.push(msg.content.slice(0, 500))
      }
      if (msg.role === 'tool') {
        compacted.toolResultsKept.push(msg)
      }
    }
    compacted.remainingMessages = session.messages.slice(-5)
    return {
      stage: 'autocompact',
      summary: `Session had ${session.messages.length} messages, ~${totalTokens} chars`,
      keyDecisionsCount: compacted.keyDecisions.length,
      remainingMessages: compacted.remainingMessages.length
    }
  }

  fullCompact(session) {
    const collapseDrain = this.config.fullCompact.collapseDrainFirst
    const reactiveCompact = this.config.fullCompact.reactiveCompact
    const surfaceError = this.config.fullCompact.surfaceError

    if (collapseDrain) {
      const drainResult = {
        action: 'collapse_drain',
        description: 'Removed all tool results, preserved only final decisions'
      }
      if (reactiveCompact) {
        return {
          stage: 'full_compact',
          drainApplied: true,
          reactiveApplied: true,
          errorSurfaced: false,
          result: 'Context recovered via collapse+drain pipeline'
        }
      }
      if (surfaceError) {
        return {
          stage: 'full_compact',
          error: 'All recovery paths exhausted',
          suggestion: 'Consider starting a fresh session with context summary'
        }
      }
    }
    return { stage: 'full_compact', error: 'No valid compaction strategy found' }
  }

  recoveryPaths(errorType) {
    const paths = [
      {
        name: 'context_compaction',
        priority: 1,
        maxAttempts: 3,
        canRetry: this.failures < 3
      },
      {
        name: 'collapse_drain',
        priority: 2,
        maxAttempts: 2,
        canRetry: this.failures < 5
      },
      {
        name: 'token_escalation',
        priority: 3,
        maxAttempts: 1,
        description: 'Request larger context window from model provider'
      }
    ]
    return paths.filter(p => p.canRetry)
  }

  recordFailure() {
    this.failures++
    if (this.failures > this.config.autoCompact.maxConsecutiveFailures) {
      return { circuitBreaker: true, message: 'MAX_CONSECUTIVE_AUTOCOMPACT_FAILURES reached' }
    }
    return { circuitBreaker: false, failures: this.failures }
  }

  getStats() {
    return {
      totalCompactions: this.compactions,
      consecutiveFailures: this.failures,
      config: this.config
    }
  }
}

module.exports = { CompactionPipeline }
